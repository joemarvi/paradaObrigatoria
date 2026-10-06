# Parada Obrigatória

Sistema web em português para a operação de um lava-jato: atendimento, clientes, veículos, serviços, agenda, pagamentos, caixa e gestão.

## Estado da entrega

Aplicação Angular funcional com **modo de demonstração explícito**, integração com Supabase e migrations PostgreSQL. A demonstração usa registros fictícios e alterações em memória, descartadas ao recarregar a página. Não é um banco de produção nem uma sessão Supabase.

**Ainda é necessário criar/configurar um projeto Supabase, aplicar as migrations, convidar os usuários e preencher as duas variáveis públicas.** Não havia credenciais, banco ou remote Git no diretório original. Autenticação contra o serviço hospedado só pode ser homologada depois disso.

A identidade visual segue o emblema enviado pelo proprietário: azul/ciano da água, vermelho da faixa, amarelo do nome e branco da espuma. O logo preparado a partir da referência aparece no login e na navegação, com paleta centralizada em `src/styles.scss`. Veja [cores e preparação do logo](docs/branding.md).

## Stack e requisitos

- Linux x64, Node **24.18.0**, npm **11.16.0**; Angular CLI **22.0.7**.
- Framework Angular e builder **22.2.1**, standalone, Signals, Reactive Forms, Router com lazy loading, HttpClient disponível.
- Supabase JS, Auth e PostgreSQL com RLS e operações transacionais.
- Vitest, Playwright e PostgreSQL embarcado PGlite para testes.
- SCSS sem biblioteca visual paga ou fonte externa.

O framework permanece na major 22 solicitada. A versão 22.0.7 do framework/builder apresentou alertas de segurança; foram aplicadas correções 22.2.1 e overrides de dependências de compilação. O CLI foi mantido em 22.0.7. O lockfile registra as versões efetivas; audite novamente antes de publicar.

## Executar localmente

```bash
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:4200`. Sem variáveis Supabase, use **Abrir demonstração**. O servidor escuta somente localhost por padrão; para testar outro dispositivo, execute `npm start -- --host 0.0.0.0` em uma rede confiável.

Com Supabase configurado, a demonstração é automaticamente desabilitada, independentemente de `DEMO_MODE`. Em produção use `DEMO_MODE=false`.

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
DEMO_MODE=false
```

O script `scripts/environment.mjs` lê `.env` ou o ambiente de build e gera `src/app/core/environment.ts`, ignorado pelo Git. Essas duas configurações são públicas e ficam no bundle; a segurança dos dados depende de Auth e RLS. Nunca forneça `service_role` ou `sb_secret_` ao frontend. O gerador bloqueia esses tipos de chave. Não há armazenamento de dados de cartão.

## Supabase

1. Crie um projeto PostgreSQL no plano adequado do Supabase.
2. No SQL Editor, execute **em ordem** os sete arquivos de `supabase/migrations/`. Alternativamente, com Supabase CLI e projeto vinculado, use `supabase db push`.
3. Em Authentication, habilite cadastro por e-mail para os clientes e mantenha a confirmação de e-mail. Configure Site URL e URLs autorizadas (`http://localhost:4200/admin/login`, `http://localhost:4200/cliente` e as URLs finais `/admin/login` e `/cliente`). Configure a política de senha com mínimo de 8 caracteres. Para e-mails de recuperação em produção, avalie as limitações do provedor de e-mail padrão e configure SMTP de sua escolha se necessário; nenhum SMTP pago foi adicionado.
4. Crie ou convide o primeiro usuário pelo painel Auth. Copie seu UUID. Pelo SQL Editor, provisionado por um administrador do projeto, execute:

```sql
insert into public.profiles(id, name, role, active)
values ('UUID_DO_USUARIO_AUTH', 'Administrador', 'administrador', true);
```

5. Convide demais usuários e insira seus perfis, inicialmente com a menor permissão necessária. Não existe promoção automática por metadata, signup ou primeiro login. O cadastro público cria somente um vínculo de cliente; os perfis da equipe continuam provisionados pelo administrador.
6. Preencha `.env`, reinicie e valide login, recuperação, logout, cada perfil e as operações do caixa no projeto real.
7. Cadastre categorias, serviços, equipe, clientes e veículos pela aplicação. Não existe seed de dados fictícios em produção.

Detalhes: [banco e permissões](docs/database.md), [arquitetura](docs/architecture.md), [validação e pendências](docs/validation.md).

## Home pública

