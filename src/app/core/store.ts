import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import {
  Database,
  EMPTY_DATABASE,
  Table,
  WorkOrder,
  OrderStatus,
  PaymentMethod,
  Base,
} from './models';
import { demoDatabase } from './demo';
import { cashBalance, canTransition, cents, orderTotal, validatePayment } from './domain';
import { friendlyError, Notifications } from './notifications';
export type Row = Record<string, unknown>;
@Injectable({ providedIn: 'root' })
export class Store {
  readonly auth = inject(Auth);
  private readonly notices = inject(Notifications);
  readonly db = signal<Database>(structuredClone(EMPTY_DATABASE));
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly truncated = signal<Table[]>([]);
  readonly financeSummary = signal<{
    balance: number;
    received: number;
    pendingAmount: number;
    pendingCount: number;
    paidByOrder: Record<string, number>;
  } | null>(null);
  readonly register = computed(() => this.db().cash_registers.find((r) => !r.closed_at));
  readonly balance = computed(() =>
    this.auth.demo()
      ? cashBalance(
          this.db().cash_movements.filter((m) => m.cash_register_id === this.register()?.id),
          this.db().payments,
        )
      : (this.financeSummary()?.balance ?? 0),
  );
  private demoData: Database | null = null;
  private requestVersion = 0;
  constructor() {
    void this.auth.ready.then(() => {
      this.auth.client?.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          this.requestVersion++;
          this.db.set(structuredClone(EMPTY_DATABASE));
          this.financeSummary.set(null);
        }
      });
    });
  }
  async load(only?: Table[]) {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.failed.set(false);
    try {
      if (this.auth.demo()) {
        this.demoData ??= demoDatabase();
        this.db.set(structuredClone(this.demoData));
        this.truncated.set([]);
        return;
      }
      if (!this.auth.client) return;
      const next = only ? structuredClone(this.db()) : structuredClone(EMPTY_DATABASE);
      const limited: Table[] = only ? this.truncated().filter((t) => !only.includes(t)) : [];
      const finance = this.auth.role() !== 'operador';
      const manager = ['administrador', 'gerente'].includes(this.auth.role());
      const tables = (only ?? (Object.keys(next) as Table[]))
        .filter((t) => finance || !['payments', 'cash_movements', 'cash_registers'].includes(t))
        .filter((t) => manager || !['parada_audit_logs', 'profiles'].includes(t));
      await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await this.query(table).range(0, 199);
          if (error) throw error;
          (next[table] as Base[]) = data ?? [];
          if (data?.length === 200) limited.push(table);
        }),
      );
      if (
        finance &&
        (!only ||
          only.some((t) =>
            ['work_orders', 'payments', 'cash_registers', 'cash_movements'].includes(t),
          ))
      ) {
        const { data, error } = await this.auth.client.rpc('finance_summary');
        if (error) throw error;
        if (version === this.requestVersion) this.financeSummary.set(data);
      }
      if (version === this.requestVersion) {
        this.db.set(next);
        this.truncated.set(limited);
      }
    } catch (e) {
      this.failed.set(true);
      this.notices.show(friendlyError(e), true);
    } finally {
      this.loading.set(false);
    }
  }
  private query(table: Table) {
    const q = this.auth.client!.from(table).select('*');
    if (table === 'work_orders') q.order('status', { ascending: true });
    return q.order('created_at', { ascending: false }).order('id', { ascending: false });
  }
  async more(table: Table) {
    if (!this.auth.client || this.busy()) return;
    this.busy.set(true);
    try {
      const offset = this.db()[table].length;
      const { data, error } = await this.query(table).range(offset, offset + 199);
      if (error) throw error;
      this.db.update((d) => ({ ...d, [table]: [...d[table], ...(data ?? [])] }));
      if ((data?.length ?? 0) < 200) this.truncated.update((t) => t.filter((v) => v !== table));
    } catch (e) {
      this.notices.show(friendlyError(e), true);
    } finally {
      this.busy.set(false);
    }
  }
  customer(id: string) {
    return this.db().customers.find((c) => c.id === id)?.name ?? 'Cliente não carregado';
  }
  vehicle(id: string) {
    const v = this.db().vehicles.find((v) => v.id === id);
    return v ? `${v.brand} ${v.model}` : 'Veículo não carregado';
  }
  plate(id: string) {
    return this.db().vehicles.find((v) => v.id === id)?.plate ?? '—';
  }
  employee(id?: string) {
    return this.db().employees.find((e) => e.id === id)?.name ?? 'A definir';
  }
  items(id: string) {
    return this.db().work_order_items.filter((i) => i.work_order_id === id);
  }
  paid(id: string) {
    const server = this.financeSummary()?.paidByOrder[id];
    if (!this.auth.demo() && server !== undefined) return Number(server);
    return this.db()
      .payments.filter((p) => p.work_order_id === id)
      .reduce((s, p) => s + Number(p.amount), 0);
  }
  async save(table: Table, value: Row, id?: string): Promise<boolean> {
    return this.mutate(
      async () => {
        if (this.auth.demo()) {
          const rows = this.demoData![table] as unknown as Row[];
          if (id) {
            const old = rows.find((r) => r['id'] === id);
            if (!old) throw new Error('Registro não encontrado');
            Object.assign(old, value, { updated_at: new Date().toISOString() });
          } else
            rows.unshift({
              ...value,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
            });
          this.audit(table, id ?? String(rows[0]['id']), 'SALVAR');
          return;
        }
        const query = id
          ? this.auth.client!.from(table).update(value).eq('id', id)
          : this.auth.client!.from(table).insert(value);
        const { error } = await query;
        if (error) throw error;
      },
      'Registro salvo.',
      [table, 'parada_audit_logs'],
    );
  }
  async rpc(name: string, args: Row): Promise<boolean> {
    return this.mutate(
      async () => {
        if (this.auth.demo()) this.demoRpc(name, args);
        else {
          const { error } = await this.auth.client!.rpc(name, args);
          if (error) throw error;
        }
      },
      'Operação concluída.',
      name === 'create_work_order'
        ? ['work_orders', 'work_order_items', 'parada_audit_logs']
        : name.includes('order') || name === 'release_vehicle'
          ? ['work_orders', 'parada_audit_logs']
          : name === 'record_payment'
            ? ['work_orders', 'payments', 'cash_movements', 'parada_audit_logs']
            : ['cash_registers', 'cash_movements', 'parada_audit_logs'],
    );
  }
  private async mutate(
    action: () => Promise<void>,
    message: string,
    tables: Table[],
  ): Promise<boolean> {
    if (this.busy() || !this.auth.authenticated()) return false;
    this.busy.set(true);
    try {
      await action();
      await this.load(tables);
      this.notices.show(message);
      return true;
    } catch (e) {
      this.notices.show(
        this.auth.demo() && e instanceof Error ? e.message : friendlyError(e),
        true,
      );
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  private audit(entity: string, id: string, action: string) {
    this.demoData!.parada_audit_logs.unshift({
      id: crypto.randomUUID(),
      record_id: id,
      entity,
      action,
      created_at: new Date().toISOString(),
    });
  }
  private demoRpc(name: string, args: Row) {
    const d = this.demoData!;
    const now = new Date().toISOString();
    const base = () => ({ id: crypto.randomUUID(), created_at: now });
    const o = d.work_orders.find((o) => o.id === args['order_id']);
    const r = d.cash_registers.find((r) => !r.closed_at);
    if (name === 'create_work_order') {
      const p = args['payload'] as Row;
      const serviceIds = p['service_ids'] as string[];
      if (!serviceIds.length) throw new Error('Selecione um serviço.');
      if (
        !d.vehicles.some(
          (v) => v.id === p['vehicle_id'] && v.customer_id === p['customer_id'] && v.active,
        )
      )
        throw new Error('Veículo inválido para o cliente.');
      const id = crypto.randomUUID();
      const items = serviceIds.map((sid) => {
        const s = d.services.find((s) => s.id === sid && s.active);
        if (!s) throw new Error('Serviço inativo.');
        return {
          ...base(),
          work_order_id: id,
          service_id: s.id,
          name: s.name,
          kind: 'SERVICO' as const,
          quantity: 1,
          unit_price: Number(s.price),
        };
      });
      const products = (p['products'] ?? []) as {
        name: string;
        quantity: number;
        unit_price: number;
      }[];
      const productItems = products.map((product) => ({
        ...base(),
        work_order_id: id,
        ...product,
        kind: 'PRODUTO' as const,
      }));
      const total = orderTotal(
        [...items, ...productItems],
        Number(p['discount']),
        Number(p['surcharge']),
      );
      const order = {
        ...base(),
        ...p,
        id,
        number: Math.max(1000, ...d.work_orders.map((o) => o.number)) + 1,
        total,
        status: 'AGUARDANDO',
        entered_at: now,
      } as unknown as WorkOrder;
      d.work_orders.unshift(order);
      d.work_order_items.push(...items, ...productItems);
      this.audit('work_orders', id, 'CRIAR');
    } else if (name === 'transition_order') {
      const status = args['next_status'] as OrderStatus;
      if (!o || !canTransition(o.status, status, this.auth.role()))
        throw new Error('Transição inválida.');
      o.status = status;
      if (status === 'AGUARDANDO_PAGAMENTO') o.completed_at = now;
      this.audit('work_orders', o.id, status);
    } else if (name === 'open_register') {
      if (r) throw new Error('O caixa já está aberto.');
      const amount = Number(args['amount']);
      cents(amount);
      const reg = { ...base(), opened_at: now, opening_amount: amount };
      d.cash_registers.unshift(reg);
      d.cash_movements.unshift({
        ...base(),
        cash_register_id: reg.id,
        type: 'ABERTURA',
        amount,
        description: 'Abertura do caixa',
      });
      this.audit('cash_registers', reg.id, 'ABRIR');
    } else if (name === 'record_payment') {
      if (!r) throw new Error('Abra o caixa antes de receber.');
      if (!o || o.status !== 'AGUARDANDO_PAGAMENTO')
        throw new Error('Ordem indisponível para pagamento.');
      const parts = args['parts'] as { amount: number; method: PaymentMethod }[];
      const paid = d.payments
        .filter((p) => p.work_order_id === o.id)
        .reduce((s, p) => s + Number(p.amount), 0);
      validatePayment(Number(o.total), paid, parts);
      for (const p of parts) {
        const payment = { ...base(), work_order_id: o.id, cash_register_id: r.id, ...p };
        d.payments.unshift(payment);
        d.cash_movements.unshift({
          ...base(),
          cash_register_id: r.id,
          payment_id: payment.id,
          type: 'VENDA',
          amount: p.amount,
          description: `Pagamento OS ${o.number}`,
        });
      }
      if (cents(paid + parts.reduce((s, p) => s + p.amount, 0)) === cents(Number(o.total)))
        o.status = 'FINALIZADO';
      this.audit('payments', o.id, 'RECEBER');
    } else if (name === 'assign_order_employee') {
      if (!o || !['AGUARDANDO', 'EM_SERVICO'].includes(o.status))
        throw new Error('Ordem não disponível para atribuição.');
      if (!d.employees.some((e) => e.id === args['employee_id'] && e.active))
        throw new Error('Funcionário inativo.');
      o.employee_id = String(args['employee_id']);
      this.audit('work_orders', o.id, 'ATRIBUIR');
    } else if (name === 'settle_free_order') {
      if (!o || o.status !== 'AGUARDANDO_PAGAMENTO' || Number(o.total) !== 0)
        throw new Error('Ordem não disponível para cortesia.');
      o.status = 'FINALIZADO';
      this.audit('work_orders', o.id, 'CORTESIA');
    } else if (name === 'release_vehicle') {
      if (!o || o.status !== 'FINALIZADO' || o.exited_at)
        throw new Error('Finalize o pagamento antes da saída.');
      o.exited_at = now;
    } else if (name === 'move_cash') {
      if (!r) throw new Error('Caixa fechado.');
      const amount = Number(args['amount']);
      if (amount <= 0) throw new Error('Informe valor positivo.');
      cents(amount);
      const type = String(args['movement_type']);
      const balance = cashBalance(
        d.cash_movements.filter((m) => m.cash_register_id === r.id),
        d.payments,
      );
      if (type !== 'REFORCO' && amount > balance)
        throw new Error('Saldo insuficiente em dinheiro.');
      d.cash_movements.unshift({
        ...base(),
        cash_register_id: r.id,
        type,
        amount,
        description: String(args['description']),
      });
    } else if (name === 'close_register') {
      if (!r) throw new Error('Caixa fechado.');
      const amount = Number(args['counted_amount']);
      cents(amount);
      r.closed_at = now;
      r.closing_amount = amount;
      r.expected_amount = cashBalance(
        d.cash_movements.filter((m) => m.cash_register_id === r.id),
        d.payments,
      );
      r.notes = String(args['note']);
      d.cash_movements.unshift({
        ...base(),
        cash_register_id: r.id,
        type: 'FECHAMENTO',
        amount,
        description: 'Conferência de fechamento',
      });
      this.audit('cash_registers', r.id, 'FECHAR');
    } else throw new Error('Operação não disponível.');
  }
}
