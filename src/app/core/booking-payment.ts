export interface BookingPayment {
  appointment_id: string;
  method: 'PIX' | 'CREDITO' | 'DEBITO';
  amount: number;
  status: string;
  expires_at: string;
  live_mode: boolean;
}
export function bookingPaymentLabel(payment: BookingPayment): string {
  if (payment.status === 'APPROVED')
    return payment.live_mode
      ? 'Pagamento Aprovado · Reserva Garantida'
      : 'Pagamento de Teste Aprovado';
  return (
    (
      {
        PENDING: 'Aguardando Pagamento',
        EXPIRED: 'Pagamento Expirado',
        REJECTED: 'Pagamento Recusado',
        REFUNDED: 'Pagamento Reembolsado',
        CHARGEBACK: 'Pagamento Contestado',
        REVIEW: 'Pagamento em Revisão · Contate a Equipe',
      } as Record<string, string>
    )[payment.status] ?? 'Pagamento em Processamento'
  );
}
export function checkoutUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Pagamento indisponível. Tente novamente');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(url.hostname)
  )
    throw new Error('Destino de pagamento inválido');
  return url.href;
}
