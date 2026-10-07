import { NumericInputDirective } from '../shared/numeric-input';
import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store, Row } from '../core/store';
import { Auth } from '../core/auth';
import { WorkOrder, OrderStatus, STATUS_LABELS } from '../core/models';
import { dateTimeToISO, moneyValidator, minutesWaiting, orderTotal } from '../core/domain';
import { Badge, Empty, Icon, Modal } from '../shared/ui';
import { Notifications } from '../core/notifications';
@Component({
  selector: 'app-orders',
  imports: [
    NumericInputDirective,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    Badge,
    Empty,
    Icon,
    Modal,
  ],
  template: `
    <div class="page-header">
      <div>
        <span class="eyebrow">ATENDIMENTO E SERVIÇOS</span>
        <h1>{{ queue ? 'Fila de atendimento' : 'Ordens de serviço' }}</h1>
        <p>Da chegada à entrega, cada veículo no seu lugar.</p>
      </div>
      <div class="header-actions">
        <button class="button" [disabled]="store.loading()" (click)="store.load()">
          Atualizar
        </button>
        @if (auth.role() !== 'operador') {
          <button class="button primary" (click)="openEntry()">
            <app-icon name="plus" /> Nova entrada
          </button>
        }
      </div>
    </div>
    <div class="toolbar">
      <div class="search-field">
        <app-icon name="search" /><input
          aria-label="Buscar ordem"
          placeholder="Buscar placa, cliente ou número da OS…"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </div>
      @if (!queue) {
        <div class="tabs">
          <button [class.active]="mode() === 'board'" (click)="mode.set('board')">Quadro</button
          ><button [class.active]="mode() === 'list'" (click)="mode.set('list')">Histórico</button>
        </div>
      }
    </div>
    @if (mode() === 'board' || queue) {
      <div class="kanban">
        @for (status of columns; track status) {
          <section class="kanban-column">
            <div class="kanban-heading">
              <h3>{{ labels[status] }}</h3>
              <span>{{ byStatus(status).length }}</span>
            </div>
            @for (order of byStatus(status); track order.id) {
              <article class="order-card">
                <div class="order-card-top">
                  <span class="plate">{{ store.plate(order.vehicle_id) }}</span
                  ><span class="section-kicker">#{{ order.number }}</span>
                </div>
                <h3>{{ store.vehicle(order.vehicle_id) }}</h3>
                <p>{{ store.customer(order.customer_id) }}</p>
                <div class="services">{{ itemNames(order.id) }}</div>
                <div class="order-card-meta">
                  <span>Entrada {{ order.entered_at | date: 'HH:mm' : '-0300' }}</span
                  ><span>{{ waiting(order.entered_at) }} min</span>
                </div>
                <div class="order-card-meta">
                  <span>{{ store.employee(order.employee_id) }}</span
                  ><span
                    >Prev.
                    {{
                      order.expected_at ? (order.expected_at | date: 'HH:mm' : '-0300') : '—'
                    }}</span
                  >
                </div>
                <button class="button small" (click)="detail.set(order)">
                  Ver detalhes · {{ order.total | currency: 'BRL' }}
                </button>
                @if (status === 'AGUARDANDO') {
                  <button
                    class="button primary small"
                    [disabled]="store.busy()"
                    (click)="transition(order, 'EM_SERVICO')"
                  >
                    Iniciar serviço<app-icon name="arrow" />
                  </button>
                } @else if (status === 'EM_SERVICO') {
                  <button
                    class="button primary small"
                    [disabled]="store.busy()"
                    (click)="transition(order, 'AGUARDANDO_PAGAMENTO')"
                  >
                    Serviço concluído<app-icon name="check" />
                  </button>
                } @else if (auth.role() !== 'operador') {
                  <a class="button primary small" routerLink="/admin/pagamentos"
                    >Receber pagamento<app-icon name="cash"
                  /></a>
                }
              </article>
            } @empty {
              <app-empty title="Tudo em dia" description="Nenhum veículo nesta etapa." />
            }
          </section>
        }
      </div>
    } @else {
      <section class="panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>OS / entrada</th>
                <th>Veículo</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (order of filtered(); track order.id) {
                <tr>
                  <td>
                    <strong>#{{ order.number }}</strong
                    ><small>{{ order.entered_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</small>
                  </td>
                  <td>
                    <span class="plate">{{ store.plate(order.vehicle_id) }}</span
                    ><small>{{ store.vehicle(order.vehicle_id) }}</small>
                  </td>
                  <td>{{ store.customer(order.customer_id) }}</td>
                  <td><app-badge [status]="order.status" /></td>
                  <td>{{ order.total | currency: 'BRL' }}</td>
                  <td>
                    <button class="button small" (click)="detail.set(order)">Detalhes</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6"><app-empty /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    @if (store.truncated().includes('work_orders')) {
      <button class="button" style="margin-top:16px" (click)="store.more('work_orders')">
        Carregar mais ordens
      </button>
    }
    @if (entry()) {
      <app-modal title="Registrar entrada de veículo" (dismiss)="entry.set(false)"
        ><form [formGroup]="form" (ngSubmit)="create()">
          <div class="form-grid">
            <label
              >Veículo / placa *<select formControlName="vehicle_id" (change)="selectVehicle()">
                <option value="">Selecione um veículo</option>
                @for (v of store.db().vehicles; track v.id) {
                  @if (v.active) {
                    <option [value]="v.id">
                      {{ v.plate }} · {{ v.brand }} {{ v.model }} ·
                      {{ store.customer(v.customer_id) }}
                    </option>
                  }
                }
              </select></label
            ><label
              >Funcionário responsável<select formControlName="employee_id">
                <option value="">Definir depois</option>
                @for (e of store.db().employees; track e.id) {
                  @if (e.active) {
                    <option [value]="e.id">{{ e.name }}</option>
                  }
                }
              </select></label
            >
            <p class="help wide">
              Cliente: {{ selectedCustomer() }} ·
              <a routerLink="/admin/clientes" (click)="entry.set(false)">Cadastrar cliente</a> ·
              <a routerLink="/admin/veiculos" (click)="entry.set(false)">Cadastrar veículo</a>
            </p>
            <div class="wide">
              <div class="field-label" style="margin-bottom:10px">Serviços solicitados *</div>
              <div class="checkbox-list">
                @for (s of store.db().services; track s.id) {
                  @if (s.active) {
                    <label class="checkbox"
                      ><input
                        type="checkbox"
                        [checked]="selectedServices().includes(s.id)"
                        (change)="toggleService(s.id)"
                      /><span
                        >{{ s.name
                        }}<small
                          >{{ s.price | currency: 'BRL' }} · {{ s.duration_minutes }} min</small
                        ></span
                      ></label
                    >
                  }
                }
              </div>
            </div>
            <label
              >Previsão de conclusão<input
                type="datetime-local"
                formControlName="expected_at" /></label
            ><label
              >Combustível<select formControlName="fuel_level">
                <option value="">Não informado</option>
                <option>Reserva</option>
                <option>1/4</option>
                <option>1/2</option>
                <option>3/4</option>
                <option>Cheio</option>
              </select></label
            ><label
              >Estado aparente<input
                formControlName="vehicle_condition"
                placeholder="Riscos, avarias, condições…" /></label
            ><label
              >Objetos deixados no veículo<input
                formControlName="belongings"
                placeholder="Acessórios e objetos…" /></label
            ><label
              >Desconto (R$)<input
                type="number"
                step="0.01"
                min="0"
                formControlName="discount" /></label
            ><label
              >Acréscimo (R$)<input
                type="number"
                step="0.01"
                min="0"
                formControlName="surcharge" /></label
            ><label class="wide"
              >Produto adicional (opcional)<input
                formControlName="product_name"
                placeholder="Ex.: aromatizador" /></label
            ><label
              >Quantidade de produtos<input
                type="number"
                min="1"
                step="1"
                formControlName="product_quantity" /></label
            ><label
              >Preço unitário do produto (R$)<input
                type="number"
                min="0"
                step="0.01"
                formControlName="product_price" /></label
            ><label class="wide"
              >Observações<textarea
                formControlName="notes"
                rows="2"
                placeholder="Detalhes importantes para a equipe"
              ></textarea>
            </label>
          </div>
          <div class="summary-total">
            <span>Valor estimado</span><strong>{{ estimated() | currency: 'BRL' }}</strong>
          </div>
          @if (formError()) {
            <p class="form-error" role="alert">{{ formError() }}</p>
          }
          <div class="form-actions">
            <button type="button" class="button" (click)="entry.set(false)">Cancelar</button
            ><button class="button primary" [disabled]="store.busy()">
              {{ store.busy() ? 'Registrando…' : 'Registrar entrada' }}
            </button>
          </div>
        </form></app-modal
      >
    }
    @if (detail(); as order) {
      <app-modal [title]="'Ordem de serviço #' + order.number" (dismiss)="detail.set(null)"
        ><div class="modal-content">
          <app-badge [status]="order.status" />
          <dl class="details-grid" style="margin-top:20px">
            <div>
              <dt>Veículo</dt>
              <dd>{{ store.plate(order.vehicle_id) }} · {{ store.vehicle(order.vehicle_id) }}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{{ store.customer(order.customer_id) }}</dd>
            </div>
            <div>
              <dt>Entrada</dt>
              <dd>{{ order.entered_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{{ store.employee(order.employee_id) }}</dd>
              @if (
                auth.role() !== 'operador' && ['AGUARDANDO', 'EM_SERVICO'].includes(order.status)
              ) {
                <select
                  aria-label="Atribuir funcionário"
                  (change)="assign(order, $any($event.target).value)"
                >
                  <option value="">Atribuir funcionário</option>
                  @for (e of store.db().employees; track e.id) {
                    @if (e.active) {
                      <option [value]="e.id">{{ e.name }}</option>
                    }
                  }
                </select>
              }
            </div>
            <div>
              <dt>Conclusão</dt>
              <dd>
                {{
                  order.completed_at
                    ? (order.completed_at | date: 'dd/MM/yyyy HH:mm' : '-0300')
                    : '—'
                }}
              </dd>
            </div>
            <div>
              <dt>Saída</dt>
              <dd>
                {{
                  order.exited_at
                    ? (order.exited_at | date: 'dd/MM/yyyy HH:mm' : '-0300')
                    : 'Não registrada'
                }}
              </dd>
            </div>
            <div>
              <dt>Combustível / estado aparente</dt>
              <dd>{{ order.fuel_level ?? '—' }} · {{ order.vehicle_condition ?? '—' }}</dd>
            </div>
            <div>
              <dt>Objetos e observações</dt>
              <dd>{{ order.belongings ?? '—' }} · {{ order.notes ?? '—' }}</dd>
            </div>
          </dl>
          <h3 style="margin:22px 0 8px">Serviços e produtos</h3>
          @for (i of store.items(order.id); track i.id) {
            <div class="cash-summary">
              <span>{{ i.quantity }} × {{ i.name }}</span
              ><strong>{{ i.unit_price * i.quantity | currency: 'BRL' }}</strong>
            </div>
          }
          <div class="cash-summary">
            <span>Desconto / acréscimo</span
            ><strong
              >− {{ order.discount | currency: 'BRL' }} / +
              {{ order.surcharge | currency: 'BRL' }}</strong
            >
          </div>
          <div class="summary-total">
            <span>Total</span><strong>{{ order.total | currency: 'BRL' }}</strong>
          </div>
          <div class="form-actions">
            @if (
              auth.role() !== 'operador' && ['AGUARDANDO', 'EM_SERVICO'].includes(order.status)
            ) {
              <button class="button danger" (click)="cancel.set(order); detail.set(null)">
                Cancelar OS
              </button>
            }
            @if (auth.role() !== 'operador' && order.status === 'FINALIZADO' && !order.exited_at) {
              <button class="button primary" (click)="release(order)" [disabled]="store.busy()">
                Registrar saída
              </button>
            }
            <button class="button" (click)="detail.set(null)">Fechar</button>
          </div>
        </div></app-modal
      >
    }
    @if (cancel(); as order) {
      <app-modal title="Cancelar ordem de serviço" (dismiss)="cancel.set(null)"
        ><div class="modal-content">
          <p>Cancelar a OS #{{ order.number }} de {{ store.plate(order.vehicle_id) }}?</p>
          <p class="help" style="margin-top:10px">A ordem ficará no histórico como cancelada.</p>
          <div class="form-actions">
            <button class="button" (click)="cancel.set(null)">Voltar</button
            ><button
              class="button danger"
              [disabled]="store.busy()"
              (click)="transition(order, 'CANCELADO'); cancel.set(null)"
            >
              Confirmar cancelamento
            </button>
          </div>
        </div></app-modal
      >
    }
  `,
})
export class Orders {
  readonly store = inject(Store);
  readonly auth = inject(Auth);
  readonly route = inject(ActivatedRoute);
  readonly fb = inject(FormBuilder);
  readonly notices = inject(Notifications);
  readonly queue = this.route.snapshot.routeConfig?.path === 'fila';
  readonly labels = STATUS_LABELS;
  readonly columns: OrderStatus[] = ['AGUARDANDO', 'EM_SERVICO', 'AGUARDANDO_PAGAMENTO'];
  readonly waiting = minutesWaiting;
  readonly search = signal('');
  readonly mode = signal('board');
  readonly entry = signal(false);
  readonly detail = signal<WorkOrder | null>(null);
  readonly cancel = signal<WorkOrder | null>(null);
  readonly selectedServices = signal<string[]>([]);
  readonly formError = signal('');
  readonly selectedCustomer = signal('Selecione um veículo');
  readonly estimated = signal(0);
  readonly form = this.fb.nonNullable.group({
    vehicle_id: ['', Validators.required],
    employee_id: [''],
    expected_at: [''],
    fuel_level: [''],
    vehicle_condition: [''],
    belongings: [''],
    discount: [0, moneyValidator],
    surcharge: [0, moneyValidator],
    notes: [''],
    product_name: [''],
    product_quantity: [1, [Validators.min(1), Validators.pattern(/^\d+$/)]],
    product_price: [0, moneyValidator],
  });
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.store
      .db()
      .work_orders.filter((o) =>
        (
          String(o.number) +
          ' ' +
          this.store.plate(o.vehicle_id) +
          ' ' +
          this.store.customer(o.customer_id)
        )
          .toLowerCase()
          .includes(q),
      );
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.calculate());
  }
  byStatus(status: OrderStatus) {
    return this.filtered().filter((o) => o.status === status);
  }
  itemNames(id: string) {
    return (
      this.store
        .items(id)
        .map((i) => i.name)
        .join(' · ') || 'Detalhes não carregados'
    );
  }
  openEntry() {
    this.form.reset({ discount: 0, surcharge: 0, product_quantity: 1, product_price: 0 });
    this.selectedServices.set([]);
    this.formError.set('');
    this.selectedCustomer.set('Selecione um veículo');
    this.entry.set(true);
  }
  selectVehicle() {
    const v = this.store.db().vehicles.find((v) => v.id === this.form.controls.vehicle_id.value);
    this.selectedCustomer.set(v ? this.store.customer(v.customer_id) : 'Selecione um veículo');
  }
  toggleService(id: string) {
    this.selectedServices.update((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
    this.calculate();
  }
  calculate() {
    const f = this.form.getRawValue();
    try {
      const items = this.store
        .db()
        .services.filter((s) => this.selectedServices().includes(s.id))
        .map((s) => ({ quantity: 1, unit_price: Number(s.price) }));
      if (f.product_name.trim())
        items.push({ quantity: Number(f.product_quantity), unit_price: Number(f.product_price) });
      this.estimated.set(orderTotal(items, Number(f.discount), Number(f.surcharge)));
      this.formError.set('');
    } catch (e) {
      this.formError.set((e as Error).message);
    }
  }
  async create() {
    this.form.markAllAsTouched();
    this.calculate();
    if (this.form.invalid || !this.selectedServices().length || this.formError()) {
      this.formError.set(
        this.formError() || 'Selecione um veículo e pelo menos um serviço. Revise os valores.',
      );
      return;
    }
    const f = this.form.getRawValue();
    if (f.expected_at && new Date(dateTimeToISO(f.expected_at)).getTime() < Date.now()) {
      this.formError.set('A previsão de conclusão deve ser futura.');
      return;
    }
    const vehicle = this.store.db().vehicles.find((v) => v.id === f.vehicle_id);
    const payload: Row = {
      ...f,
      customer_id: vehicle?.customer_id,
      employee_id: f.employee_id || null,
      expected_at: f.expected_at ? dateTimeToISO(f.expected_at) : null,
      service_ids: this.selectedServices(),
      products: f.product_name.trim()
        ? [
            {
              name: f.product_name.trim(),
              quantity: Number(f.product_quantity),
              unit_price: Number(f.product_price),
            },
          ]
        : [],
    };
    if (await this.store.rpc('create_work_order', { payload })) this.entry.set(false);
  }
  async transition(order: WorkOrder, status: OrderStatus) {
    await this.store.rpc('transition_order', { order_id: order.id, next_status: status });
  }
  async assign(order: WorkOrder, id: string) {
    if (!id) return;
    if (await this.store.rpc('assign_order_employee', { order_id: order.id, employee_id: id }))
      this.detail.set(this.store.db().work_orders.find((o) => o.id === order.id) ?? null);
  }
  async release(order: WorkOrder) {
    if (await this.store.rpc('release_vehicle', { order_id: order.id })) this.detail.set(null);
  }
}
