import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store, Row } from '../core/store';
import { Table } from '../core/models';
import {
  documentValidator,
  moneyValidator,
  phoneValidator,
  formatPhone,
  formatDocument,
} from '../core/domain';
import { Badge, Empty, Icon, Modal } from '../shared/ui';
interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  suggestions?: string[];
  relation?: Table;
  wide?: boolean;
}
interface CatalogConfig {
  table: Table;
  title: string;
  singular: string;
  subtitle: string;
  fields: Field[];
  columns: string[];
}
const alphabetical = (values: string[]) =>
  [...values].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
const VEHICLE_BRANDS = alphabetical([
  'Abarth',
  'Agrale',
  'Alfa Romeo',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'BYD',
  'Caoa Chery',
  'Changan',
  'Chevrolet',
  'Chrysler',
  'Citroën',
  'Dafra',
  'Dodge',
  'Ducati',
  'Ferrari',
  'Fiat',
  'Ford',
  'GWM',
  'Harley-Davidson',
  'Honda',
  'Hyundai',
  'Iveco',
  'JAC',
  'Jaguar',
  'Jeep',
  'Kawasaki',
  'Kia',
  'Lamborghini',
  'Land Rover',
  'Lexus',
  'Lifan',
  'Maserati',
  'Mercedes-Benz',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Porsche',
  'RAM',
  'Renault',
  'Royal Enfield',
  'Scania',
  'Shineray',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Triumph',
  'Volkswagen',
  'Volvo',
  'Yamaha',
]);
const VEHICLE_COLORS = alphabetical([
  'Amarelo',
  'Azul',
  'Bege',
  'Branco',
  'Bronze',
  'Cinza',
  'Dourado',
  'Laranja',
  'Marrom',
  'Prata',
  'Preto',
  'Rosa',
  'Roxo',
  'Verde',
  'Vermelho',
]);
const CONFIG: Record<string, CatalogConfig> = {
  clientes: {
    table: 'customers',
    title: 'Clientes',
    singular: 'cliente',
    subtitle: 'Conheça quem confia o cuidado do veículo à sua equipe.',
    columns: ['name', 'phone', 'email', 'active'],
    fields: [
      { key: 'name', label: 'Nome completo', required: true },
      { key: 'phone', label: 'Telefone', type: 'tel', required: true },
      { key: 'document', label: 'CPF / CNPJ' },
      { key: 'whatsapp', label: 'WhatsApp', type: 'tel' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'address', label: 'Endereço', wide: true },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
  },
  veiculos: {
    table: 'vehicles',
    title: 'Veículos',
    singular: 'veículo',
    subtitle: 'Encontre um veículo pela placa, cliente ou telefone.',
    columns: ['plate', 'model', 'customer_id', 'type', 'active'],
    fields: [
      { key: 'customer_id', label: 'Cliente', relation: 'customers', required: true },
      { key: 'plate', label: 'Placa', required: true },
      { key: 'brand', label: 'Marca', required: true, suggestions: VEHICLE_BRANDS },
      { key: 'model', label: 'Modelo', required: true },
      { key: 'year', label: 'Ano', type: 'number' },
      { key: 'color', label: 'Cor', suggestions: VEHICLE_COLORS },
      {
        key: 'type',
        label: 'Tipo de veículo',
        options: alphabetical(['carro', 'SUV', 'caminhonete', 'moto', 'van', 'outro']),
        required: true,
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
  },
  servicos: {
    table: 'services',
    title: 'Serviços',
    singular: 'serviço',
    subtitle: 'Seu catálogo de cuidados, com preços e duração estimada.',
    columns: ['name', 'category_id', 'price', 'duration_minutes', 'active'],
    fields: [
      { key: 'name', label: 'Nome do serviço', required: true },
      { key: 'category_id', label: 'Categoria', relation: 'service_categories' },
      { key: 'price', label: 'Preço (R$)', type: 'number', required: true },
      { key: 'duration_minutes', label: 'Duração (minutos)', type: 'number', required: true },
      { key: 'description', label: 'Descrição', type: 'textarea', wide: true },
    ],
  },
  funcionarios: {
    table: 'employees',
    title: 'Equipe',
    singular: 'funcionário',
    subtitle: 'As pessoas que fazem cada atendimento acontecer.',
    columns: ['name', 'position', 'phone', 'email', 'active'],
    fields: [
      { key: 'name', label: 'Nome completo', required: true },
      {
        key: 'position',
        label: 'Função',
        required: true,
        suggestions: alphabetical([
          'Administrador',
          'Atendente',
          'Auxiliar',
          'Caixa',
          'Gerente',
          'Lavador',
          'Polidor',
        ]),
      },
      { key: 'phone', label: 'Telefone', type: 'tel' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'profile_id', label: 'Perfil de acesso (opcional)', relation: 'profiles' },
    ],
  },
  categorias: {
    table: 'service_categories',
    title: 'Categorias de serviços',
    singular: 'categoria',
    subtitle: 'Organize os serviços do catálogo.',
    columns: ['name'],
    fields: [{ key: 'name', label: 'Nome da categoria', required: true }],
  },
};
@Component({
  selector: 'app-catalog',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, Empty, Icon, Modal, Badge],
  template: `
    <div class="page-header">
      <div>
        <span class="eyebrow">CADASTROS</span>
        <h1>{{ config.title }}</h1>
        <p>{{ config.subtitle }}</p>
      </div>
      <button class="button primary" (click)="open()">
        <app-icon name="plus" /> Novo {{ config.singular }}
      </button>
    </div>
    <div class="toolbar">
      <div class="search-field">
        <app-icon name="search" /><input
          aria-label="Pesquisar registros"
          [value]="search()"
          (input)="search.set($any($event.target).value); page.set(1)"
          placeholder="{{
            config.table === 'vehicles'
              ? 'Buscar por placa, cliente ou telefone…'
              : 'Buscar por nome ou dados do cadastro…'
          }}"
        />
      </div>
      @if (config.table !== 'service_categories') {
        <select
          aria-label="Filtrar status"
          [value]="filter()"
          (change)="filter.set($any($event.target).value); page.set(1)"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      }
      <span class="section-kicker">{{ total() }} registros</span>
    </div>
    <section class="panel">
      @if (fetching()) {
        <div class="loading-placeholder" role="status">Buscando registros…</div>
      } @else if (rows().length) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                @for (col of config.columns; track col) {
                  <th>{{ label(col) }}</th>
                }
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row['id']) {
                <tr>
                  @for (col of config.columns; track col) {
                    <td>
                      @if (col === 'price') {
                        {{ numeric(row[col]) | currency: 'BRL' }}
                      } @else if (col === 'active') {
                        <span [class.status-text]="row[col]">{{
                          row[col] ? 'Ativo' : 'Inativo'
                        }}</span>
                      } @else if (col === 'plate') {
                        <span class="plate">{{ row[col] }}</span>
                      } @else {
                        {{ display(row, col) }}
                      }
                    </td>
                  }
                  <td>
                    <div class="row-actions">
                      <button class="button small" (click)="view.set(row)">Ver</button
                      ><button class="button small" (click)="open(row)">Editar</button>
                      @if (config.table !== 'service_categories') {
                        <button class="text-button active-toggle" (click)="confirm.set(row)">
                          {{ row['active'] ? 'Desativar' : 'Ativar' }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <app-empty />
      }
      <div class="pagination">
        <span>Página {{ page() }} de {{ pages() }}</span>
        <div>
          <button class="button small" [disabled]="page() === 1" (click)="page.update(previous)">
            Anterior</button
          ><button class="button small" [disabled]="page() >= pages()" (click)="page.update(next)">
            Próxima
          </button>
          @if (store.truncated().includes(config.table)) {
            <button
              class="button small"
              [disabled]="store.busy()"
              (click)="store.more(config.table)"
            >
              Carregar mais
            </button>
          }
        </div>
      </div>
    </section>
    @if (editing()) {
      <app-modal
        [title]="(editingId() ? 'Editar ' : 'Novo ') + config.singular"
        (dismiss)="editing.set(false)"
        ><form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            @for (field of config.fields; track field.key) {
              <label [attr.for]="'catalog-' + field.key" [class.wide]="field.wide"
                >{{ field.label }}{{ field.required ? ' *' : '' }}
                @if (field.type === 'textarea') {
                  <textarea
                    [id]="'catalog-' + field.key"
                    [formControlName]="field.key"
                    rows="3"
                  ></textarea>
                } @else if (field.relation || field.options) {
                  <select [id]="'catalog-' + field.key" [formControlName]="field.key">
                    <option value="">Selecione</option>
                    @if (field.relation) {
                      @for (option of options(field.relation); track option['id']) {
                        <option [value]="option['id']">{{ option['name'] }}</option>
                      }
                    } @else {
                      @for (option of field.options; track option) {
                        <option [value]="option">{{ option }}</option>
                      }
                    }
                  </select>
                } @else {
                  <input
                    [id]="'catalog-' + field.key"
                    [formControlName]="field.key"
                    [attr.list]="field.suggestions ? 'catalog-options-' + field.key : null"
                    [type]="field.type ?? 'text'"
                    [attr.step]="
                      field.key === 'price' ? '0.01' : field.type === 'number' ? '1' : null
                    "
                    [attr.min]="field.type === 'number' ? 0 : null"
                    [attr.autocomplete]="
                      field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'off'
                    "
                  />
                  @if (field.suggestions) {
                    <datalist [id]="'catalog-options-' + field.key">
                      @for (option of suggestions(field); track option) {
                        <option [value]="option"></option>
                      }
                    </datalist>
                    <small class="help">Escolha uma opção ou digite outra.</small>
                  }
                }
                @if (form.get(field.key)?.invalid && form.get(field.key)?.touched) {
                  <small class="form-error">{{
                    field.key === 'document'
                      ? 'Informe um CPF ou CNPJ válido.'
                      : field.key === 'plate'
                        ? 'Use uma placa válida (ABC1234 ou ABC1D23).'
                        : 'Verifique o formato e preencha corretamente.'
                  }}</small>
                }
              </label>
            }
          </div>
          <p class="help" style="margin-top:16px">
            * Campos obrigatórios.
            @if (config.table === 'services') {
              O novo preço será aplicado somente às próximas ordens.
            }
          </p>
          <div class="form-actions">
            <button type="button" class="button" (click)="editing.set(false)">Cancelar</button
            ><button class="button primary" [disabled]="store.busy()">
              {{ store.busy() ? 'Salvando…' : 'Salvar cadastro' }}
            </button>
          </div>
        </form></app-modal
      >
    }
    @if (view(); as row) {
      <app-modal [title]="'Detalhes do ' + config.singular" (dismiss)="view.set(null)"
        ><div class="modal-content">
          <dl class="details-grid">
            @for (field of config.fields; track field.key) {
              <div>
                <dt>{{ field.label }}</dt>
                <dd>{{ display(row, field.key) }}</dd>
              </div>
            }
            <div>
              <dt>Cadastrado em</dt>
              <dd>{{ text(row['created_at']) | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</dd>
            </div>
          </dl>
          @if (config.table === 'customers' || config.table === 'vehicles') {
            <h3 style="margin:24px 0 15px">Histórico de atendimento</h3>
            @for (order of history(row); track order.id) {
              <div class="cash-summary">
                <span
                  >OS #{{ order.number }} ·
                  {{ order.entered_at | date: 'dd/MM/yyyy' : '-0300' }}</span
                ><app-badge [status]="order.status" /><strong>{{
                  order.total | currency: 'BRL'
                }}</strong>
              </div>
            } @empty {
              <p class="help">Nenhuma ordem no conjunto carregado.</p>
            }
          }
        </div></app-modal
      >
    }
    @if (confirm(); as row) {
      <app-modal title="Confirmar alteração" (dismiss)="confirm.set(null)"
        ><div class="modal-content">
          <p>{{ row['active'] ? 'Desativar' : 'Ativar' }} {{ row['name'] ?? row['plate'] }}?</p>
          <p class="help" style="margin-top:10px">O histórico de atendimento será preservado.</p>
          <div class="form-actions">
            <button class="button" (click)="confirm.set(null)">Voltar</button
            ><button class="button danger" [disabled]="store.busy()" (click)="toggle(row)">
              Confirmar
            </button>
          </div>
        </div></app-modal
      >
    }
  `,
})
export class Catalog implements OnDestroy {
  readonly store = inject(Store);
  readonly route = inject(ActivatedRoute);
  readonly fb = inject(FormBuilder);
  readonly config = CONFIG[this.route.snapshot.routeConfig?.path ?? 'clientes'];
  readonly search = signal('');
  readonly filter = signal('all');
  readonly page = signal(1);
  readonly editing = signal(false);
  readonly editingId = signal<string | undefined>(undefined);
  readonly view = signal<Row | null>(null);
  readonly confirm = signal<Row | null>(null);
  form: FormGroup = this.fb.group({});
  readonly filtered = computed(() => {
    const q = this.searchTerm(this.search()).toLocaleLowerCase('pt-BR');
    return (this.store.db()[this.config.table] as unknown as Row[]).filter((r) => {
      const client =
        this.config.table === 'vehicles'
          ? this.store.db().customers.find((c) => c.id === r['customer_id'])
          : undefined;
      const text =
        Object.values(r).join(' ') + ' ' + (client?.name ?? '') + ' ' + (client?.phone ?? '');
      return (
        text.toLocaleLowerCase('pt-BR').includes(q) &&
        (this.filter() === 'all' || r['active'] === (this.filter() === 'active'))
      );
    });
  });
  readonly serverRows = signal<Row[]>([]);
  readonly serverTotal = signal(0);
  readonly fetching = signal(false);
  readonly total = computed(() =>
    this.store.auth.demo() ? this.filtered().length : this.serverTotal(),
  );
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / 12)));
  readonly rows = computed(() =>
    this.store.auth.demo()
      ? this.filtered().slice((this.page() - 1) * 12, this.page() * 12)
      : this.serverRows(),
  );
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private searchVersion = 0;
  constructor() {
    effect(() => {
      const q = this.search();
      const filter = this.filter();
      const page = this.page();
      this.store.db();
      if (!this.store.auth.demo())
        untracked(() => {
          clearTimeout(this.searchTimer);
          this.searchTimer = setTimeout(() => {
            void this.fetch(q, filter, page);
          }, 250);
        });
    });
  }
  ngOnDestroy() {
    clearTimeout(this.searchTimer);
    this.searchVersion++;
  }
  private async fetch(term: string, activeFilter: string, page: number) {
    const version = ++this.searchVersion;
    this.fetching.set(true);
    try {
      const { data, error } = await this.store.auth.client!.rpc('search_catalog', {
        table_name: this.config.table,
        term: this.searchTerm(term).slice(0, 100),
        active_filter: activeFilter,
        page_number: page,
      });
      if (error) throw error;
      if (version === this.searchVersion) {
        this.serverRows.set(data.rows as Row[]);
        this.serverTotal.set(Number(data.total));
      }
    } catch {
      this.serverRows.set([]);
      this.serverTotal.set(0);
      this.store.failed.set(true);
    } finally {
      if (version === this.searchVersion) this.fetching.set(false);
    }
  }
  readonly previous = (n: number) => n - 1;
  readonly next = (n: number) => n + 1;
  private searchTerm(value: string) {
    return /^[0-9()\s.+-]+$/.test(value)
      ? value.replace(/\D/g, '')
      : value.replace(/^([a-z]{3})[-\s](\d[a-z0-9]\d{2})$/i, '$1$2');
  }
  numeric(value: unknown) {
    return Number(value);
  }
  text(value: unknown) {
    return String(value ?? '');
  }
  label(col: string) {
    return (
      this.config.fields.find((f) => f.key === col)?.label ?? (col === 'active' ? 'Status' : col)
    );
  }
  options(table: Table) {
    return (this.store.db()[table] as unknown as Row[])
      .filter((r) => r['active'] !== false)
      .sort((a, b) =>
        String(a['name'] ?? '').localeCompare(String(b['name'] ?? ''), 'pt-BR', {
          sensitivity: 'base',
        }),
      );
  }
  suggestions(field: Field) {
    const existing = (this.store.db()[this.config.table] as unknown as Row[])
      .map((row) => String(row[field.key] ?? '').trim())
      .filter(Boolean);
    const values = new Map<string, string>();
    for (const value of [...(field.suggestions ?? []), ...existing]) {
      const key = value.toLocaleLowerCase('pt-BR');
      if (!values.has(key)) values.set(key, value);
    }
    return alphabetical([...values.values()]);
  }
  display(row: Row, col: string) {
    if (['phone', 'whatsapp'].includes(col)) return row[col] ? formatPhone(String(row[col])) : '—';
    if (col === 'document') return row[col] ? formatDocument(String(row[col])) : '—';
    if (col === 'customer_id') return this.store.customer(String(row[col]));
    const f = this.config.fields.find((f) => f.key === col);
    if (f?.relation)
      return (
        (this.store.db()[f.relation] as unknown as Row[]).find((r) => r['id'] === row[col])?.[
          'name'
        ] ?? '—'
      );
    return row[col] ?? '—';
  }
  history(row: Row) {
    return this.store
      .db()
      .work_orders.filter((o) =>
        this.config.table === 'customers'
          ? o.customer_id === row['id']
          : o.vehicle_id === row['id'],
      );
  }
  open(row?: Row) {
    this.editingId.set(row ? String(row['id']) : undefined);
    const controls: Record<string, unknown> = {};
    for (const f of this.config.fields) {
      const v = [];
      if (f.required) v.push(Validators.required);
      if (f.key === 'name' || f.key === 'brand' || f.key === 'model' || f.key === 'position')
        v.push(Validators.minLength(2));
      if (f.type === 'email') v.push(Validators.email);
      if (f.key === 'document') v.push(documentValidator);
      if (f.key === 'plate') v.push(Validators.pattern(/^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/));
      if (f.type === 'tel') v.push(phoneValidator);
      if (f.key === 'price') v.push(moneyValidator);
      if (f.key === 'duration_minutes')
        v.push(Validators.min(1), Validators.max(1440), Validators.pattern(/^\d+$/));
      if (f.key === 'year')
        v.push(Validators.min(1900), Validators.max(2200), Validators.pattern(/^\d+$/));
      controls[f.key] = [row?.[f.key] ?? (f.key === 'type' ? 'carro' : ''), v];
    }
    this.form = this.fb.group(controls);
    this.editing.set(true);
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value: Row = { ...this.form.getRawValue() };
    for (const f of this.config.fields) {
      if (value[f.key] === '') value[f.key] = null;
      if (typeof value[f.key] === 'string') value[f.key] = String(value[f.key]).trim();
      if (f.type === 'number' && value[f.key] != null) value[f.key] = Number(value[f.key]);
    }
    if (value['plate']) value['plate'] = String(value['plate']).toUpperCase();
    for (const key of ['phone', 'whatsapp'])
      if (value[key]) value[key] = String(value[key]).replace(/\D/g, '');
    if (value['document']) value['document'] = String(value['document']).replace(/\D/g, '');
    if (!this.editingId() && this.config.table !== 'service_categories') value['active'] = true;
    if (await this.store.save(this.config.table, value, this.editingId())) this.editing.set(false);
  }
  async toggle(row: Row) {
    if (await this.store.save(this.config.table, { active: !row['active'] }, String(row['id'])))
      this.confirm.set(null);
  }
}
