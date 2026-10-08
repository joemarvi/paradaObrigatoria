import { webcrypto as crypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkoutPreference,
  trustedCheckoutUrl,
  verifySignature,
} from '../supabase/functions/_shared/payments.ts';
import { bookingPaymentLabel, checkoutUrl } from '../src/app/core/booking-payment.ts';

test('checkout usa preço integral do servidor e exclui outros tipos sem excluir saldo obrigatório', () => {
  const payment = {
    id: 'ledger',
    appointment_id: 'booking',
    method: 'PIX',
    amount: 85.5,
    expires_at: '2030-10-08T12:00:00Z',
  };
  const preference = checkoutPreference(
    payment,
    'Lavagem',
    'https://joemarvi.com.br',
    'https://example.com/webhook',
  );
  assert.equal(preference.items[0].unit_price, 85.5);
  assert.equal(preference.items[0].quantity, 1);
  assert.equal(preference.external_reference, 'booking');
  assert.equal(preference.payment_methods.default_payment_method_id, 'pix');
  const excluded = preference.payment_methods.excluded_payment_types.map((x) => x.id);
  assert.ok(excluded.includes('credit_card'));
  assert.ok(!excluded.includes('bank_transfer'));
  assert.ok(!excluded.includes('account_money'));
  assert.equal(preference.back_urls.success, preference.back_urls.failure);
});
test('assinatura exige HMAC válido e vincula identificador e request-id', async () => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode('id:123;request-id:request;ts:12345;'),
  );
  const signature = `ts=12345,v1=${Buffer.from(bytes).toString('hex')}`;
  assert.equal(await verifySignature('123', 'request', signature, 'secret'), true);
  assert.equal(await verifySignature('124', 'request', signature, 'secret'), false);
  assert.equal(await verifySignature('123', 'other', signature, 'secret'), false);
  assert.equal(await verifySignature('123', 'request', signature, 'wrong'), false);
  assert.equal(await verifySignature('123', 'request', 'v1=abc', 'secret'), false);
});
test('frontend e backend rejeitam destinos externos e protocolos inseguros', () => {
  for (const validate of [checkoutUrl, trustedCheckoutUrl]) {
    assert.match(validate('https://sandbox.mercadopago.com.br/checkout/test'), /sandbox/);
    for (const url of [
      'https://evil.example',
      'https://www.mercadopago.com.br.evil.example',
      'http://www.mercadopago.com.br',
      'javascript:alert(1)',
      null,
    ])
      assert.throws(() => validate(url));
  }
});
test('simulação aprovada não é exibida como reserva real garantida', () => {
  assert.equal(
    bookingPaymentLabel({ status: 'APPROVED', live_mode: false }),
    'Pagamento de Teste Aprovado',
  );
  assert.match(bookingPaymentLabel({ status: 'APPROVED', live_mode: true }), /Reserva Garantida/);
  assert.match(bookingPaymentLabel({ status: 'REVIEW', live_mode: false }), /Revisão/);
});
