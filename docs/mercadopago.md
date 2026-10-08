# Pagamentos Online com Mercado Pago

A implementação usa Checkout Pro (Preferences API) para cobrar o preço integral do serviço. O valor é obtido no banco, sem aceitar um preço enviado pelo navegador. O cliente também pode escolher pagamento após o serviço, sujeito à confirmação da equipe. Uma reserva antecipada permanece pendente até o webhook assinado consultar o pagamento diretamente no Mercado Pago e validar vendedor, preferência, valor, moeda e modo.

Esta entrega está restrita a testes. Cobranças reais são bloqueadas no backend. Não altere esse bloqueio antes de validar a integração, definir cancelamentos/reembolsos e integrar o crédito antecipado ao fechamento da ordem de serviço, para evitar cobrança em duplicidade. Os pagamentos de teste ficam separados do caixa e não representam receita real.

## Custos e Conta Pessoal

Você pode usar sua conta pessoal para criar a aplicação no painel Mercado Pago Developers. Para simular compras, use o vendedor de teste e um comprador de teste brasileiro diferentes, fornecidos no painel. Não use a própria conta pessoal como comprador/vendedor real para simular pagamentos.

Os testes não movimentam dinheiro real. A cobrança em produção tem tarifas por transação; este checkout não é uma solução sem taxas. Consulte os custos na sua conta antes de ativar pagamentos reais. Fontes: [custos do Mercado Pago](https://www.mercadopago.com.br/blog/quanto-custa-vender-on-line-com-mercado-pago), [contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts) e [compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases).

O débito online é o débito virtual Caixa suportado pelo provedor. A disponibilidade de Pix e cartões deve ser validada no checkout da conta de teste. Saldo em conta não pode ser excluído nesta API: o servidor também aceita esse tipo quando o pagamento pertence à preferência da reserva. [Meios de pagamento](https://www.mercadopago.com.br/developers/pt/docs/sales-processing/payment-methods), [exclusões no Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/payment-methods).

## Configuração no Supabase

1. Aplique as migrations 001 a 008 e depois `supabase/migrations/202610080009_online_booking_payments.sql` no SQL Editor do projeto dedicado a esta aplicação.
2. Crie a aplicação Checkout Pro em Mercado Pago Developers. Copie o Access Token do vendedor de teste e seu User ID. Um token de teste pode começar com `APP_USR`; o backend consulta `/users/me` e exige a identificação de conta de teste, sem depender do prefixo.
3. Configure estes secrets em Supabase → Edge Functions → Secrets:

| Secret | Valor |
| --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token do vendedor de teste |
| `MERCADOPAGO_SELLER_ID` | User ID do vendedor de teste |
| `MERCADOPAGO_MODE` | `sandbox` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Chave secreta da configuração de Webhooks |
| `PAYMENT_SITE_URL` | URL HTTPS do ambiente de teste, sem barra final |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados pelo runtime das Edge Functions. Nenhum token privado Mercado Pago ou service_role deve entrar no `.env` do Angular, no repositório ou no chat.

4. Publique as funções:

```sh
supabase functions deploy mercadopago-checkout --project-ref sogwnvyjjdkuroevrtof
supabase functions deploy mercadopago-webhook --project-ref sogwnvyjjdkuroevrtof
```

O `supabase/config.toml` desativa a verificação JWT do gateway para essas funções. A função checkout verifica o usuário autenticado e a propriedade da reserva; a função webhook verifica a assinatura HMAC. Não remova essas verificações.

5. No painel Mercado Pago, configure Webhooks de **Pagamentos** para a URL abaixo, no ambiente de teste. Cadastre a chave secreta correspondente no Supabase:

```text
https://sogwnvyjjdkuroevrtof.supabase.co/functions/v1/mercadopago-webhook
```

6. No Supabase, habilite Cron e crie um job a cada minuto com o SQL `select public.expire_booking_payments();`. A função é restrita ao backend. Reservas pendentes expiram em 15 minutos ou no início do atendimento, o que ocorrer primeiro. Sem Cron, a limpeza também acontece ao criar uma nova reserva; a lista pode continuar mostrando o estado pendente até essa limpeza.
7. Somente após configurar os passos anteriores, defina `ONLINE_PAYMENTS_ENABLED=true` no `.env` do build do ambiente de teste e execute `npm run build`. Por padrão, a opção online fica desativada, preservando o agendamento atual sem exigir migration em produção.

O checkout usa `init_point` com credenciais do vendedor de teste, conforme [orientação oficial para testes do Checkout Pro](https://www.mercadopago.com.br/developers/pt/news/2023/11/16/Questions-on-how-to-test-your-integration--). O usuário deve usar a conta comprador de teste em uma janela anônima.

## Validação Antes da Ativação

Execute `npm run test:db`, `npm run test:payments`, `npm run test:portal`, `npm test` e `npm run build`. Para as Edge Functions: `npx deno check supabase/functions/mercadopago-checkout/index.ts supabase/functions/mercadopago-webhook/index.ts`.

Com as credenciais configuradas, teste uma compra aprovada, uma recusada, expiração, repetição de webhook, retorno do checkout antes do webhook e cancelamento. O retorno da URL nunca confirma o pagamento: atualize a lista para consultar o resultado do servidor. Pagamentos aprovados de teste aparecem como **Pagamento de Teste Aprovado**, sem afirmar que houve pagamento real.

Cancelamentos pagos pelo cliente exigem contato com a equipe para revisão. O administrador pode cancelar a reserva, mas isso não reembolsa automaticamente. Pagamentos aprovados após expiração/cancelamento ficam em **REVIEW**, sem reativar a reserva; precisam de revisão e eventual reembolso no Mercado Pago. Reembolsos integrais e contestações recebidos por webhook removem a confirmação da reserva. Reembolsos parciais e disputas antes do estorno precisam de revisão manual.

A ativação real continua pendente de: teste ponta a ponta com as credenciais da sua conta, aceite das tarifas, definição da política de cancelamento e integração do crédito antecipado ao caixa/ordem de serviço. A confirmação de teste não deve ser usada para prometer reserva paga a clientes reais.
