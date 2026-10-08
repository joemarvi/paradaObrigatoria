import { Feedback } from '../shared/feedback';
import { NumericInputDirective } from '../shared/numeric-input';
import { InputMaskDirective } from '../shared/input-mask';
import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { phoneValidator } from '../core/domain';
import { Store } from '../core/store';
import { Auth } from '../core/auth';
import { Profile, Role } from '../core/models';
import { Icon, Modal } from '../shared/ui';
@Component({
  selector: 'app-settings',
  imports: [
    Feedback,
    NumericInputDirective,
    InputMaskDirective,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    Icon,
    Modal,
  ],
  template: `<div class="page-header">
      <div>
        <span class="eyebrow">DO SEU JEITO</span>
        <h1>Configurações</h1>
        <p>Informações do negócio, equipe e parâmetros de atendimento.</p>
      </div>
    </div>
    <div class="settings-layout">
      <section class="panel">
        <div class="panel-header">
          <h2>Dados do lava-jato</h2>
          <app-icon name="settings" />
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label class="wide">Nome do estabelecimento *<input formControlName="name" /></label
            ><label>Telefone<input formControlName="phone" type="tel" /></label
            ><label>WhatsApp<input formControlName="whatsapp" type="tel" /></label
            ><label class="wide">Endereço<input formControlName="address" /></label
            ><label class="wide"
              >Horário de funcionamento *<input formControlName="opening_hours" /></label
            ><label class="wide"
              >Atendimentos simultâneos na agenda *<input
                type="number"
                min="1"
                max="50"
                formControlName="appointment_capacity"
              /><small>Capacidade máxima de agendamentos no mesmo horário.</small></label
            >
          </div>
          @if (error()) {
            <app-feedback [message]="error()" kind="error" (dismissed)="error.set('')" />
          }
          <div class="form-actions">
            <button
              class="button primary"
              [disabled]="store.busy() || !store.db().business_settings.length"
            >
              Salvar configurações
            </button>
          </div>
        </form>
      </section>
      <div class="dashboard-column">
        <section class="panel">
          <div class="panel-header"><h2>Catálogo e equipe</h2></div>
          <div class="panel-body">
            <a routerLink="/admin/servicos" class="quick-link" style="margin-bottom:12px"
              ><app-icon name="wash" /> Serviços e preços<app-icon name="arrow" /></a
            ><a routerLink="/admin/categorias" class="quick-link" style="margin-bottom:12px"
              ><app-icon name="grid" /> Categorias de serviços<app-icon name="arrow" /></a
            ><a routerLink="/admin/funcionarios" class="quick-link"
              ><app-icon name="users" /> Funcionários<app-icon name="arrow"
            /></a>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2>Acesso e segurança</h2>
            <app-icon name="shield" />
          </div>
          <div class="panel-body">
            <p class="help">
              Administrador: acesso total e permissões.<br />Gerente: gestão, equipe e
              relatórios.<br />Atendente: cadastros, agenda, ordens e caixa.<br />Operador: consulta
              da fila e execução dos serviços.
            </p>
            <p class="help" style="margin-top:13px">
              Convide usuários pelo Supabase Auth e vincule um perfil ativo. As permissões são
              verificadas no banco.
            </p>
          </div>
        </section>
      </div>
    </div>
    <section class="panel" style="margin-top:24px">
      <div class="panel-header">
        <h2>Usuários e permissões</h2>
        <small class="help">Contas previamente provisionadas no Supabase</small>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Perfil</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of store.db().profiles; track p.id) {
              <tr>
                <td>{{ p.name }}</td>
                <td>{{ p.role }}</td>
                <td>{{ p.active ? 'Ativo' : 'Inativo' }}</td>
                <td>
                  @if (auth.role() === 'administrador' && p.id !== auth.user()?.id) {
                    <button class="button small" (click)="editProfile(p)">Editar acesso</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  <p class="help">
                    {{
                      auth.demo()
                        ? 'A demonstração não contém contas reais.'
                        : 'Nenhum perfil carregado.'
                    }}
                  </p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel" style="margin-top:24px">
      <div class="panel-header">
        <h2>Auditoria recente</h2>
        <small class="help">Quem fez, o que mudou e quando</small>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Entidade / registro</th>
            </tr>
          </thead>
          <tbody>
            @for (a of store.db().parada_audit_logs.slice(0, 50); track a.id) {
              <tr>
                <td>{{ a.created_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</td>
                <td>{{ actor(a.actor_id) }}</td>
                <td>{{ a.action }}</td>
                <td>
                  {{ a.entity }}<small>{{ a.record_id }}</small>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4"><p class="help">Nenhuma operação registrada.</p></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    @if (profile(); as p) {
      <app-modal title="Editar permissão de acesso" (dismiss)="profile.set(null)"
        ><form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
          <app-feedback kind="warning">
            As mudanças alteram o acesso de {{ p.name }} aos dados do sistema.
          </app-feedback>
          <div class="form-grid">
            <label class="wide">Nome<input formControlName="name" /></label
            ><label class="wide"
              >Perfil<select formControlName="role">
                @for (role of roles; track role) {
                  <option [value]="role">{{ role }}</option>
                }
              </select></label
            ><label class="checkbox wide"
              ><input type="checkbox" formControlName="active" /> Acesso ativo</label
            >
          </div>
          <div class="form-actions">
            <button class="button" type="button" (click)="profile.set(null)">Voltar</button
            ><button class="button primary" [disabled]="store.busy()">
              Confirmar alteração de acesso
            </button>
          </div>
        </form></app-modal
      >
    } `,
})
export class SettingsPage {
  readonly store = inject(Store);
  readonly auth = inject(Auth);
  readonly fb = inject(FormBuilder);
  readonly error = signal('');
  readonly profile = signal<Profile | null>(null);
  readonly roles: Role[] = ['administrador', 'gerente', 'atendente', 'operador'];
  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    role: ['operador'],
    active: [true],
  });
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', phoneValidator],
    whatsapp: ['', phoneValidator],
    address: [''],
    opening_hours: ['', Validators.required],
    appointment_capacity: [
      2,
      [Validators.required, Validators.min(1), Validators.max(50), Validators.pattern(/^\d+$/)],
    ],
  });
  constructor() {
    effect(() => {
      const settings = this.store.db().business_settings[0];
      if (settings)
        this.form.patchValue({
          name: settings.name,
          phone: settings.phone ?? '',
          whatsapp: settings.whatsapp ?? '',
          address: settings.address ?? '',
          opening_hours: settings.opening_hours,
          appointment_capacity: settings.appointment_capacity,
        });
    });
  }
  async save() {
    if (this.form.invalid) {
      this.error.set('Revise os campos obrigatórios, telefones e capacidade da agenda.');
      return;
    }
    this.error.set('');
    const data = this.form.getRawValue();
    data.phone = data.phone.replace(/\D/g, '');
    data.whatsapp = data.whatsapp.replace(/\D/g, '');
    await this.store.save('business_settings', data, this.store.db().business_settings[0]?.id);
  }
  actor(id?: string) {
    return (
      this.store.db().profiles.find((p) => p.id === id)?.name ??
      (this.auth.demo() ? 'Demonstração' : (id ?? 'Sistema'))
    );
  }
  editProfile(p: Profile) {
    this.profile.set(p);
    this.profileForm.reset({ name: p.name, role: p.role, active: p.active });
  }
  async saveProfile() {
    if (this.profileForm.invalid) return;
    if (await this.store.save('profiles', this.profileForm.getRawValue(), this.profile()?.id))
      this.profile.set(null);
  }
}
