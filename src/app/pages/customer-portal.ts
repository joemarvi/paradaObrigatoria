import { NameAvatar } from '../shared/name-avatar';
import { environment } from '../core/environment';
import { BookingPayment, bookingPaymentLabel, checkoutUrl } from '../core/booking-payment';
import { Feedback, PageLoading } from '../shared/feedback';
import { Icon, Badge, Modal } from '../shared/ui';
import { NumericInputDirective } from '../shared/numeric-input';
import { InputMaskDirective } from '../shared/input-mask';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { alphabetical, VEHICLE_BRANDS, VEHICLE_COLORS } from '../core/vehicle-options';
import { Auth } from '../core/auth';
import { Appointment, Service, Vehicle, STATUS_LABELS } from '../core/models';
import { dateTimeToISO, phoneValidator, formatPhone } from '../core/domain';
import { friendlyError } from '../core/notifications';
@Component({
  selector: 'app-customer-portal',
  imports: [
    NameAvatar,
    Feedback,
    PageLoading,
    Icon,
    Badge,
    Modal,
    NumericInputDirective,
    InputMaskDirective,
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
  ],
  template: `<app-page-loading [active]="busy() || !auth.initialized()" />
    <main class="customer-portal">
      <header class="portal-header">
        <a
          [routerLink]="auth.user() ? '/cliente' : '/'"
          class="portal-brand"
          aria-label="Parada Obrigatória — Página Inicial"
        >
          <img src="brand-logo.png" alt="" width="48" height="48" />
          <span><strong>Parada Obrigatória</strong><small>Área do Cliente</small></span>
        </a>
        @if (auth.user()) {
          <details class="portal-account-menu">
            <summary [attr.aria-label]="'Minha Conta: ' + auth.name()">
              <app-name-avatar class="portal-avatar" [name]="auth.name()" aria-hidden="true" />
              <span class="portal-account-name" [title]="auth.name()">{{ auth.name() }}</span>
              <app-icon name="chevron-down" class="portal-chevron" />
            </summary>
            <nav class="portal-account-dropdown" aria-label="Opções da Conta">
              <div class="portal-account-identity">
                <strong>{{ auth.name() }}</strong
                ><small>{{ auth.user()?.email }}</small>
              </div>
              <button type="button" (click)="openAccountPanel('details')">
                <app-icon name="users" /> Dados do Cliente
              </button>
              <button type="button" (click)="openAccountPanel('security')">
                <app-icon name="shield" /> Segurança
              </button>
              <a routerLink="/cliente" (click)="closeAccountMenu()"
                ><app-icon name="grid" /> Página Inicial</a
              >
              <button
                type="button"
                class="portal-menu-logout"
                (click)="closeAccountMenu(); logout()"
                [disabled]="busy()"
              >
                <app-icon name="logout" /> Sair
              </button>
            </nav>
          </details>
        }
      </header>
      @if (accountPanel() === 'details') {
        <app-modal title="Dados do Cliente" (dismiss)="accountPanel.set(null)">
          <p class="help">Informações vinculadas à sua conta.</p>
          <dl class="portal-account-data">
            <div>
              <dt>Nome completo</dt>
              <dd>
                {{
                  auth.customer()?.name ||
                    auth.user()?.user_metadata?.['customer_name'] ||
                    'Não informado'
                }}
              </dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{{ auth.user()?.email || 'Não informado' }}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>
                {{
                  phoneDisplay(
                    auth.customer()?.phone || auth.user()?.user_metadata?.['customer_phone'] || ''
                  ) || 'Não informado'
                }}
              </dd>
            </div>
          </dl>
          <button class="button full" type="button" (click)="accountPanel.set(null)">Fechar</button>
        </app-modal>
      }
      @if (accountPanel() === 'security') {
        <app-modal title="Segurança da Conta" (dismiss)="accountPanel.set(null)">
          <div class="portal-security-intro">
            <span class="portal-summary-icon"><app-icon name="shield" /></span>
            <div>
              <h3>Alterar sua Senha</h3>
              <p>
                Enviaremos um link para {{ auth.user()?.email }}. Abra o e-mail para definir sua
                nova senha.
              </p>
            </div>
          </div>
          <button
            class="button primary full"
            type="button"
            [disabled]="busy() || !auth.user()?.email"
            (click)="requestPasswordReset()"
          >
            {{ busy() ? 'Enviando…' : 'Enviar Link para Alterar Senha' }}
          </button>
        </app-modal>
      }
      @if (error()) {
        <app-feedback [message]="error()" kind="error" (dismissed)="error.set('')" />
      }
      @if (message()) {
        <app-feedback [message]="message()" kind="success" (dismissed)="message.set('')" />
      }
      @if (!auth.initialized() || loading()) {
        <app-page-loading [active]="true" />
      } @else if (!auth.customer()) {
        <section class="panel portal-card">
          <h1>Complete seu Cadastro</h1>
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
        <section class="portal-welcome">
          <div>
            <span class="eyebrow">SEU VEÍCULO, NOSSO CUIDADO</span>
            <h1>Olá, {{ auth.name() }}</h1>
            <p>Reserve um tempo para cuidar do seu veículo. O próximo atendimento começa aqui.</p>
            <button class="button primary" type="button" (click)="scrollToBooking()">
              <app-icon name="calendar" /> Novo Agendamento
            </button>
          </div>
          <div class="portal-welcome-icon" aria-hidden="true"><app-icon name="car" /></div>
        </section>
        <div class="portal-summary">
          <div>
            <span class="portal-summary-icon"><app-icon name="car" /></span
            ><span
              ><strong>{{ vehicles().length }}</strong
              ><small>Veículos Cadastrados</small></span
            >
          </div>
          <div>
            <span class="portal-summary-icon"><app-icon name="calendar" /></span
            ><span
              ><strong>{{ visibleAppointments().length }}</strong
              ><small>Agendamentos</small></span
            >
          </div>
          <div>
            <span class="portal-summary-icon"><app-icon name="wash" /></span
            ><span
              ><strong>{{ services().length }}</strong
              ><small>Serviços Disponíveis</small></span
            >
          </div>
        </div>
        <div class="portal-grid">
          <section class="panel portal-section">
            <div class="portal-section-heading">
              <span class="portal-summary-icon"><app-icon name="car" /></span>
              <div>
                <h2>Meus Veículos</h2>
                <p>Sua garagem em um só lugar.</p>
              </div>
            </div>
            @for (v of vehicles(); track v.id) {
              <article class="portal-vehicle">
                <span class="portal-vehicle-icon"><app-icon name="car" /></span>
                <div>
                  <strong>{{ v.brand }} {{ v.model }}</strong
                  ><span class="portal-plate">{{ v.plate }}</span>
                </div>
                <small>{{ v.type }}</small>
              </article>
            } @empty {
              <div class="portal-empty">
                <app-icon name="car" />
                <h3>Sua Garagem Começa Aqui</h3>
                <p>Adicione seu primeiro veículo para reservar um atendimento.</p>
              </div>
            }
            <button
              type="button"
              class="button portal-add-vehicle"
              [attr.aria-expanded]="addingVehicle()"
              (click)="addingVehicle.set(!addingVehicle())"
            >
              <app-icon [name]="addingVehicle() ? 'close' : 'plus'" />{{
                addingVehicle() ? 'Fechar Cadastro' : 'Adicionar Veículo'
              }}
            </button>
            @if (addingVehicle()) {
              <form class="portal-vehicle-form" [formGroup]="vehicleForm" (ngSubmit)="addVehicle()">
                <label
                  >Placa<input
                    appInputMask="plate"
                    formControlName="plate"
                    maxlength="8"
                    placeholder="ABC1D23"
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
          <section id="portal-booking" class="panel portal-section portal-booking">
            <div class="portal-section-heading">
              <span class="portal-summary-icon"><app-icon name="calendar" /></span>
              <div>
                <h2>Novo Agendamento</h2>
                <p>Escolha o cuidado e o melhor horário para você.</p>
              </div>
            </div>
            <form [formGroup]="bookingForm" (ngSubmit)="book()">
              <label
                >Veículo<select formControlName="vehicle_id">
                  <option value="">
                    {{
                      vehicles().length ? 'Selecione seu Veículo' : 'Cadastre um Veículo Primeiro'
                    }}
                  </option>
                  @for (v of vehicles(); track v.id) {
                    <option [value]="v.id">{{ v.plate }} · {{ v.model }}</option>
                  }
                </select></label
              >
              <label
                >Serviço<select formControlName="service_id">
                  <option value="">
                    {{ services().length ? 'Selecione um Serviço' : 'Nenhum Serviço Disponível' }}
                  </option>
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
              @if (onlinePayments) {
                <div class="portal-payment-options">
                  <h3>Pagamento da Reserva</h3>
                  <p class="help">
                    Ambiente de Teste: pagamentos simulados, sem cobrança real. A garantia de
                    reserva será válida após a ativação em produção.
                  </p>
                  <label
                    >Quando Pagar<select formControlName="payment_timing">
                      <option value="AFTER">Após o Serviço</option>
                      <option value="ONLINE">Pagar Agora · Valor Integral</option>
                    </select></label
                  >
                  @if (bookingForm.controls.payment_timing.value === 'ONLINE') {
                    <label
                      >Forma de Pagamento<select formControlName="payment_method">
                        <option value="PIX">Pix</option>
                        <option value="CREDITO">Cartão de Crédito</option>
                        <option value="DEBITO">Cartão de Débito Virtual Caixa</option>
                      </select></label
                    >
                    <p class="help">
                      Você será direcionado ao Mercado Pago. A reserva é garantida após a aprovação
                      do pagamento. Conclua em até 15 minutos.
                    </p>
                    <p class="help">
                      Os meios disponíveis dependem da conta Mercado Pago. O checkout também pode
                      oferecer saldo em conta.
                    </p>
                  } @else {
                    <p class="help">
                      Pague no atendimento. O agendamento fica sujeito à confirmação da equipe, sem
                      a garantia do pagamento antecipado.
                    </p>
                  }
                </div>
              }
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
                <app-icon name="check" /> Agendar Atendimento
              </button>
            </form>
          </section>
        </div>
        <section class="panel portal-section">
          <div class="portal-history-heading">
            <div class="portal-section-heading">
              <span class="portal-summary-icon"><app-icon name="clock" /></span>
              <div>
                <h2>Meus Agendamentos</h2>
                <p>Acompanhe seus atendimentos e suas reservas.</p>
              </div>
            </div>
            <button class="button small" (click)="refresh()" [disabled]="busy()">Atualizar</button>
          </div>
          @for (a of visibleAppointments(); track a.id) {
            <article class="portal-appointment">
              <div>
                <strong>{{ a.starts_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</strong>
                <p>{{ vehicleName(a.vehicle_id) }} · {{ serviceName(a.service_id) }}</p>
                <app-badge [status]="a.status" />
                @if (paymentFor(a.id); as payment) {
                  <p class="portal-payment-status">
                    {{ paymentLabel(payment) }} · {{ payment.amount | currency: 'BRL' }}
                  </p>
                  @if (payment.status === 'PENDING') {
                    <small
                      >Prazo: {{ payment.expires_at | date: 'dd/MM HH:mm' : '-0300' }}. Após pagar,
                      atualize para consultar a confirmação.</small
                    >
                    @if (canPay(a, payment)) {
                      <button
                        class="button small primary"
                        type="button"
                        [disabled]="busy()"
                        (click)="pay(a.id)"
                      >
                        Continuar Pagamento
                      </button>
                    }
                  }
                  @if (payment.status === 'APPROVED' || payment.status === 'REVIEW') {
                    <p class="help">
                      Para cancelamento e revisão do pagamento, entre em contato com a equipe.
                    </p>
                  }
                } @else {
                  @if (onlinePayments) {
                    <p class="help">Pagamento Após o Serviço</p>
                  }
                }
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
                <app-modal title="Cancelar Agendamento" (dismiss)="cancelTarget.set('')">
                  <div class="modal-content">
                    <p>Deseja cancelar este agendamento?</p>
                    <button class="button small" (click)="cancelTarget.set('')">Voltar</button
                    ><button class="button small danger" [disabled]="busy()" (click)="cancel(a.id)">
                      Confirmar
                    </button>
                  </div>
                </app-modal>
              }
            </article>
          } @empty {
            <div class="portal-empty">
              <app-icon name="calendar" />
              <h3>Seu Próximo Cuidado Está por Vir</h3>
              <p>Você ainda não tem agendamentos. Escolha um serviço para começar.</p>
            </div>
          }
        </section>
      }
      <footer class="portal-footer">
        Parada Obrigatória <span>Seu veículo bem cuidado, do início ao fim.</span>
      </footer>
    </main>`,
})
export class CustomerPortal {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  scrollToBooking() {
    const section = this.element.nativeElement.querySelector<HTMLElement>('#portal-booking');
    if (!section) return;
    section.querySelector<HTMLSelectElement>('select')?.focus({ preventScroll: true });
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }
  readonly accountPanel = signal<'details' | 'security' | null>(null);
  readonly phoneDisplay = formatPhone;
  closeAccountMenu() {
    this.element.nativeElement
      .querySelector('details.portal-account-menu')
      ?.removeAttribute('open');
  }
  openAccountPanel(panel: 'details' | 'security') {
    this.closeAccountMenu();
    this.accountPanel.set(panel);
  }
  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent) {
    const menu = this.element.nativeElement.querySelector('details.portal-account-menu');
    if (menu && event.target instanceof Node && !menu.contains(event.target))
      this.closeAccountMenu();
  }
  @HostListener('document:keydown.escape')
  onEscape() {
    const menu = this.element.nativeElement.querySelector('details.portal-account-menu[open]');
    if (menu) {
      this.closeAccountMenu();
      menu.querySelector('summary')?.focus();
    }
  }
  async requestPasswordReset() {
    const email = this.auth.user()?.email;
    if (!email) return;
    await this.run(async () => {
      await this.auth.recover(email, '/cliente/recuperar');
      this.accountPanel.set(null);
      this.message.set('Confira seu e-mail para alterar sua senha.');
    });
  }
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
  readonly visibleAppointments = computed(() =>
    this.appointments().filter((appointment) => appointment.status !== 'CANCELADO'),
  );
  readonly onlinePayments = environment.onlinePayments;
  readonly payments = signal<BookingPayment[]>([]);
  readonly paymentLabel = bookingPaymentLabel;
  private bookingRequest: { fingerprint: string; id: string } | null = null;
  paymentFor(id: string) {
    return this.payments().find((p) => p.appointment_id === id);
  }
  canPay(a: Appointment, p: BookingPayment) {
    return ['AGENDADO', 'CONFIRMADO'].includes(a.status) && Date.parse(p.expires_at) > Date.now();
  }
  private async openCheckout(id: string) {
    const { data, error } = await this.auth.client!.functions.invoke('mercadopago-checkout', {
      body: { appointment_id: id },
    });
    if (error)
      throw new Error(
        'Não foi possível abrir o pagamento. Use Continuar Pagamento na sua reserva para tentar novamente',
      );
    window.location.assign(checkoutUrl(data?.checkout_url));
  }
  async pay(id: string) {
    await this.run(() => this.openCheckout(id));
  }
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
    payment_timing: ['AFTER'],
    payment_method: ['PIX'],
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
        .neq('status', 'CANCELADO')
        .order('starts_at', { ascending: false }),
    ]);
    for (const result of results) if (result.error) throw result.error;
    this.vehicles.set(results[0].data as Vehicle[]);
    this.services.set(
      (results[1].data as Service[]).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
    this.appointments.set(
      (results[2].data as Appointment[]).filter(
        (appointment) => appointment.status !== 'CANCELADO',
      ),
    );
    if (this.onlinePayments) {
      const ids = this.appointments().map((a) => a.id);
      if (!ids.length) {
        this.payments.set([]);
        return;
      }
      const { data, error } = await this.auth
        .client!.from('appointment_payments')
        .select('appointment_id,method,amount,status,expires_at,live_mode')
        .in('appointment_id', ids);
      if (error) throw error;
      this.payments.set(data as BookingPayment[]);
    }
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
      const prepaid = this.onlinePayments && v.payment_timing === 'ONLINE';
      const fingerprint = JSON.stringify(v);
      if (prepaid && this.bookingRequest?.fingerprint !== fingerprint)
        this.bookingRequest = { fingerprint, id: crypto.randomUUID() };
      const { data, error } = await this.auth.client!.rpc(
        prepaid ? 'portal_book_prepaid' : 'portal_book',
        {
          vehicle_id: v.vehicle_id,
          service_id: v.service_id,
          starts_at: instant,
          notes: v.notes,
          ...(prepaid
            ? { payment_method: v.payment_method, request_id: this.bookingRequest!.id }
            : {}),
        },
      );
      if (error) throw error;
      this.bookingForm.reset({ payment_timing: 'AFTER', payment_method: 'PIX' });
      this.bookingRequest = null;
      await this.load();
      if (prepaid) {
        await this.openCheckout(data as string);
        return;
      }
      this.message.set('Agendamento realizado! Aguarde a confirmação da equipe.');
    });
  }
  canCancel(a: Appointment) {
    if (['APPROVED', 'REVIEW'].includes(this.paymentFor(a.id)?.status ?? '')) return false;
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
