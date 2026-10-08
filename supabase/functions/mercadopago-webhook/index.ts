import { adminClient, mercado, required } from '../_shared/runtime.ts';
import { verifySignature } from '../_shared/payments.ts';

Deno.serve(async (req) => {
  const reply = (status: number) => new Response(null, { status });
  try {
    if (req.method !== 'POST') return reply(405);
    const url = new URL(req.url);
    const dataId = url.searchParams.get('data.id') ?? '';
    if (
      !(await verifySignature(
        dataId,
        req.headers.get('x-request-id') ?? '',
        req.headers.get('x-signature') ?? '',
        required('MERCADOPAGO_WEBHOOK_SECRET'),
      ))
    )
      return reply(401);
    const body = await req.json();
    if (body.type !== 'payment') return reply(200);
    if (String(body.data?.id) !== dataId || !/^\d+$/.test(dataId)) return reply(400);
    const payment = await mercado(`/v1/payments/${dataId}`);
    if (String(payment.id) !== dataId) return reply(400);
    if (String(payment.collector_id) !== required('MERCADOPAGO_SELLER_ID')) return reply(403);
    if (!/^[a-f0-9-]{36}$/i.test(payment.external_reference ?? '')) return reply(200);
    const db = adminClient();
    const { data: local } = await db
      .from('appointment_payments')
      .select('*')
      .eq('appointment_id', payment.external_reference)
      .maybeSingle();
    if (!local || !local.provider_preference_id) return reply(404);
    if (!payment.order?.id || !/^\d+$/.test(String(payment.order.id))) return reply(409);
    const order = await mercado(`/merchant_orders/${payment.order.id}`);
    if (String(order.preference_id) !== local.provider_preference_id) return reply(409);
    const expectedType = { PIX: 'bank_transfer', CREDITO: 'credit_card', DEBITO: 'debit_card' }[
      local.method as 'PIX' | 'CREDITO' | 'DEBITO'
    ];
    if (
      payment.payment_type_id !== 'account_money' &&
      (payment.payment_type_id !== expectedType ||
        (local.method === 'PIX' && payment.payment_method_id !== 'pix'))
    )
      return reply(409);
    const { error } = await db.rpc('apply_booking_payment', {
      booking_id: payment.external_reference,
      payment_id: String(payment.id),
      payment_status: payment.status,
      paid_amount: payment.transaction_amount,
      paid_currency: payment.currency_id,
      is_live: payment.live_mode,
    });
    if (error) return reply(409);
    return reply(200);
  } catch {
    return reply(500);
  }
});
