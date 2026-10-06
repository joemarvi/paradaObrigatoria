# Deploy em Cloudflare Pages e Supabase

1. Configure Supabase conforme o README, migrations e perfis fechados por convite.
2. Confirme o repositório remoto correto, revise o histórico e envie os commits quando desejar.
3. Crie um projeto Pages conectado ao repositório.
4. Configure `NODE_VERSION=24.18.0`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEMO_MODE=false`.
5. Build: `npm run build`; saída: `dist/parada-obrigatoria/browser`.
6. Configure Site URL e redirect `/admin/login` no Supabase Auth com o domínio Pages.
7. Abra `/admin/login`, rotas profundas, recuperação de senha e navegação mobile. Execute um ciclo completo de atendimento/caixa com cada papel.

`public/_redirects` fornece fallback SPA; `_headers` fornece CSP, bloqueio de iframe e restrições de recursos. CSP autoriza o domínio padrão `*.supabase.co`; se usar domínio Supabase personalizado, acrescente **somente** esse domínio em connect-src. Não libere scripts externos indiscriminadamente.

Variáveis públicas são substituídas no build. Alterações exigem rebuild. `.env` local e arquivo gerado não são versionados. Credenciais de administração, SMTP ou tokens Cloudflare nunca entram no bundle. Não executar `supabase db push` sem selecionar o projeto certo.

## Custo e limites

Consulte fontes oficiais antes de ativar: [Supabase Pricing](https://supabase.com/pricing), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/). Free tiers possuem cotas e não constituem garantia de disponibilidade contínua; revise pausas, backup, e-mail, banda, banco e builds. Nesta entrega não foi adicionado serviço pago nem realizada publicação.

## PWA e offline

Manifest e ícone local fornecidos. Service worker/caching offline adiado: dados autenticados não devem aparecer após logout em dispositivo compartilhado. Uma PWA completa futura deve incluir ícones raster exigidos pelo navegador, cache apenas de shell público e limpeza explícita de dados. Não há operação offline ou fila de sincronização.