A home informa lavagem americana simples (hatch/sedan) a partir de R$ 60, SUV com cera líquida Vonixx a partir de R$ 70, caminhonete com cera líquida Vonixx a partir de R$ 80 e moto com cera líquida Vonixx a partir de R$ 35. Divulga também aspiração interna, polimento e cera e limpeza de rodas/pneus, sem inventar preços para esses cuidados. Contatos: (61) 99137-9913 e (61) 99170-5891; Condomínio Mestre D’Armas, em frente ao Posto Tiquira. O link de mapa pesquisa a região; não presume coordenadas do estabelecimento.

A tabela pública reproduz as imagens em `src/app/pages/home.ts`. Serviços e valores disponíveis para reserva continuam sendo os do catálogo configurado pela equipe; mantenha ambos alinhados. A home não consulta nem expõe tabelas internas, não exige login e mantém o acesso de equipe em `/admin/login`, protegido pelo perfil e RLS.

## Portal do cliente

A página inicial `/` é pública e apresenta serviços, preços iniciais, contatos e localização das imagens fornecidas. O botão de agendamento abre `/cliente`. O cliente cria uma conta com nome, telefone, e-mail e senha; confirma o e-mail; entra e conclui seus dados, se necessário. Depois cadastra um veículo, seleciona serviço e horário e acompanha ou cancela suas próprias reservas futuras. A equipe continua entrando por `/admin/login` e visualiza as reservas em `/admin/agendamentos`.

**Projeto já configurado com as migrations 001 a 006:** aplique somente `supabase/migrations/202610060007_customer_portal.sql`. No painel Supabase, habilite cadastro por e-mail e autorize o redirecionamento para `/cliente`. A alteração de `supabase/config.toml` configura o ambiente local; não altera automaticamente o projeto hospedado.

O portal usa `customer_accounts`, sem atribuir papel de funcionário. RLS restringe os dados ao cliente ativo; RPCs validam a propriedade do veículo, serviço ativo, duração do catálogo, horário futuro (até 365 dias) e capacidade simultânea. Valores de identidade nunca são obtidos por correspondência automática de telefone/e-mail. Clientes existentes podem precisar de conciliação pela equipe, pois o cadastro público cria um novo registro de cliente. Horários comerciais ainda são texto livre nas configurações; a reserva valida capacidade, mas não impõe uma grade de funcionamento.

## Funcionalidades

- Login, recuperação/troca de senha, logout, persistência de sessão e guardas por perfil.
- Clientes com CPF/CNPJ, contatos, endereço, observações, ativação/desativação e histórico carregado.
- Veículos por cliente, placa antiga/Mercosul, tipo, marca/modelo, ano, cor e busca.
- Serviços e categorias, preço, duração, descrição e status; preços históricos independentes do catálogo.
- Entrada rápida e OS com múltiplos serviços, produto opcional, descontos/acréscimos, responsável, previsão, combustível, avarias e objetos.
- Quadro de atendimento, progressão validada de status, atribuição de funcionário, cancelamento e saída após pagamento. Cortesias com total zero podem ser finalizadas por perfis de escritório.
- Agenda diária, semanal e lista; confirmação, remarcação, conclusão, cancelamento e não comparecimento; capacidade concorrente validada no banco.
- Recebimento integral/parcial, dividido entre duas formas, dinheiro/PIX/débito/crédito/transferência/outros; proteção contra pagamento excessivo e duplicação após quitação.
- Caixa único aberto, abertura, reforço, despesa, sangria, fechamento e diferença de conferência. Saldo físico considera somente dinheiro; relatório de recebimentos inclui todas as formas.
- Dashboard com fila, serviços, agenda, valores recebidos, caixa e alertas, usando agregação no servidor.
- Relatórios por período: recebimentos, serviços, veículos concluídos, cadastros, cancelamentos, formas de pagamento, funcionários, movimentos e exportação CSV protegida contra fórmulas.
- Configurações do negócio, usuários existentes/perfis e auditoria sem conteúdo pessoal desnecessário.

## Verificações

```bash
npm test
npm run test:db
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:portal
npm run lint
npm run build
npm audit
```

Os testes operacionais de navegador usam a demonstração. `npm run test:portal` testa o fluxo do cliente com respostas simuladas de Auth/PostgREST em um servidor próprio e restaura a configuração local ao terminar; não cria registros no Supabase remoto. Os testes de banco executam as migrations em PostgreSQL embarcado, com `auth.users`, `auth.uid()` e roles equivalentes para testar RLS. Apenas a criação da extensão `pgcrypto` é omitida nesse teste: `gen_random_uuid()` já é nativo. Isso não substitui a homologação de Supabase Auth, PostgREST, recuperação por e-mail e concorrência no serviço real.

## Estrutura

