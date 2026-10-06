import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { alphabetical, VEHICLE_BRANDS, VEHICLE_COLORS } from '../core/vehicle-options';
import { Auth } from '../core/auth';
import { Appointment, Service, Vehicle, STATUS_LABELS } from '../core/models';
import { dateTimeToISO, phoneValidator } from '../core/domain';
import { friendlyError } from '../core/notifications';
@Component({
  selector: 'app-customer-portal',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
  template: `<main class="customer-portal">
    <header class="portal-header">
      <a routerLink="/" class="brand"
        ><img
          class="brand-logo"
          src="brand-logo.png"
          alt="Parada Obrigatória"
          width="64"
          height="64"
        /><strong>Área do cliente</strong></a
      >
      @if (auth.user()) {
        <button class="button small" (click)="logout()" [disabled]="busy()">Sair</button>
      }
    </header>
    @if (error()) {
      <p class="alert form-error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert success" role="status">{{ message() }}</p>
    }
    @if (!auth.initialized() || loading()) {
      <p role="status">Carregando…</p>
    } @else if (!auth.customer()) {
      <section class="panel portal-card">
        <h1>Complete seu cadastro</h1>
        <p>Informe seus dados para liberar seus agendamentos.</p>
        <form [formGroup]="accessForm" (ngSubmit)="complete()">
          <label
            >Nome completo<input formControlName="name" maxlength="120" autocomplete="name"
          /></label>
          <label>Telefone<input type="tel" formControlName="phone" autocomplete="tel" /></label>
          <button class="button primary" [disabled]="busy()">Salvar cadastro</button>
        </form>
      </section>
    } @else {
      <div class="page-header">
        <div>
          <span class="eyebrow">BEM-VINDO</span>
          <h1>Olá, {{ auth.name() }}</h1>
          <p>Cadastre seu veículo e escolha o próximo cuidado.</p>
        </div>
        <button class="button" (click)="refresh()" [disabled]="busy()">Atualizar</button>
      </div>
      <div class="portal-grid">
        <section class="panel portal-section">
          <h2>Meus veículos</h2>
          @for (v of vehicles(); track v.id) {
            <p>
              <strong>{{ v.plate }}</strong> · {{ v.brand }} {{ v.model }}
            </p>
          } @empty {
            <p class="help">Cadastre um veículo para agendar.</p>
          }
          <button type="button" class="text-button" (click)="addingVehicle.set(!addingVehicle())">
            {{ addingVehicle() ? 'Fechar cadastro' : 'Adicionar veículo' }}
          </button>
          @if (addingVehicle()) {
            <form [formGroup]="vehicleForm" (ngSubmit)="addVehicle()">
              <label
                >Placa<input formControlName="plate" maxlength="8" placeholder="ABC1D23"
              /></label>
              <label
                >Marca<input formControlName="brand" list="portal-brands" maxlength="80"
              /></label>
              <datalist id="portal-brands">
                @for (brand of brands; track brand) {
                  <option [value]="brand"></option>
                }
              </datalist>
              <label>Modelo<input formControlName="model" maxlength="100" /></label>
              <label
                >Cor<input formControlName="color" list="portal-colors" maxlength="50"
              /></label>
              <datalist id="portal-colors">
                @for (color of colors; track color) {
                  <option [value]="color"></option>
                }
              </datalist>
              <label
                >Tipo<select formControlName="type">
                  @for (type of types; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select></label
              >
              <button class="button primary" [disabled]="busy()">Salvar veículo</button>
            </form>
          }
        </section>
        <section class="panel portal-section">
          <h2>Novo agendamento</h2>
          <form [formGroup]="bookingForm" (ngSubmit)="book()">
            <label
              >Veículo<select formControlName="vehicle_id">
                <option value="">Selecione</option>
                @for (v of vehicles(); track v.id) {
                  <option [value]="v.id">{{ v.plate }} · {{ v.model }}</option>
                }
              </select></label
            >
            <label
              >Serviço<select formControlName="service_id">
                <option value="">Selecione</option>
                @for (s of services(); track s.id) {
                  <option [value]="s.id">
                    {{ s.name }} · {{ s.price | currency: 'BRL' }} · {{ s.duration_minutes }} min
                  </option>
                }
              </select></label
            >
            <label
              >Data e horário<input
                type="datetime-local"
                formControlName="starts_at"
                [min]="minimumDate"
            /></label>
            <label
              >Observações<textarea formControlName="notes" maxlength="1000" rows="2"></textarea>
            </label>
            <p class="help">
              Horários no fuso de Brasília. A disponibilidade será verificada ao agendar.
            </p>
            @if (!services().length) {
              <p class="help">Nenhum serviço disponível para agendar.</p>
            }
            <button
              class="button primary full"
              [disabled]="busy() || !vehicles().length || !services().length"
            >
              Agendar atendimento
            </button>
          </form>
        </section>
      </div>
      <section class="panel portal-section">
        <h2>Meus agendamentos</h2>
        @for (a of appointments(); track a.id) {
          <article class="portal-appointment">
            <div>
              <strong>{{ a.starts_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</strong>
              <p>{{ vehicleName(a.vehicle_id) }} · {{ serviceName(a.service_id) }}</p>
              <span>{{ labels[a.status] }}</span>
            </div>
            @if (canCancel(a)) {
              <button
                class="button small danger"
                [disabled]="busy()"
                (click)="cancelTarget.set(a.id)"
              >
                Cancelar
              </button>
            }
            @if (cancelTarget() === a.id) {
              <div>
                <p>Confirmar cancelamento?</p>
                <button class="button small" (click)="cancelTarget.set('')">Voltar</button
                ><button class="button small danger" [disabled]="busy()" (click)="cancel(a.id)">
                  Confirmar
                </button>
              </div>
            }
          </article>
        } @empty {
          <p class="help">Você ainda não tem agendamentos.</p>
        }
      </section>
    }
  </main>`,
})
export class CustomerPortal {
  readonly auth = inject(Auth);
  readonly fb = inject(FormBuilder);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly addingVehicle = signal(false);
  readonly cancelTarget = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly vehicles = signal<Vehicle[]>([]);
  readonly services = signal<Service[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly labels = STATUS_LABELS;
  readonly brands = VEHICLE_BRANDS;
  readonly colors = VEHICLE_COLORS;
  readonly types = alphabetical(['carro', 'SUV', 'caminhonete', 'moto', 'van', 'outro']);
  readonly minimumDate = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 16);
  readonly accessForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ['', [Validators.required, phoneValidator]],
  });
  readonly vehicleForm = this.fb.nonNullable.group({
    plate: [
      '',
      [Validators.required, Validators.pattern(/^[A-Za-z]{3}[- ]?[0-9][A-Za-z0-9][0-9]{2}$/)],
    ],
    brand: ['', [Validators.required, Validators.minLength(2)]],
    model: ['', [Validators.required, Validators.minLength(2)]],
    color: [''],
    type: ['carro'],
  });
  readonly bookingForm = this.fb.nonNullable.group({
    vehicle_id: ['', Validators.required],
    service_id: ['', Validators.required],
    starts_at: ['', Validators.required],
    notes: [''],
  });
  constructor() {
    void this.initialize();
  }
  private async initialize() {
    try {
      await this.auth.ready;
      this.accessForm.patchValue({
        name: this.auth.user()?.user_metadata?.['customer_name'] ?? '',
        phone: this.auth.user()?.user_metadata?.['customer_phone'] ?? '',
      });
      await this.load();
    } catch (e) {
      this.error.set(friendlyError(e));
    } finally {
      this.loading.set(false);
    }
  }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(friendlyError(e));
    } finally {
      this.busy.set(false);
    }
  }
  private async load() {
    if (!this.auth.customer()) return;
    const id = this.auth.customer()!.id;
    const results = await Promise.all([
      this.auth
        .client!.from('vehicles')
        .select('*')
        .eq('customer_id', id)
        .eq('active', true)
        .order('plate'),
      this.auth.client!.from('services').select('*').eq('active', true).order('name'),
      this.auth
        .client!.from('appointments')
        .select('*')
        .eq('customer_id', id)
        .order('starts_at', { ascending: false }),
    ]);
    for (const result of results) if (result.error) throw result.error;
    this.vehicles.set(results[0].data as Vehicle[]);
    this.services.set(
      (results[1].data as Service[]).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
    this.appointments.set(results[2].data as Appointment[]);
  }
  async complete() {
    const v = this.accessForm.getRawValue();
    if (this.accessForm.controls.name.invalid || this.accessForm.controls.phone.invalid) {
      this.error.set('Informe nome e telefone válidos.');
      return;
    }
    await this.run(async () => {
      await this.auth.completeCustomerRegistration(v.name.trim(), v.phone.replace(/\D/g, ''));
      await this.load();
    });
  }
  async refresh() {
    await this.run(() => this.load());
  }
  async addVehicle() {
    if (this.vehicleForm.invalid) {
      this.error.set('Informe placa, marca e modelo válidos.');
      return;
    }
    await this.run(async () => {
      const v = this.vehicleForm.getRawValue();
      const { error } = await this.auth.client!.rpc('portal_add_vehicle', {
        vehicle_plate: v.plate,
        vehicle_brand: v.brand,
        vehicle_model: v.model,
        vehicle_color: v.color,
        vehicle_type: v.type,
      });
      if (error) throw error;
      this.vehicleForm.reset({ type: 'carro' });
      this.addingVehicle.set(false);
      await this.load();
      this.message.set('Veículo cadastrado.');
    });
  }
  async book() {
    if (this.bookingForm.invalid) {
      this.error.set('Selecione veículo, serviço e um horário futuro.');
      return;
    }
    const v = this.bookingForm.getRawValue();
    const instant = dateTimeToISO(v.starts_at);
    if (!Number.isFinite(Date.parse(instant)) || Date.parse(instant) <= Date.now()) {
      this.error.set('Escolha um horário futuro.');
      return;
    }
    await this.run(async () => {
      const { error } = await this.auth.client!.rpc('portal_book', {
        vehicle_id: v.vehicle_id,
        service_id: v.service_id,
        starts_at: instant,
        notes: v.notes,
      });
      if (error) throw error;
      this.bookingForm.reset();
      await this.load();
      this.message.set('Agendamento realizado!');
    });
  }
  canCancel(a: Appointment) {
    return ['AGENDADO', 'CONFIRMADO'].includes(a.status) && Date.parse(a.starts_at) > Date.now();
  }
  vehicleName(id: string) {
    const v = this.vehicles().find((v) => v.id === id);
    return v ? `${v.plate} · ${v.model}` : 'Veículo';
  }
  serviceName(id: string) {
    return this.services().find((s) => s.id === id)?.name ?? 'Serviço';
  }
  async cancel(id: string) {
    await this.run(async () => {
      const { error } = await this.auth.client!.rpc('portal_cancel', { appointment_id: id });
      if (error) throw error;
      this.cancelTarget.set('');
      await this.load();
      this.message.set('Agendamento cancelado.');
    });
  }
  async logout() {
    await this.run(async () => {
      await this.auth.logout('/cliente/entrar');
      this.vehicles.set([]);
      this.services.set([]);
      this.appointments.set([]);
    });
  }
}
