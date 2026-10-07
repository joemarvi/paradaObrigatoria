# Publicação no Ubuntu com Cloudflare

Aplicação Angular estática, com backend Supabase. Workers e Pages não são necessários para esta arquitetura.

- Servidor Ubuntu 24.04: `54.233.68.180`.
- Domínio: `joemarvi.com.br` (alias `www.joemarvi.com.br`).
- Projeto: `/home/ubuntu/paradaObrigatoria`.
- Apache: `/etc/apache2/sites-available/joemarvi.conf`.
- Publicação: `/var/www/parada-obrigatoria/current`, apontando para uma versão em `releases`.
- Configuração inicial: `deploy/apache-joemarvi.conf`. Configurações atuais: `deploy/apache-joemarvi-http-https.conf` e `deploy/apache-joemarvi-ssl.conf`.

## Situação da preparação

Build de produção com `DEMO_MODE=false`. Credenciais públicas Supabase copiadas de `.env.example` para `.env` local (não versionado). Confirmar que o projeto Supabase indicado é o projeto desejado antes de receber clientes reais. Não foram alteradas migrations, políticas ou usuários do Supabase.

Apache configurado para domínio e alias, fallback SPA, cabeçalhos de segurança e HTML sem cache. O virtual host padrão foi preservado. Em 6 de outubro de 2026, DNS público confirmado com nameservers `coco.ns.cloudflare.com` e `vasilii.ns.cloudflare.com`; domínio e www apontam para `54.233.68.180`. HTTPS instalado com Let’s Encrypt para ambos os nomes, validade inicial até 4 de janeiro de 2027. Redirecionamento HTTP → HTTPS testado inclusive em rotas internas. Timer de renovação habilitado e simulação de renovação concluída com sucesso. Conta ACME criada sem e-mail de contato; pode ser atualizado posteriormente. O www foi testado com resolução explícita para o IP porque o resolvedor local ainda mantinha cache negativo. Ativação do proxy Cloudflare e configuração Supabase Auth continuam pendentes de confirmação no painel.

## Cloudflare e Registro.br

1. Conferir no Registro.br se o domínio está registrado e ativo.
2. Adicionar `joemarvi.com.br` ao Cloudflare. Revisar e preservar registros existentes, especialmente MX/TXT de e-mail.
3. Criar `A @ 54.233.68.180` e `CNAME www joemarvi.com.br`. Durante a emissão inicial do certificado, deixar ambos como **DNS only**.
4. Copiar os dois nameservers específicos fornecidos pela zona Cloudflare para o Registro.br. Não inventar os nomes. Se houver DNSSEC ativo, coordenar a atualização/remoção do DS antigo antes da troca e reativar após a zona estar ativa.
5. Aguardar ativação da zona e confirmar `dig +short joemarvi.com.br A` e `dig +short www.joemarvi.com.br A`.
6. No grupo de segurança AWS associado à instância, permitir TCP 80 e 443 para tráfego web. O UFW local estava inativo; o grupo AWS não foi inspecionado. Confirmar que o IP público é estável, preferencialmente Elastic IP.

## HTTPS após DNS ativo

No servidor:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-apache
sudo certbot --apache -d joemarvi.com.br -d www.joemarvi.com.br --redirect
sudo apache2ctl configtest
sudo certbot renew --dry-run
```

O Certbot solicita e-mail e aceite dos termos. Executar somente quando ambos os nomes resolverem para o servidor e a porta 80 estiver acessível externamente. O plugin modifica os virtual hosts para servir HTTPS e redirecionar HTTP. Não reinstalar o arquivo HTTP original sobre a configuração modificada pelo Certbot.

Após testar HTTPS no servidor, ativar **Proxied** nos registros Cloudflare, escolher SSL/TLS **Full (strict)** e ativar **Always Use HTTPS**. Preservar o bypass padrão para HTML; não criar regra Cache Everything para a aplicação autenticada.

## Supabase Auth

Para configurar envio transacional com confirmação de e-mail, siga [Resend e Supabase: configuração até os testes finais](resend-supabase.md).

Em Authentication → URL Configuration, definir Site URL `https://joemarvi.com.br` e adicionar as URLs de redirecionamento:

- `https://joemarvi.com.br/cliente`
- `https://joemarvi.com.br/cliente/recuperar`
- `https://joemarvi.com.br/admin/login`

Adicionar os equivalentes em `https://www.joemarvi.com.br` se o alias continuar sendo usado. Validar cadastro, confirmação de e-mail e recuperação de senha. As rotas administrativas permanecem separadas das páginas públicas.

## Atualizações e rollback

```bash
cd /home/ubuntu/paradaObrigatoria
bash scripts/deploy-server.sh
```

O script usa dependências já instaladas. Se o lockfile mudar, executar `npm ci` antes. Cada publicação cria uma versão nova e troca o symlink de forma atômica; versões anteriores são preservadas. Para rollback, selecionar uma versão anterior em `releases`, criar um symlink temporário para ela e usar `sudo mv -Tf` para substituir `current`.

## CSS e política de segurança

A configuração de produção em `angular.json` usa `optimization.styles.inlineCritical=false`. A extração de CSS crítico gerava um script inline para ativar a folha de estilos; esse script era bloqueado por `script-src self`, deixando o CSS com `media=print`. O build agora carrega a folha diretamente, mantendo minificação e a política de segurança. Preservar essa opção em builds futuros.

## Validação

Verificar página inicial, `/cliente/entrar`, `/cliente/recuperar`, `/admin/login`, fontes locais e assets. Arquivos inexistentes devem retornar 404. Confirmar cabeçalhos de segurança, HTTPS válido, redirecionamento HTTP, status do Apache após reboot e renovação automática do certificado. A autenticação completa exige teste com usuários apropriados; build e resposta HTTP não comprovam configuração do backend.

Referências: [Cloudflare DNS](https://developers.cloudflare.com/dns/get-started/), [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

---

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

## Limite de envio de e-mails no cadastro

`over_email_send_rate_limit` indica que o projeto atingiu a cota de envio de e-mails Auth. O provedor integrado tem limite documentado de 2 e-mails por hora por projeto e restrições de destinatários. Para cadastro público, configurar SMTP próprio em Authentication → Email → SMTP Settings e revisar Authentication → Rate Limits. Configurar remetente, host, porta, usuário e senha no painel Supabase, nunca no frontend. Validar domínio remetente conforme o provedor e testar confirmação e recuperação após a configuração. Aguardar liberação da cota serve apenas para diagnóstico, não substitui configuração de produção.

Referências: [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
