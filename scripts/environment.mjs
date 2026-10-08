import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const local = existsSync('.env')
  ? Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [
            l.slice(0, i).trim(),
            l
              .slice(i + 1)
              .trim()
              .replace(/^(['"])(.*)\1$/, '$2'),
          ];
        }),
    )
  : {};
const url = process.env.SUPABASE_URL ?? local.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? local.SUPABASE_ANON_KEY ?? '';
if (!!url !== !!key) throw new Error('Informe SUPABASE_URL e SUPABASE_ANON_KEY juntas.');
if (url && !/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(url))
  throw new Error('SUPABASE_URL deve ser uma URL HTTPS válida.');
if (key.startsWith('sb_secret_'))
  throw new Error('Chaves secretas não podem ser usadas no frontend.');
try {
  if (
    key.split('.').length === 3 &&
    JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'
  )
    throw new Error('service_role não pode ser usada no frontend.');
} catch (e) {
  if (e.message.includes('service_role')) throw e;
}
const onlinePayments =
  (process.env.ONLINE_PAYMENTS_ENABLED ?? local.ONLINE_PAYMENTS_ENABLED ?? 'false') === 'true';
const demo = !url && (process.env.DEMO_MODE ?? local.DEMO_MODE ?? 'true') === 'true';
writeFileSync(
  'src/app/core/environment.ts',
  `// Generated: public configuration only.\nexport const environment = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key, demo, onlinePayments }, null, 2)} as const;\n`,
);
