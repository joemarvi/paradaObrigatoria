import { Injectable, inject } from '@angular/core';
import { Store } from './store';
import { businessDate } from './domain';
export interface Breakdown {
  name: string;
  quantity: number;
  total: number;
}
export interface Report {
  revenue: number;
  paidOrders: number;
  completed: number;
  cancellations: number;
  customers: number;
  vehicles: number;
  services: Breakdown[];
  methods: Breakdown[];
  employees: Breakdown[];
  days: Breakdown[];
  cash: Breakdown[];
}
export interface Summary {
  waiting: number;
  inService: number;
  ready: number;
  revenue: number;
  paidOrders: number;
  completed: number;
  serviceCount: number;
  appointments: number;
  balance: number;
  registerOpen: boolean;
  services: Breakdown[];
}
@Injectable({ providedIn: 'root' })
export class Reporting {
  private store = inject(Store);
  async report(start: string, end: string): Promise<Report> {
    if (!this.store.auth.demo()) {
      const { data, error } = await this.store.auth.client!.rpc('management_report', {
        start_date: start,
        end_date: end,
      });
      if (error) throw error;
      return data as Report;
    }
    const d = this.store.db();
    const inRange = (s: string) => {
      const date = businessDate(s);
      return date >= start && date <= end;
    };
    const payments = d.payments.filter((p) => inRange(p.created_at));
    const orders = d.work_orders.filter(
      (o) => o.completed_at && inRange(o.completed_at) && o.status !== 'CANCELADO',
    );
    const groups = (rows: { name: string; quantity: number; total: number }[]) => {
      const result: Record<string, Breakdown> = {};
      for (const row of rows) {
        result[row.name] ??= { name: row.name, quantity: 0, total: 0 };
        result[row.name].quantity += row.quantity;
        result[row.name].total += row.total;
      }
      return Object.values(result).sort((a, b) => b.quantity - a.quantity);
    };
    return {
      revenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      paidOrders: new Set(payments.map((p) => p.work_order_id)).size,
      completed: orders.length,
      cancellations: d.work_orders.filter(
        (o) => o.status === 'CANCELADO' && inRange(o.updated_at ?? o.created_at),
      ).length,
      customers: d.customers.filter((c) => inRange(c.created_at)).length,
      vehicles: d.vehicles.filter((v) => inRange(v.created_at)).length,
      services: groups(
        d.work_order_items
          .filter((i) => i.kind === 'SERVICO' && orders.some((o) => o.id === i.work_order_id))
          .map((i) => ({
            name: i.name,
            quantity: i.quantity,
            total: i.quantity * Number(i.unit_price),
          })),
      ),
      methods: groups(
        payments.map((p) => ({ name: p.method, quantity: 1, total: Number(p.amount) })),
      ),
      employees: groups(
        orders.map((o) => ({
          name: this.store.employee(o.employee_id),
          quantity: 1,
          total: Number(o.total),
        })),
      ),
      days: groups(
        payments.map((p) => ({
          name: businessDate(p.created_at),
          quantity: 1,
          total: Number(p.amount),
        })),
      ).sort((a, b) => a.name.localeCompare(b.name)),
      cash: groups(
        d.cash_movements
          .filter((m) => inRange(m.created_at))
          .map((m) => ({ name: m.type, quantity: 1, total: Number(m.amount) })),
      ),
    };
  }
  async summary(): Promise<Summary> {
    if (!this.store.auth.demo()) {
      const { data, error } = await this.store.auth.client!.rpc('dashboard_summary');
      if (error) throw error;
      return data as Summary;
    }
    const r = await this.report(businessDate(), businessDate());
    const d = this.store.db();
    return {
      waiting: d.work_orders.filter((o) => o.status === 'AGUARDANDO').length,
      inService: d.work_orders.filter((o) => o.status === 'EM_SERVICO').length,
      ready: d.work_orders.filter(
        (o) => o.status === 'AGUARDANDO_PAGAMENTO' || (o.status === 'FINALIZADO' && !o.exited_at),
      ).length,
      revenue: r.revenue,
      paidOrders: r.paidOrders,
      completed: r.completed,
      serviceCount: r.services.reduce((s, g) => s + g.quantity, 0),
      appointments: d.appointments.filter(
        (a) =>
          businessDate(a.starts_at) === businessDate() &&
          !['CANCELADO', 'NAO_COMPARECEU'].includes(a.status),
      ).length,
      balance: this.store.balance(),
      registerOpen: !!this.store.register(),
      services: r.services,
    };
  }
}
