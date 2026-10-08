import { Feedback, PageLoading } from '../shared/feedback';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Reporting, Report, Breakdown } from '../core/reporting';
import { Store } from '../core/store';
import { Notifications, friendlyError } from '../core/notifications';
import { businessDate, exportCsv } from '../core/domain';
import { STATUS_LABELS } from '../core/models';
import { Empty, Icon } from '../shared/ui';
@Component({
  selector: 'app-reports',
  imports: [Feedback, PageLoading, CurrencyPipe, ReactiveFormsModule, Empty, Icon],
  template: `<app-page-loading [active]="loading()" />
    <div class="page-header">
      <div>
        <span class="eyebrow">DECISÕES COM CLAREZA</span>
        <h1>Relatórios</h1>
        <p>Entenda os resultados e encontre oportunidades para crescer.</p>
      </div>
      <button class="button" [disabled]="!report() || loading()" (click)="export()">
        <app-icon name="download" /> Exportar CSV
      </button>
    </div>
    <form class="toolbar" [formGroup]="form" (ngSubmit)="load()">
      <div class="filters">
        <select aria-label="Período" (change)="preset($any($event.target).value)">
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="week">Últimos 7 dias</option>
          <option value="month">Mês atual</option>
          <option value="lastMonth">Mês anterior</option>
          <option value="custom">Personalizado</option></select
        ><label>De<input type="date" formControlName="start" /></label
        ><label>Até<input type="date" formControlName="end" /></label
        ><button class="button primary" [disabled]="loading()">
          {{ loading() ? 'Consultando…' : 'Aplicar filtros' }}
        </button>
      </div>
    </form>
    @if (error()) {
      <app-feedback [message]="error()" kind="error" (dismissed)="error.set('')" />
    }
    @if (report(); as r) {
      <div class="metrics">
        <article class="metric highlight">
          <div class="metric-label">Recebimentos no período<app-icon name="chart" /></div>
          <strong>{{ r.revenue | currency: 'BRL' }}</strong
          ><small>Valores efetivamente recebidos</small>
        </article>
        <article class="metric">
          <div class="metric-label">Veículos concluídos<app-icon name="car" /></div>
          <strong>{{ r.completed }}</strong
          ><small>{{ serviceCount() }} serviços realizados</small>
        </article>
        <article class="metric">
          <div class="metric-label">Ticket de recebimento<app-icon name="cash" /></div>
          <strong>{{ (r.paidOrders ? r.revenue / r.paidOrders : 0) | currency: 'BRL' }}</strong
          ><small>Recebimento ÷ ordens com pagamento</small>
        </article>
        <article class="metric">
          <div class="metric-label">Cancelamentos<app-icon name="orders" /></div>
          <strong>{{ r.cancellations }}</strong
          ><small>{{ r.customers }} novos clientes · {{ r.vehicles }} novos veículos</small>
        </article>
      </div>
      <section class="panel" style="margin-bottom:24px">
        <div class="panel-header">
          <h2>Recebimentos por dia</h2>
          <small class="help">{{ appliedPeriod() }}</small>
        </div>
        <div class="panel-body">
          @if (r.days.length) {
            <div class="report-chart" role="img" aria-label="Gráfico de recebimentos diários">
              @for (d of r.days.slice(-31); track d.name) {
                <div
                  class="report-bar"
                  [style.height.%]="(d.total / maxDay()) * 100"
                  [title]="d.name + ': R$ ' + d.total.toFixed(2)"
                >
                  <span>{{ d.name.slice(8) }}</span>
                </div>
              }
            </div>
            <p class="help">
              Gráfico com os últimos 31 dias com recebimentos; tabelas e CSV incluem todo o período.
            </p>
          } @else {
            <app-empty
              title="Sem recebimentos no período"
              description="Ajuste o filtro ou registre pagamentos."
            />
          }
        </div>
      </section>
      <div class="dashboard-grid">
        <div class="dashboard-column">
          @for (section of leftSections(); track section.title) {
            <section class="panel">
              <div class="panel-header">
                <h2>{{ section.title }}</h2>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of section.rows; track row.name) {
                      <tr>
                        <td>{{ labels[row.name] ?? row.name }}</td>
                        <td>{{ row.quantity }}</td>
                        <td>{{ row.total | currency: 'BRL' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="3"><app-empty /></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        </div>
        <div class="dashboard-column">
          @for (section of rightSections(); track section.title) {
            <section class="panel">
              <div class="panel-header">
                <h2>{{ section.title }}</h2>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of section.rows; track row.name) {
                      <tr>
                        <td>{{ labels[row.name] ?? row.name }}</td>
                        <td>{{ row.quantity }}</td>
                        <td>{{ row.total | currency: 'BRL' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="3"><app-empty /></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        </div>
      </div>
      <p class="help" style="margin-top:20px">
        Serviços e desempenho usam a data de conclusão. Valores de serviços correspondem aos itens,
        antes dos descontos e acréscimos da OS. Fluxo de caixa lista movimentos; abertura e
        fechamento não são receitas ou despesas.
      </p>
    } `,
})
export class Reports {
  readonly reporting = inject(Reporting);
  readonly store = inject(Store);
  readonly notices = inject(Notifications);
  readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    start: [businessDate(), Validators.required],
    end: [businessDate(), Validators.required],
  });
  readonly report = signal<Report | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly appliedPeriod = signal('');
  readonly labels = STATUS_LABELS;
  constructor() {
    effect(() => {
      this.store.db();
      if (!this.store.loading())
        untracked(() => {
          void this.load();
        });
    });
  }
  preset(value: string) {
    if (value === 'custom') return;
    const date = new Date(businessDate() + 'T12:00:00-03:00');
    const end = new Date(date);
    if (value === 'yesterday') {
      date.setUTCDate(date.getUTCDate() - 1);
      end.setUTCDate(end.getUTCDate() - 1);
    }
    if (value === 'week') date.setUTCDate(date.getUTCDate() - 6);
    if (value === 'month') date.setUTCDate(1);
    if (value === 'lastMonth') {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - 1);
      end.setUTCDate(0);
    }
    this.form.setValue({ start: businessDate(date), end: businessDate(end) });
    void this.load();
  }
  async load() {
    if (this.loading()) return;
    const { start, end } = this.form.getRawValue();
    if (
      this.form.invalid ||
      end < start ||
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000 > 366
    ) {
      this.error.set('Selecione um período válido de até 367 dias.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      this.report.set(await this.reporting.report(start, end));
      this.appliedPeriod.set(
        `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}`,
      );
    } catch (e) {
      this.report.set(null);
      this.error.set(friendlyError(e));
    } finally {
      this.loading.set(false);
    }
  }
  serviceCount() {
    return this.report()?.services.reduce((s, g) => s + g.quantity, 0) ?? 0;
  }
  maxDay() {
    return Math.max(1, ...(this.report()?.days ?? []).map((d) => d.total));
  }
  leftSections() {
    return [
      { title: 'Serviços mais realizados', rows: this.report()?.services ?? [] },
      { title: 'Desempenho por funcionário', rows: this.report()?.employees ?? [] },
    ];
  }
  rightSections() {
    return [
      { title: 'Recebimentos por forma', rows: this.report()?.methods ?? [] },
      { title: 'Fluxo de caixa', rows: this.report()?.cash ?? [] },
    ];
  }
  export() {
    const r = this.report();
    if (!r) return;
    const rows: unknown[][] = [
      ['Período', this.appliedPeriod(), '', ''],
      ['Resumo', 'Recebimentos', '', r.revenue],
      ['Resumo', 'Ordens com recebimento', r.paidOrders, ''],
      ['Resumo', 'Concluídos', r.completed, ''],
      ['Resumo', 'Serviços', this.serviceCount(), ''],
      ['Resumo', 'Ticket de recebimento', '', r.paidOrders ? r.revenue / r.paidOrders : 0],
      ['Resumo', 'Cancelamentos', r.cancellations, ''],
      ['Cadastros', 'Clientes', r.customers, ''],
      ['Cadastros', 'Veículos', r.vehicles, ''],
    ];
    for (const [name, data] of Object.entries({
      Serviços: r.services,
      Funcionários: r.employees,
      Pagamentos: r.methods,
      Dias: r.days,
      Caixa: r.cash,
    })) {
      for (const row of data as Breakdown[])
        rows.push([name, this.labels[row.name] ?? row.name, row.quantity, row.total]);
    }
    exportCsv(
      'parada-obrigatoria-relatorio.csv',
      ['Grupo', 'Descrição', 'Quantidade', 'Valor (R$)'],
      rows,
    );
  }
}
