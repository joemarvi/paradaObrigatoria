import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '../core/store';
import { WorkOrder, PaymentMethod, PAYMENT_METHODS, STATUS_LABELS } from '../core/models';
import { businessDate, moneyValidator, validatePayment } from '../core/domain';
import { Empty, Icon, Modal } from '../shared/ui';
@Component({
  selector: 'app-finance',
  imports: [CurrencyPipe, DatePipe, RouterLink, ReactiveFormsModule, Empty, Icon, Modal],
  template: `<div class="page-header">
      <div>
        <span class="eyebrow">CONTROLE FINANCEIRO</span>
        <h1>{{ isPayments ? 'Pagamentos' : 'Caixa' }}</h1>
        <p>
          {{
            isPayments
              ? 'Receba com agilidade e mantenha cada pagamento registrado.'
              : 'Acompanhe os recebimentos e confira o dinheiro em caixa.'
          }}
        </p>
      </div>
      <div class="header-actions">
        @if (!store.register()) {
          <button class="button primary" (click)="openCashModal('open')">
            <app-icon name="plus" /> Abrir caixa
          </button>
        } @else {
          <button class="button" (click)="openCashModal('move')">
            <app-icon name="plus" /> Nova movimentação</button
          ><button class="button primary" (click)="openCashModal('close')">Fechar caixa</button>
        }
      </div>
    </div>
    <div class="metrics">
      <article class="metric highlight">
        <div class="metric-label">Dinheiro em caixa<app-icon name="cash" /></div>
        <strong>{{ store.balance() | currency: 'BRL' }}</strong
        ><small>{{ store.register() ? 'Caixa aberto' : 'Caixa fechado' }} · saldo físico</small>
      </article>
      <article class="metric">
        <div class="metric-label">Recebimentos de hoje<app-icon name="chart" /></div>
        <strong>{{ received() | currency: 'BRL' }}</strong
        ><small>Todas as formas de pagamento</small>
      </article>
      <article class="metric">
        <div class="metric-label">A receber<app-icon name="clock" /></div>
        <strong>{{ pendingAmount() | currency: 'BRL' }}</strong
        ><small
          >{{
            store.auth.demo() ? pending().length : (store.financeSummary()?.pendingCount ?? 0)
          }}
          ordens aguardando pagamento</small
        >
      </article>
      <article class="metric">
        <div class="metric-label">Saldo inicial<app-icon name="cash" /></div>
        <strong>{{ store.register()?.opening_amount ?? 0 | currency: 'BRL' }}</strong
        ><small>{{
          store.register()?.opened_at
            ? (store.register()?.opened_at | date: 'dd/MM HH:mm' : '-0300')
            : 'Abra o caixa para receber'
        }}</small>
      </article>
    </div>
    @if (!store.register()) {
      <div class="alert warning">Abra o caixa antes de registrar pagamentos ou movimentações.</div>
    }
    <section class="panel" style="margin-bottom:24px">
      <div class="panel-header">
        <div>
          <h2>Prontos para receber</h2>
          <p>Pagamento integral ou dividido entre formas de pagamento.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ordem / veículo</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (o of pending(); track o.id) {
              <tr>
                <td>
                  <strong>#{{ o.number }} · {{ store.plate(o.vehicle_id) }}</strong
                  ><small>{{ store.vehicle(o.vehicle_id) }}</small>
                </td>
                <td>{{ store.customer(o.customer_id) }}</td>
                <td>{{ o.total | currency: 'BRL' }}</td>
                <td>{{ store.paid(o.id) | currency: 'BRL' }}</td>
                <td>
                  <strong>{{ o.total - store.paid(o.id) | currency: 'BRL' }}</strong>
                </td>
                <td>
                  @if (o.total === 0) {
                    <button class="button primary small" (click)="settleFree(o)">
                      Finalizar cortesia
                    </button>
                  } @else {
                    <button
                      class="button primary small"
                      [disabled]="!store.register()"
                      (click)="openPayment(o)"
                    >
                      Receber
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6">
                  <app-empty
                    title="Nenhum pagamento pendente"
                    description="Os veículos prontos para receber aparecem aqui."
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ isPayments ? 'Pagamentos registrados' : 'Movimentações do caixa' }}</h2>
          <p>
            {{
              isPayments
                ? 'Registro de recebimentos, sem dados de cartão.'
                : 'PIX e cartões são recebimentos; o saldo físico considera somente dinheiro.'
            }}
          </p>
        </div>
        <a routerLink="/relatorios" class="text-button">Relatórios</a>
      </div>
      <div class="table-wrap">
        <table>
          @if (isPayments) {
            <thead>
              <tr>
                <th>Data</th>
                <th>OS</th>
                <th>Forma</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              @for (p of store.db().payments; track p.id) {
                <tr>
                  <td>{{ p.created_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</td>
                  <td>#{{ orderNumber(p.work_order_id) }}</td>
                  <td>{{ labels[p.method] }}</td>
                  <td>{{ p.amount | currency: 'BRL' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4"><app-empty /></td>
                </tr>
              }
            </tbody>
          } @else {
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td>{{ m.created_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</td>
                  <td>{{ m.type }}</td>
                  <td>{{ m.description }}</td>
                  <td>{{ m.amount | currency: 'BRL' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">
                    <app-empty
                      title="Nenhuma movimentação"
                      description="Abra o caixa para começar."
                    />
                  </td>
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
    </section>
    @if (store.truncated().includes(isPayments ? 'payments' : 'cash_movements')) {
      <button
        class="button"
        style="margin-top:16px"
        (click)="store.more(isPayments ? 'payments' : 'cash_movements')"
      >
        Carregar mais
      </button>
    }
    @if (!isPayments) {
      <section class="panel" style="margin-top:24px">
        <div class="panel-header"><h2>Histórico de conferência</h2></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Abertura</th>
                <th>Fechamento</th>
                <th>Esperado</th>
                <th>Conferido</th>
                <th>Diferença</th>
              </tr>
            </thead>
            <tbody>
              @for (r of store.db().cash_registers; track r.id) {
                <tr>
                  <td>{{ r.opened_at | date: 'dd/MM/yyyy HH:mm' : '-0300' }}</td>
                  <td>
                    {{
                      r.closed_at ? (r.closed_at | date: 'dd/MM/yyyy HH:mm' : '-0300') : 'Em aberto'
                    }}
                  </td>
                  <td>{{ r.expected_amount ?? 0 | currency: 'BRL' }}</td>
                  <td>{{ r.closing_amount ?? 0 | currency: 'BRL' }}</td>
                  <td>
                    {{
                      r.closed_at
                        ? ((r.closing_amount ?? 0) - (r.expected_amount ?? 0) | currency: 'BRL')
                        : '—'
                    }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    @if (payment(); as o) {
      <app-modal [title]="'Receber OS #' + o.number" (dismiss)="payment.set(null)"
        ><form [formGroup]="paymentForm" (ngSubmit)="receive()">
          <p class="help">{{ store.plate(o.vehicle_id) }} · {{ store.customer(o.customer_id) }}</p>
          <div class="summary-total" style="margin:15px 0 22px">
            <span>Saldo a receber</span
            ><strong>{{ o.total - store.paid(o.id) | currency: 'BRL' }}</strong>
          </div>
          <div class="form-grid">
            <label
              >Forma de pagamento<select formControlName="method">
                @for (m of methods; track m) {
                  <option [value]="m">{{ labels[m] }}</option>
                }
              </select></label
            ><label
              >Valor (R$)<input
                type="number"
                min="0.01"
                step="0.01"
                formControlName="amount" /></label
            ><label class="checkbox wide"
              ><input type="checkbox" formControlName="split" /> Dividir entre duas formas de
              pagamento</label
            >
            @if (paymentForm.controls.split.value) {
              <label
                >Segunda forma<select formControlName="method2">
                  @for (m of methods; track m) {
                    <option [value]="m">{{ labels[m] }}</option>
                  }
                </select></label
              ><label
                >Segundo valor (R$)<input
                  type="number"
                  min="0.01"
                  step="0.01"
                  formControlName="amount2"
              /></label>
            }
          </div>
          <p class="help" style="margin-top:15px">
            O saldo será validado no banco. A OS será finalizada quando o total estiver pago.
          </p>
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <button type="button" class="button" (click)="payment.set(null)">Voltar</button
            ><button class="button primary" [disabled]="store.busy()">Confirmar recebimento</button>
          </div>
        </form></app-modal
      >
    }
    @if (cashModal()) {
      <app-modal
        [title]="
          cashModal() === 'open'
            ? 'Abrir caixa'
            : cashModal() === 'close'
              ? 'Conferir e fechar caixa'
              : 'Nova movimentação'
        "
        (dismiss)="cashModal.set('')"
        ><form [formGroup]="cashForm" (ngSubmit)="cashAction()">
          @if (cashModal() === 'close') {
            <div class="alert warning">
              Saldo esperado em dinheiro: {{ store.balance() | currency: 'BRL' }}. Confira o
              dinheiro físico antes de fechar.
            </div>
          }
          <div class="form-grid">
            @if (cashModal() === 'move') {
              <label class="wide"
                >Tipo<select formControlName="type">
                  <option value="REFORCO">Reforço</option>
                  <option value="SANGRIA">Sangria</option>
                  <option value="DESPESA">Despesa</option>
                </select></label
              >
            }
            <label class="wide"
              >{{
                cashModal() === 'open'
                  ? 'Saldo inicial (R$)'
                  : cashModal() === 'close'
                    ? 'Dinheiro contado (R$)'
                    : 'Valor (R$)'
              }}<input type="number" min="0" step="0.01" formControlName="amount"
            /></label>
            @if (cashModal() !== 'open') {
              <label class="wide"
                >{{ cashModal() === 'move' ? 'Descrição *' : 'Observações de conferência'
                }}<textarea formControlName="description"></textarea>
              </label>
            }
          </div>
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <button type="button" class="button" (click)="cashModal.set('')">Voltar</button
            ><button class="button primary" [disabled]="store.busy()">
              {{ cashModal() === 'close' ? 'Confirmar fechamento' : 'Confirmar' }}
            </button>
          </div>
        </form></app-modal
      >
    } `,
})
export class Finance {
  readonly store = inject(Store);
  readonly fb = inject(FormBuilder);
  readonly route = inject(ActivatedRoute);
  readonly isPayments = this.route.snapshot.routeConfig?.path === 'pagamentos';
  readonly labels = STATUS_LABELS;
  readonly methods = PAYMENT_METHODS;
  readonly payment = signal<WorkOrder | null>(null);
  readonly cashModal = signal('');
  readonly error = signal('');
  readonly paymentForm = this.fb.nonNullable.group({
    method: ['PIX'],
    amount: [0, [Validators.required, moneyValidator]],
    split: [false],
    method2: ['DINHEIRO'],
    amount2: [0, moneyValidator],
  });
  readonly cashForm = this.fb.nonNullable.group({
    type: ['REFORCO'],
    amount: [0, [Validators.required, moneyValidator]],
    description: [''],
  });
  readonly pending = computed(() =>
    this.store.db().work_orders.filter((o) => o.status === 'AGUARDANDO_PAGAMENTO'),
  );
  readonly pendingAmount = computed(() =>
    this.store.auth.demo()
      ? this.pending().reduce((s, o) => s + Number(o.total) - this.store.paid(o.id), 0)
      : (this.store.financeSummary()?.pendingAmount ?? 0),
  );
  readonly received = computed(() =>
    this.store.auth.demo()
      ? this.store
          .db()
          .payments.filter((p) => businessDate(p.created_at) === businessDate())
          .reduce((s, p) => s + Number(p.amount), 0)
      : (this.store.financeSummary()?.received ?? 0),
  );
  readonly movements = computed(() =>
    this.store
      .db()
      .cash_movements.filter(
        (m) => !this.store.register() || m.cash_register_id === this.store.register()?.id,
      ),
  );
  orderNumber(id: string) {
    return this.store.db().work_orders.find((o) => o.id === id)?.number ?? '—';
  }
  async settleFree(o: WorkOrder) {
    await this.store.rpc('settle_free_order', { order_id: o.id });
  }
  openPayment(o: WorkOrder) {
    this.payment.set(o);
    this.error.set('');
    this.paymentForm.reset({
      method: 'PIX',
      amount: Number(o.total) - this.store.paid(o.id),
      split: false,
      method2: 'DINHEIRO',
      amount2: 0,
    });
  }
  async receive() {
    const o = this.payment();
    if (!o) return;
    const f = this.paymentForm.getRawValue();
    const parts = [{ method: f.method as PaymentMethod, amount: Number(f.amount) }];
    if (f.split) parts.push({ method: f.method2 as PaymentMethod, amount: Number(f.amount2) });
    try {
      validatePayment(Number(o.total), this.store.paid(o.id), parts);
      if (this.paymentForm.invalid) throw new Error('Verifique os valores do pagamento.');
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    if (await this.store.rpc('record_payment', { order_id: o.id, parts })) this.payment.set(null);
  }
  openCashModal(mode: string) {
    this.cashModal.set(mode);
    this.error.set('');
    this.cashForm.reset({
      type: 'REFORCO',
      amount: mode === 'close' ? this.store.balance() : 0,
      description: '',
    });
  }
  async cashAction() {
    const f = this.cashForm.getRawValue();
    if (this.cashForm.invalid) {
      this.error.set('Informe um valor válido com até duas casas decimais.');
      return;
    }
    let ok: boolean;
    if (this.cashModal() === 'open')
      ok = await this.store.rpc('open_register', { amount: Number(f.amount) });
    else if (this.cashModal() === 'close')
      ok = await this.store.rpc('close_register', {
        counted_amount: Number(f.amount),
        note: f.description,
      });
    else {
      if (f.amount <= 0 || f.description.trim().length < 3) {
        this.error.set('Informe um valor positivo e uma descrição de pelo menos 3 caracteres.');
        return;
      }
      ok = await this.store.rpc('move_cash', {
        movement_type: f.type,
        amount: Number(f.amount),
        description: f.description.trim(),
      });
    }
    if (ok) this.cashModal.set('');
  }
}
