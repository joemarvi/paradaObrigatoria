import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { Store } from '../core/store';
import { Reporting, Summary } from '../core/reporting';
import { businessDate } from '../core/domain';
import { Notifications, friendlyError } from '../core/notifications';
import { Badge, Empty, Icon } from '../shared/ui';
@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, Badge, Empty, Icon],
  template: `
    <div class="page-header">
      <div>
        <span class="eyebrow">SUA OPERAÇÃO, EM UM SÓ LUGAR</span>
        <h1>Visão geral</h1>
        <p>Olá, {{ auth.name().split(' ')[0] }}. Veja como está o movimento de hoje.</p>
      </div>
      <div class="header-actions">
        <a class="button" routerLink="/agendamentos"><app-icon name="calendar" /> Ver agenda</a
        ><a class="button primary" routerLink="/ordens-servico"
          ><app-icon name="plus" /> Nova entrada</a
        >
      </div>
    </div>
    @if (summary(); as s) {
      <div class="metrics">
        <article class="metric">
          <div class="metric-label">Aguardando atendimento<app-icon name="clock" /></div>
          <strong>{{ s.waiting.toString().padStart(2, '0') }}</strong
          ><small>Veículos na fila de espera</small>
        </article>
        <article class="metric">
          <div class="metric-label">Em serviço<app-icon name="wash" /></div>
          <strong>{{ s.inService.toString().padStart(2, '0') }}</strong
          ><small>Sendo cuidados pela equipe</small>
        </article>
        <article class="metric">
          <div class="metric-label">Prontos para entrega<app-icon name="check" /></div>
          <strong>{{ s.ready.toString().padStart(2, '0') }}</strong
          ><small>Aguardando pagamento ou retirada</small>
        </article>
        <article class="metric highlight">
          <div class="metric-label">Recebimentos do dia<app-icon name="cash" /></div>
          <strong>{{ s.revenue | currency: 'BRL' }}</strong
          ><small>{{ s.paidOrders }} ordens com recebimento hoje</small>
        </article>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-column">
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2>Agora no lava-jato</h2>
                <p>Acompanhe os veículos em atendimento</p>
              </div>
              <a routerLink="/fila" class="text-button"
                >Ver fila <span aria-hidden="true">↗</span></a
              >
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Veículo / cliente</th>
                    <th>Serviço</th>
                    <th>Status</th>
                    <th>Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of current(); track o.id) {
                    <tr>
                      <td>
                        <span class="plate">{{ store.plate(o.vehicle_id) }}</span
                        ><small
                          >{{ store.vehicle(o.vehicle_id) }} ·
                          {{ store.customer(o.customer_id) }}</small
                        >
                      </td>
                      <td>
                        {{ store.items(o.id).at(0)?.name ?? '—'
                        }}<small>{{ store.employee(o.employee_id) }}</small>
                      </td>
                      <td><app-badge [status]="o.status" /></td>
                      <td>{{ o.entered_at | date: 'HH:mm' : '-0300' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4">
                        <app-empty
                          title="Pátio livre"
                          description="Registre a chegada de um veículo para começar."
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
                <h2>Serviços realizados hoje</h2>
                <p>Os cuidados mais procurados</p>
              </div>
              <span class="section-kicker">{{ s.serviceCount }} serviços</span>
            </div>
            <div class="panel-body">
              @for (service of s.services.slice(0, 5); track service.name) {
                <div class="service-bar">
                  <div class="service-bar-label">
                    <span>{{ service.name }}</span
                    ><strong>{{ service.quantity }} serviços</strong>
                  </div>
                  <div class="service-bar-track">
                    <span [style.width.%]="(service.quantity / maxServices()) * 100"></span>
                  </div>
                </div>
              } @empty {
                <app-empty
                  title="O dia está começando"
                  description="Os serviços concluídos aparecerão aqui."
                />
              }
            </div>
          </section>
        </div>
        <div class="dashboard-column">
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2>Agenda de hoje</h2>
                <p>{{ s.appointments }} agendamentos previstos</p>
              </div>
              <app-icon name="calendar" />
            </div>
            @for (a of appointments().slice(0, 4); track a.id) {
              <article class="appointment-item">
                <div class="appointment-time">{{ a.starts_at | date: 'HH:mm' : '-0300' }}</div>
                <div class="appointment-detail">
                  <strong>{{ store.customer(a.customer_id) }}</strong>
                  <p>{{ store.plate(a.vehicle_id) }} · {{ serviceName(a.service_id) }}</p>
                  <app-badge [status]="a.status" />
                </div>
              </article>
            } @empty {
              <app-empty title="Agenda livre" description="Nenhum agendamento hoje." />
            }
            <a
              routerLink="/agendamentos"
              class="text-button"
              style="display:block;text-align:center;padding:15px"
              >Ver agenda completa →</a
            >
          </section>
          <section class="panel">
            <div class="panel-header">
              <h2>Resumo do caixa</h2>
              <span
                class="badge"
                [attr.data-status]="s.registerOpen ? 'FINALIZADO' : 'AGUARDANDO'"
                >{{ s.registerOpen ? 'Aberto' : 'Fechado' }}</span
              >
            </div>
            <div class="panel-body">
              <div class="cash-summary">
                <span>Saldo em dinheiro</span><strong>{{ s.balance | currency: 'BRL' }}</strong>
              </div>
              <div class="cash-summary">
                <span>Ticket de recebimento¹</span
                ><strong>{{
                  (s.paidOrders ? s.revenue / s.paidOrders : 0) | currency: 'BRL'
                }}</strong>
              </div>
              <div class="cash-summary">
                <span>Veículos concluídos hoje</span><strong>{{ s.completed }}</strong>
              </div>
              <small class="help">¹ Recebido hoje ÷ ordens com recebimento.</small
              ><a routerLink="/caixa" class="button full" style="margin-top:15px"
                >Acessar caixa <app-icon name="arrow"
              /></a>
            </div>
          </section>
        </div>
      </div>
      @if (!s.registerOpen) {
        <div class="alert warning">
          <span>O caixa está fechado. Abra para começar a receber pagamentos.</span
          ><a routerLink="/caixa" class="text-button">Abrir caixa</a>
        </div>
      }
    } @else {
      <div class="panel loading-placeholder" role="status">
        {{ failed() ? 'Não foi possível carregar os indicadores.' : 'Carregando indicadores…' }}
        @if (failed()) {
          <button class="button" (click)="refresh()">Tentar novamente</button>
        }
      </div>
    }
    <div class="quick-links">
      <a routerLink="/clientes" class="quick-link"
        ><app-icon name="users" /> Cadastrar cliente<app-icon name="arrow" /></a
      ><a routerLink="/agendamentos" class="quick-link"
        ><app-icon name="calendar" /> Novo agendamento<app-icon name="arrow" /></a
      ><a routerLink="/pagamentos" class="quick-link"
        ><app-icon name="cash" /> Receber pagamento<app-icon name="arrow"
      /></a>
    </div>
  `,
})
export class Dashboard {
  readonly auth = inject(Auth);
  readonly store = inject(Store);
  readonly reporting = inject(Reporting);
  readonly notices = inject(Notifications);
  readonly summary = signal<Summary | null>(null);
  readonly failed = signal(false);
  readonly current = computed(() =>
    this.store
      .db()
      .work_orders.filter((o) => !['CANCELADO', 'FINALIZADO'].includes(o.status))
      .slice(0, 6),
  );
  readonly appointments = computed(() =>
    this.store
      .db()
      .appointments.filter(
        (a) =>
          businessDate(a.starts_at) === businessDate() &&
          !['CANCELADO', 'NAO_COMPARECEU'].includes(a.status),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  );
  constructor() {
    effect(() => {
      this.store.db();
      if (!this.store.loading())
        untracked(() => {
          void this.refresh();
        });
    });
  }
  async refresh() {
    this.failed.set(false);
    try {
      this.summary.set(await this.reporting.summary());
    } catch (e) {
      this.failed.set(true);
      this.notices.show(friendlyError(e), true);
    }
  }
  serviceName(id: string) {
    return this.store.db().services.find((s) => s.id === id)?.name ?? 'Serviço não carregado';
  }
  maxServices() {
    return Math.max(1, ...(this.summary()?.services ?? []).map((s) => s.quantity));
  }
}
