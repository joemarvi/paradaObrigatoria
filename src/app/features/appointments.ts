import { environment } from '../core/environment';
import { BookingPayment, bookingPaymentLabel } from '../core/booking-payment';
import { Notifications } from '../core/notifications';
import { Feedback } from '../shared/feedback';
import { NumericInputDirective } from '../shared/numeric-input';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '../core/store';
import { Appointment, AppointmentStatus, STATUS_LABELS } from '../core/models';
import { businessDate, dateTimeToISO } from '../core/domain';
import { Badge, Empty, Icon, Modal } from '../shared/ui';
@Component({
  selector: 'app-appointments',
  imports: [
    Feedback,
    NumericInputDirective,
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    Badge,
    Empty,
    Icon,
    Modal,
  ],
  template: `<div class="page-header">
      <div>
        <span class="eyebrow">PLANEJE O DIA</span>
        <h1>Agendamentos</h1>
        <p>Uma agenda organizada para atender melhor.</p>
      </div>
      <button class="button primary" (click)="open()">
        <app-icon name="plus" /> Novo agendamento
      </button>
    </div>
    <div class="toolbar">
      <div class="filters">
        <input
          type="date"
          aria-label="Data da agenda"
          [value]="date()"
          (change)="date.set($any($event.target).value)"
          style="width:auto"
        /><button class="button" (click)="date.set(today)">Hoje</button>
      </div>
      <div class="tabs">
        <button [class.active]="mode() === 'day'" (click)="mode.set('day')">Dia</button
        ><button [class.active]="mode() === 'week'" (click)="mode.set('week')">Semana</button
        ><button [class.active]="mode() === 'list'" (click)="mode.set('list')">Lista</button>
      </div>
    </div>
    <div class="appointment-status-filters" aria-label="Status dos Agendamentos">
      <button
        class="button"
        [class.primary]="statusFilter() === 'all'"
        (click)="statusFilter.set('all')"
        [attr.aria-pressed]="statusFilter() === 'all'"
      >
        Todos
      </button>
      <button
        class="button"
        [class.primary]="statusFilter() === 'AGENDADO'"
        (click)="statusFilter.set('AGENDADO')"
        [attr.aria-pressed]="statusFilter() === 'AGENDADO'"
      >
        Pendentes <strong>{{ countForDay('AGENDADO') }}</strong>
      </button>
      <button
        class="button"
        [class.primary]="statusFilter() === 'CONFIRMADO'"
        (click)="statusFilter.set('CONFIRMADO')"
        [attr.aria-pressed]="statusFilter() === 'CONFIRMADO'"
      >
        Confirmados <strong>{{ countForDay('CONFIRMADO') }}</strong>
      </button>
      <button
        class="button"
        [class.primary]="statusFilter() === 'CANCELADO'"
        (click)="statusFilter.set('CANCELADO')"
        [attr.aria-pressed]="statusFilter() === 'CANCELADO'"
      >
        Cancelados <strong>{{ countForDay('CANCELADO') }}</strong>
      </button>
    </div>
    <p class="help appointment-day-summary">
      Contagens do dia selecionado, no horário de Brasília.
    </p>
    <section class="panel">
      @if (mode() === 'week') {
        <div class="calendar-week">
          @for (day of week(); track day) {
            <section class="calendar-day">
              <header>
                <small>{{ day + 'T12:00:00-03:00' | date: 'EEE' : '-0300' }}</small
                ><strong>{{ day + 'T12:00:00-03:00' | date: 'dd/MM' : '-0300' }}</strong>
              </header>
              @for (a of forDay(day); track a.id) {
                <button
                  class="calendar-event"
                  style="border:0;text-align:left;width:calc(100% - 18px)"
                  (click)="open(a)"
                >
                  <strong
                    >{{ a.starts_at | date: 'HH:mm' : '-0300' }} ·
                    {{ store.plate(a.vehicle_id) }}</strong
                  >{{ store.customer(a.customer_id) }}<br /><app-badge [status]="a.status" />
                </button>
              }
            </section>
          }
        </div>
      } @else {
        <div class="panel-header">
          <div>
            <h2>{{ mode() === 'day' ? 'Agenda do dia' : 'Todos os agendamentos carregados' }}</h2>
            <p>{{ shown().length }} agendamentos</p>
          </div>
        </div>
        @for (a of shown(); track a.id) {
          <article class="appointment-item">
            <div class="appointment-time">
              {{ a.starts_at | date: 'HH:mm' : '-0300' }}
              @if (mode() === 'list') {
                <small style="display:block;margin-top:5px">{{
                  a.starts_at | date: 'dd/MM' : '-0300'
                }}</small>
              }
            </div>
            <div class="appointment-detail">
              <strong>{{ store.plate(a.vehicle_id) }} · {{ store.vehicle(a.vehicle_id) }}</strong>
              <p>
                {{ store.customer(a.customer_id) }} · {{ service(a.service_id) }} ·
                {{ a.duration_minutes }} min
              </p>
              <app-badge [status]="a.status" />
              @if (paymentFor(a.id); as payment) {
                <p class="portal-payment-status">{{ paymentLabel(payment) }}</p>
                <p class="help">
                  {{ payment.method }} · {{ payment.amount | currency: 'BRL' }} ·
                  {{ payment.live_mode ? 'Cobrança Real' : 'Simulação de Teste' }}
                </p>
              }
            </div>
            @if (a.status === 'AGENDADO' && paymentFor(a.id)?.status !== 'PENDING') {
              <button
                class="button small primary"
                (click)="confirmation.set(a)"
                [disabled]="store.busy()"
              >
                Confirmar
              </button>
            }
            <button class="button small" (click)="open(a)">Editar / remarcar</button>
          </article>
        } @empty {
          <app-empty
            title="Agenda livre"
            description="Nenhum agendamento para esta visualização."
          />
        }
      }
    </section>
    @if (store.truncated().includes('appointments')) {
      <button class="button" style="margin-top:16px" (click)="store.more('appointments')">
        Carregar mais
      </button>
    }
    @if (editing()) {
      <app-modal
        [title]="editingId() ? 'Editar agendamento' : 'Novo agendamento'"
        (dismiss)="editing.set(false)"
        ><form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label class="wide"
              >Veículo / cliente *<select formControlName="vehicle_id">
                <option value="">Selecione</option>
                @for (v of store.db().vehicles; track v.id) {
                  @if (v.active) {
                    <option [value]="v.id">
                      {{ v.plate }} · {{ store.customer(v.customer_id) }}
                    </option>
                  }
                }
              </select></label
            ><label
              >Serviço *<select formControlName="service_id" (change)="setDuration()">
                <option value="">Selecione</option>
                @for (s of store.db().services; track s.id) {
                  @if (s.active) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                }
              </select></label
            ><label
              >Duração (minutos) *<input
                type="number"
                min="1"
                max="1440"
                step="1"
                formControlName="duration_minutes" /></label
            ><label
              >Data e horário *<input type="datetime-local" formControlName="starts_at" /></label
            ><label
              >Status<select formControlName="status">
                @for (status of statuses; track status) {
                  <option [value]="status">{{ labels[status] }}</option>
                }
              </select></label
            ><label class="wide">Observações<textarea formControlName="notes"></textarea></label>
          </div>
          @if (error()) {
            <app-feedback [message]="error()" kind="error" (dismissed)="error.set('')" />
          }
          <p class="help" style="margin-top:15px">
            Horários no fuso de Brasília. A capacidade do horário é validada pelo banco.
          </p>
          <div class="form-actions">
            <button type="button" class="button" (click)="editing.set(false)">Voltar</button>
            @if (editingId()) {
              <button type="button" class="button danger" (click)="confirmCancel.set(true)">
                Cancelar agendamento
              </button>
            }
            <button class="button primary" [disabled]="store.busy()">Salvar agendamento</button>
          </div>
        </form></app-modal
      >
    }
    @if (confirmation(); as appointment) {
      <app-modal title="Confirmar Agendamento" (dismiss)="confirmation.set(null)"
        ><div class="modal-content">
          <p>
            Confirmar o atendimento de {{ store.customer(appointment.customer_id) }} em
            {{ appointment.starts_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}?
          </p>
          <div class="form-actions">
            <button class="button" (click)="confirmation.set(null)">Voltar</button
            ><button
              class="button primary"
              (click)="confirmAppointment()"
              [disabled]="store.busy()"
            >
              Confirmar Agendamento
            </button>
          </div>
        </div></app-modal
      >
    }
    @if (confirmCancel()) {
      <app-modal title="Confirmar cancelamento" (dismiss)="confirmCancel.set(false)"
        ><div class="modal-content">
          <p>Deseja cancelar este agendamento?</p>
          @if (paymentFor(editingId() || '')?.status === 'APPROVED') {
            <p>
              O cancelamento não reembolsa o pagamento automaticamente. Revise o pagamento no
              Mercado Pago e providencie o reembolso aplicável.
            </p>
          }
          <div class="form-actions">
            <button class="button" (click)="confirmCancel.set(false)">Voltar</button
            ><button class="button danger" [disabled]="store.busy()" (click)="cancelAppointment()">
              Confirmar cancelamento
            </button>
          </div>
        </div></app-modal
      >
    } `,
})
export class Appointments {
  readonly payments = signal<BookingPayment[]>([]);
  readonly paymentLabel = bookingPaymentLabel;
  paymentFor(id: string) {
    return this.payments().find((p) => p.appointment_id === id);
  }
  constructor() {
    effect((onCleanup) => {
      const ids = this.store.db().appointments.map((a) => a.id);
      if (!environment.onlinePayments || !this.store.auth.client || !ids.length) return;
      let current = true;
      onCleanup(() => {
        current = false;
      });
      void this.store.auth.client
        .from('appointment_payments')
        .select('appointment_id,method,amount,status,expires_at,live_mode')
        .in('appointment_id', ids)
        .then(({ data, error }) => {
          if (!current) return;
          if (error)
            this.notices.show(
              'Não foi possível consultar os pagamentos online. Atualize a agenda antes de confirmar.',
              true,
            );
          else this.payments.set(data as BookingPayment[]);
        });
    });
  }
  readonly notices = inject(Notifications);
  readonly store = inject(Store);
  readonly fb = inject(FormBuilder);
  readonly today = businessDate();
  readonly date = signal(this.today);
  readonly mode = signal('day');
  readonly statusFilter = signal<AppointmentStatus | 'all'>('all');
  readonly confirmation = signal<Appointment | null>(null);
  readonly editing = signal(false);
  readonly editingId = signal<string | undefined>(undefined);
  readonly error = signal('');
  readonly confirmCancel = signal(false);
  readonly labels = STATUS_LABELS;
  readonly statuses: AppointmentStatus[] = [
    'AGENDADO',
    'CONFIRMADO',
    'EM_ATENDIMENTO',
    'CONCLUIDO',
    'CANCELADO',
    'NAO_COMPARECEU',
  ];
  readonly form = this.fb.nonNullable.group({
    vehicle_id: ['', Validators.required],
    service_id: ['', Validators.required],
    duration_minutes: [
      60,
      [Validators.required, Validators.min(1), Validators.max(1440), Validators.pattern(/^\d+$/)],
    ],
    starts_at: ['', Validators.required],
    status: ['AGENDADO'],
    notes: [''],
  });
  readonly shown = computed(() =>
    [...this.store.db().appointments]
      .filter((a) => this.mode() === 'list' || businessDate(a.starts_at) === this.date())
      .filter((a) => this.statusFilter() === 'all' || a.status === this.statusFilter())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  );
  readonly week = computed(() => {
    const start = new Date(this.date() + 'T12:00:00-03:00');
    const day = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return businessDate(d);
    });
  });
  countForDay(status: AppointmentStatus) {
    return this.store
      .db()
      .appointments.filter((a) => businessDate(a.starts_at) === this.date() && a.status === status)
      .length;
  }
  async confirmAppointment() {
    const selected = this.confirmation();
    if (!selected) return;
    const current = this.store.db().appointments.find((a) => a.id === selected.id);
    if (!current || current.status !== 'AGENDADO') {
      this.confirmation.set(null);
      this.notices.show('Este agendamento não está mais pendente. Atualize a agenda.', true);
      return;
    }
    if (await this.store.save('appointments', { status: 'CONFIRMADO' }, selected.id))
      this.confirmation.set(null);
  }
  forDay(day: string) {
    return this.store
      .db()
      .appointments.filter((a) => businessDate(a.starts_at) === day)
      .filter((a) => this.statusFilter() === 'all' || a.status === this.statusFilter())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  service(id: string) {
    return this.store.db().services.find((s) => s.id === id)?.name ?? 'Serviço não carregado';
  }
  open(a?: Appointment) {
    this.editingId.set(a?.id);
    this.error.set('');
    const local = a
      ? new Date(new Date(a.starts_at).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
      : this.date() + 'T09:00';
    this.form.reset(
      a
        ? { ...a, starts_at: local }
        : {
            vehicle_id: '',
            service_id: '',
            duration_minutes: 60,
            starts_at: local,
            status: 'AGENDADO',
            notes: '',
          },
    );
    this.editing.set(true);
  }
  setDuration() {
    const s = this.store.db().services.find((s) => s.id === this.form.controls.service_id.value);
    if (s) this.form.controls.duration_minutes.setValue(s.duration_minutes);
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Selecione veículo, serviço e informe data e duração válidas.');
      return;
    }
    const f = this.form.getRawValue();
    const v = this.store.db().vehicles.find((v) => v.id === f.vehicle_id);
    if (!v) {
      this.error.set('Selecione um veículo válido.');
      return;
    }
    if (!this.editingId() && new Date(dateTimeToISO(f.starts_at)).getTime() < Date.now()) {
      this.error.set('Escolha um horário futuro.');
      return;
    }
    if (this.store.auth.demo() && ['AGENDADO', 'CONFIRMADO', 'EM_ATENDIMENTO'].includes(f.status)) {
      const start = new Date(dateTimeToISO(f.starts_at)).getTime();
      const end = start + f.duration_minutes * 60000;
      const active = this.store
        .db()
        .appointments.filter(
          (a) =>
            a.id !== this.editingId() &&
            ['AGENDADO', 'CONFIRMADO', 'EM_ATENDIMENTO'].includes(a.status),
        );
      const boundaries = [
        start,
        ...active.map((a) => new Date(a.starts_at).getTime()).filter((t) => t >= start && t < end),
      ];
      const capacity = this.store.db().business_settings[0]?.appointment_capacity ?? 2;
      if (
        boundaries.some(
          (t) =>
            active.filter(
              (a) =>
                new Date(a.starts_at).getTime() <= t &&
                new Date(a.starts_at).getTime() + a.duration_minutes * 60000 > t,
            ).length >= capacity,
        )
      ) {
        this.error.set('Horário sem disponibilidade. Escolha outro horário.');
        return;
      }
    }
    if (
      await this.store.save(
        'appointments',
        { ...f, customer_id: v.customer_id, starts_at: dateTimeToISO(f.starts_at) },
        this.editingId(),
      )
    )
      this.editing.set(false);
  }
  async cancelAppointment() {
    if (await this.store.save('appointments', { status: 'CANCELADO' }, this.editingId())) {
      this.editing.set(false);
      this.confirmCancel.set(false);
    }
  }
}
