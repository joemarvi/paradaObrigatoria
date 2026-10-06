import { AbstractControl, ValidationErrors } from '@angular/forms';
import { CashMovement, OrderStatus, Payment, Role } from './models';
export function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Informe um valor válido.');
  return Math.round(value * 100);
}
export function orderTotal(
  items: { quantity: number; unit_price: number }[],
  discount = 0,
  surcharge = 0,
): number {
  const subtotal = items.reduce((sum, i) => {
    if (!Number.isInteger(i.quantity) || i.quantity < 1) throw new Error('Quantidade inválida.');
    return sum + i.quantity * cents(i.unit_price);
  }, 0);
  const result = subtotal - cents(discount) + cents(surcharge);
  if (result < 0) throw new Error('O desconto não pode ultrapassar o valor da ordem.');
  return result / 100;
}
export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  if (to === 'CANCELADO') return role !== 'operador' && ['AGUARDANDO', 'EM_SERVICO'].includes(from);
  return (
    (from === 'AGUARDANDO' && to === 'EM_SERVICO') ||
    (from === 'EM_SERVICO' && to === 'AGUARDANDO_PAGAMENTO')
  );
}
export function validatePayment(total: number, paid: number, parts: { amount: number }[]): void {
  if (
    !parts.length ||
    parts.some(
      (p) =>
        !Number.isFinite(p.amount) ||
        p.amount <= 0 ||
        Math.abs(p.amount * 100 - Math.round(p.amount * 100)) > 0.00001,
    )
  )
    throw new Error('Informe valores positivos com até duas casas decimais.');
  if (parts.reduce((s, p) => s + cents(p.amount), 0) + cents(paid) > cents(total))
    throw new Error('O pagamento ultrapassa o saldo da ordem.');
}
export function cashBalance(movements: CashMovement[], payments: Payment[]): number {
  return (
    movements.reduce((sum, m) => {
      if (['ABERTURA', 'REFORCO'].includes(m.type)) return sum + cents(Number(m.amount));
      if (['SANGRIA', 'DESPESA'].includes(m.type)) return sum - cents(Number(m.amount));
      if (m.type === 'VENDA' && payments.find((p) => p.id === m.payment_id)?.method === 'DINHEIRO')
        return sum + cents(Number(m.amount));
      return sum;
    }, 0) / 100
  );
}
export function validDocument(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (!d) return true;
  if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) {
    const digit = (n: number) => {
      const sum = d
        .slice(0, n)
        .split('')
        .reduce((s, v, i) => s + Number(v) * (n + 1 - i), 0);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
  }
  if (d.length === 14) {
    const digit = (n: number) => {
      let weight = n - 7;
      const sum = d
        .slice(0, n)
        .split('')
        .reduce((s, v) => {
          const r = s + Number(v) * weight;
          weight = weight === 2 ? 9 : weight - 1;
          return r;
        }, 0);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
  }
  return false;
}
export function documentValidator(c: AbstractControl): ValidationErrors | null {
  return validDocument(String(c.value ?? '')) ? null : { document: true };
}
export function moneyValidator(c: AbstractControl): ValidationErrors | null {
  const n = Number(c.value);
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001
    ? null
    : { money: true };
}
export function businessDate(iso: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
export function dateTimeToISO(value: string): string {
  return new Date(value.length === 16 ? `${value}:00-03:00` : value).toISOString();
}
export function minutesWaiting(entered: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(entered).getTime()) / 60000));
}
export function exportCsv(name: string, headers: string[], rows: unknown[][]): void {
  const escape = (v: unknown) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const content = '\uFEFF' + [headers, ...rows].map((r) => r.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : digits.length === 10
      ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
      : value;
}
export function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11
    ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    : digits.length === 14
      ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : value;
}
export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  return /^[0-9()\s.+-]+$/.test(value) && /^\d{10,11}$/.test(value.replace(/\D/g, ''))
    ? null
    : { phone: true };
}
