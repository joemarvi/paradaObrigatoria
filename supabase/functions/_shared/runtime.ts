import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
export function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Configuração de pagamento incompleta');
  return value;
}
export function adminClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const siteUrl = () => required('PAYMENT_SITE_URL').replace(/\/$/, '');
export function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': Deno.env.get('PAYMENT_SITE_URL')?.replace(/\/$/, '') ?? '',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  });
}
export async function mercado(path: string, init: RequestInit = {}) {
  const result = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${required('MERCADOPAGO_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!result.ok) throw new Error('Mercado Pago indisponível');
  return result.json();
}
