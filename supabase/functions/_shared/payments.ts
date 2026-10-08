export type BookingPayment = {
  id: string;
  appointment_id: string;
  method: 'PIX' | 'CREDITO' | 'DEBITO';
  amount: number;
  status: string;
  expires_at: string;
  provider_preference_id?: string;
  checkout_url?: string;
  live_mode: boolean;
};

export async function verifySignature(
  dataId: string,
  requestId: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('=')),
  );
  if (!dataId || !requestId || !parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? '')) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const bytes = Uint8Array.from(parts.v1.match(/../g)!, (byte) => parseInt(byte, 16));
  return crypto.subtle.verify(
    'HMAC',
    key,
    bytes,
    encoder.encode(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`),
  );
}

export function checkoutPreference(
  payment: BookingPayment,
  title: string,
  siteUrl: string,
  webhookUrl: string,
) {
  const chosenType = { PIX: 'bank_transfer', CREDITO: 'credit_card', DEBITO: 'debit_card' }[
    payment.method
  ];
  return {
    items: [
      {
        id: payment.appointment_id,
        title,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(payment.amount),
      },
    ],
    external_reference: payment.appointment_id,
    metadata: { booking_payment_id: payment.id },
    notification_url: webhookUrl,
    back_urls: {
      success: `${siteUrl}/cliente?pagamento=retorno`,
      failure: `${siteUrl}/cliente?pagamento=retorno`,
      pending: `${siteUrl}/cliente?pagamento=retorno`,
    },
    auto_return: 'approved',
    expires: true,
    expiration_date_to: new Date(payment.expires_at).toISOString(),
    payment_methods: {
      installments: 1,
      excluded_payment_types: [
        'credit_card',
        'debit_card',
        'bank_transfer',
        'ticket',
        'atm',
        'digital_currency',
      ]
        .filter((type) => type !== chosenType)
        .map((id) => ({ id })),
      ...(payment.method === 'PIX' ? { default_payment_method_id: 'pix' } : {}),
    },
  };
}

export function trustedCheckoutUrl(url: unknown): string {
  if (typeof url !== 'string') throw new Error('Checkout indisponível');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(parsed.hostname)
  )
    throw new Error('Checkout inválido');
  return parsed.href;
}
