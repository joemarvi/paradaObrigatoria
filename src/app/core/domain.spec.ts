import {
  businessDate,
  canTransition,
  cashBalance,
  dateTimeToISO,
  orderTotal,
  validDocument,
  validatePayment,
} from './domain';
import { CashMovement, Payment } from './models';
describe('Cálculos da operação', () => {
  it('calcula serviços, produtos, desconto e acréscimo em centavos', () =>
    expect(
      orderTotal(
        [
          { quantity: 2, unit_price: 85 },
          { quantity: 3, unit_price: 9.9 },
        ],
        10,
        5,
      ),
    ).toBe(194.7));
  it('não acumula imprecisão decimal', () =>
    expect(
      orderTotal([
        { quantity: 3, unit_price: 0.1 },
        { quantity: 1, unit_price: 0.2 },
      ]),
    ).toBe(0.5));
  it('rejeita desconto excessivo e quantidade inválida', () => {
    expect(() => orderTotal([{ quantity: 1, unit_price: 20 }], 21)).toThrow();
    expect(() => orderTotal([{ quantity: 0, unit_price: 20 }])).toThrow();
  });
  it('aceita pagamento dividido e rejeita pagamentos excessivos ou inválidos', () => {
    expect(() => validatePayment(85, 5, [{ amount: 40 }, { amount: 40 }])).not.toThrow();
    expect(() => validatePayment(85, 5, [{ amount: 81 }])).toThrow();
    expect(() => validatePayment(85, 0, [{ amount: -1 }])).toThrow();
    expect(() => validatePayment(85, 0, [{ amount: 1.001 }])).toThrow();
  });
  it('saldo físico exclui PIX, cartão e conferência', () => {
    const movements = [
      { type: 'ABERTURA', amount: 100 },
      { type: 'VENDA', amount: 50, payment_id: 'p1' },
      { type: 'VENDA', amount: 80, payment_id: 'p2' },
      { type: 'SANGRIA', amount: 30 },
      { type: 'REFORCO', amount: 10 },
      { type: 'FECHAMENTO', amount: 130 },
    ] as CashMovement[];
    expect(
      cashBalance(movements, [
        { id: 'p1', method: 'DINHEIRO' },
        { id: 'p2', method: 'PIX' },
      ] as Payment[]),
    ).toBe(130);
  });
});
describe('Permissões e formatos', () => {
  it('operador executa serviço mas não cancela nem finaliza pagamento', () => {
    expect(canTransition('AGUARDANDO', 'EM_SERVICO', 'operador')).toBe(true);
    expect(canTransition('EM_SERVICO', 'AGUARDANDO_PAGAMENTO', 'operador')).toBe(true);
    expect(canTransition('AGUARDANDO', 'CANCELADO', 'operador')).toBe(false);
    expect(canTransition('AGUARDANDO_PAGAMENTO', 'FINALIZADO', 'operador')).toBe(false);
  });
  it('ordens encerradas não reabrem', () =>
    expect(canTransition('FINALIZADO', 'EM_SERVICO', 'administrador')).toBe(false));
  it('valida CPF e CNPJ por dígitos verificadores', () => {
    expect(validDocument('529.982.247-25')).toBe(true);
    expect(validDocument('11.222.333/0001-81')).toBe(true);
    expect(validDocument('11111111111')).toBe(false);
    expect(validDocument('52998224724')).toBe(false);
    expect(validDocument('')).toBe(true);
  });
  it('usa o dia de Brasília próximo à meia-noite UTC', () =>
    expect(businessDate('2026-10-07T01:00:00Z')).toBe('2026-10-06'));
  it('converte horário de agendamento de Brasília independentemente do host', () =>
    expect(dateTimeToISO('2026-10-06T09:00')).toBe('2026-10-06T12:00:00.000Z'));
});
