import { adminClient, mercado, required, response, siteUrl } from '../_shared/runtime.ts';
import { trustedCheckoutUrl, checkoutPreference } from '../_shared/payments.ts';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return response({});
    if (req.method !== 'POST') return response({ error: 'Método inválido' }, 405);
    const authorization = req.headers.get('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Sessão necessária' }, 401);
    const db = adminClient();
    const { data: session, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !session.user) return response({ error: 'Sessão inválida' }, 401);
    const { appointment_id } = await req.json();
    if (typeof appointment_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(appointment_id))
      return response({ error: 'Agendamento inválido' }, 400);
    const { data: account } = await db
      .from('customer_accounts')
      .select('customer_id, customers!inner(active)')
      .eq('user_id', session.user.id)
      .eq('customers.active', true)
      .maybeSingle();
    const { data: booking, error: bookingError } = await db
      .from('appointments')
      .select('*, services(name)')
      .eq('id', appointment_id)
      .eq('customer_id', account?.customer_id ?? '')
      .maybeSingle();
    if (bookingError || !booking || !['AGENDADO', 'CONFIRMADO'].includes(booking.status))
      return response({ error: 'Agendamento indisponível' }, 404);
    const { data: payment, error: paymentError } = await db
      .from('appointment_payments')
      .select('*')
      .eq('appointment_id', appointment_id)
      .single();
    if (
      paymentError ||
      !payment ||
      payment.status !== 'PENDING' ||
      Date.parse(payment.expires_at) <= Date.now()
    )
      return response({ error: 'Pagamento indisponível ou expirado' }, 409);
    const mode = required('MERCADOPAGO_MODE');
    if (mode !== 'sandbox') return response({ error: 'Cobranças reais desativadas' }, 503);
    const live = false;
    const seller = await mercado('/users/me');
    if (
      String(seller.id) !== required('MERCADOPAGO_SELLER_ID') ||
      !Array.isArray(seller.tags) ||
      !seller.tags.includes('test_user')
    )
      return response({ error: 'Use somente a conta de teste vendedor do Mercado Pago' }, 503);
    if (live) return response({ error: 'Cobranças reais desativadas' }, 503);
    if (payment.checkout_url && payment.live_mode !== live)
      return response({ error: 'Modo de pagamento incompatível' }, 409);
    if (payment.checkout_url)
      return response({ checkout_url: trustedCheckoutUrl(payment.checkout_url) });
    const { data: claimed, error: claimError } = await db.rpc('claim_booking_checkout', {
      booking_id: appointment_id,
    });
    if (claimError || !claimed)
      return response(
        { error: 'Pagamento sendo preparado. Aguarde alguns segundos e tente novamente.' },
        409,
      );
    const preference = await mercado('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': payment.id },
      body: JSON.stringify(
        checkoutPreference(
          payment,
          booking.services?.name ?? 'Atendimento',
          siteUrl(),
          `${required('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
        ),
      ),
    });
    const url = trustedCheckoutUrl(preference.init_point);
    const { data: updated, error } = await db
      .from('appointment_payments')
      .update({ provider_preference_id: preference.id, checkout_url: url, live_mode: live })
      .eq('id', payment.id)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();
    if (error || !updated) throw new Error('Não foi possível registrar o checkout');
    return response({ checkout_url: url });
  } catch {
    return response(
      { error: 'Não foi possível abrir o pagamento. Tente novamente pela sua reserva.' },
      502,
    );
  }
});