```text
src/app/
  core/       modelos, autenticação, domínio, store, relatórios, notificações
  features/   dashboard, cadastros, ordens, agenda, financeiro, relatórios, configurações
  layout/     navegação e estrutura responsiva
  pages/      login e página não encontrada
  shared/     ícones SVG, modal com foco, estados vazios e badges
supabase/migrations/  schema, operações, relatórios, integridade, busca paginada, totais financeiros
tests/               integração PostgreSQL e fluxos Playwright
scripts/             geração de configuração pública
docs/                arquitetura, banco, deploy e validação
```

Cadastros compartilham formulário/tabela configuráveis. Clientes e veículos possuem campos e validadores próprios; regras financeiras ficam no domínio e no PostgreSQL. Evitam-se pastas vazias e wrappers sem função. Botões, inputs e tabelas usam estilos comuns; modal, badge, ícone e estado vazio são componentes.

## Deploy gratuito

O frontend gera arquivos estáticos em `dist/parada-obrigatoria/browser`. Cloudflare Pages: build `npm run build`, saída `dist/parada-obrigatoria/browser`, Node 24.18.0 e variáveis públicas acima. Há fallback SPA e headers de segurança em `public/`. Nenhum deploy foi executado. Veja [deploy](docs/deployment.md).

Supabase e Cloudflare oferecem planos gratuitos sujeitos a limites, pausas e mudanças. Verifique os limites atuais antes de ativar a operação: [Supabase Pricing](https://supabase.com/pricing), [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/). Não há gateway de pagamentos, WhatsApp automático, SaaS pago, domínio comprado ou Storage provisionado. O registro de PIX/cartões é manual e não processa transações bancárias.

## Limitações e evolução

- Instância para **um lava-jato**. Não é multitenant; introduza `business_id` e políticas de isolamento antes de compartilhar o banco com outras empresas.
- Cadastros consultam o servidor com filtros e paginação de 12 registros, incluindo busca de veículo por telefone/nome do cliente. Operações e seletores carregam lotes de 200 registros, com aviso e botão para continuar; seletores e histórico usam o conjunto carregado. Dashboard, caixa e relatórios calculam totais sobre todo o banco com filtros por data.
- Histórico de cliente/veículo usa OS carregadas. Preços de serviços, produtos e totais ficam registrados na criação da OS; edição de itens/descontos após criação, reembolsos e estornos ainda não estão implementados.
- Fila atualizada ao entrar/recarregar; não há assinatura Realtime ou notificações WhatsApp.
- Manifest de instalação incluído; PWA completa com service worker foi adiada para evitar cache indevido de dados autenticados. Não há fila offline ou sincronização. Os SVGs podem exigir substituição por PNGs para critérios de instalação de alguns navegadores.
- Cadastro de usuário Auth por convite no painel; UI altera somente perfis existentes. Não há secrets administrativos no navegador.
- Agenda permite edição de status e valida capacidade, mas não cria automaticamente uma OS; entrada é registrada no módulo de ordens.
- Relatórios de ticket mostram recebido no período ÷ ordens com recebimento, inclusive pagamentos parciais. Valores dos serviços/desempenho usam conclusão e são distintos dos recebimentos.
- SMTP e autenticação hospedada aguardam homologação no ambiente real. Faça um piloto com dados reais antes do uso financeiro diário.

## Git

O diretório original não possuía repositório válido nem remote. Foi inicializado `main` localmente; nenhum remote foi inventado e nenhum push foi realizado. Commits devem separar fundação, banco/operação e validação/documentação. Confirme o destino antes de conectar o repositório:

```bash
git status
git log --oneline
git remote -v
# Depois de confirmar o repositório correto:
git remote add origin URL_DO_REPOSITORIO
# Revisar antes de publicar; nenhum push automático.
```

## Separação de acessos

O site público não divulga links de acesso da equipe. Rotas: `/` (home), `/cliente/cadastro` (cadastro iniciado pela home), `/cliente/entrar` (login), `/cliente/recuperar` (recuperação) e `/cliente` (veículos e reservas após autenticação). Login e cadastro têm componentes e formulários distintos.

A equipe usa diretamente `/admin/login` e navega em `/admin/...`. A autenticação administrativa exige perfil ativo da equipe; uma conta de cliente é recusada. O login do cliente recusa perfis da equipe. As permissões efetivas permanecem no banco por RLS/RPC; a ausência de um link público não substitui controle de acesso. Não há redirecionamento da antiga `/login` para divulgar o novo endereço.

No Supabase hospedado, atualize as URLs autorizadas para incluir `/admin/login`, `/cliente` e `/cliente/recuperar` no domínio do site. A recuperação de senha mantém o usuário no seu contexto. Não é necessária nova migration para esta separação.
