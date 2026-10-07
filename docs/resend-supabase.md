# Configurar Resend e Supabase — Parada Obrigatória

Roteiro para `joemarvi.com.br`, com autenticação no projeto Supabase `sogwnvyjjdkuroevrtof`. Configuração proposta: confirmação de e-mail ativada, remetente `nao-responda@joemarvi.com.br`, nome `Parada Obrigatória`.

**Status:** roteiro preparado; configuração externa e testes com entrega real ainda pendentes. As mudanças de SMTP são feitas no Supabase hospedado, sem rebuild da aplicação. O arquivo `supabase/config.toml` configura o ambiente local e não altera o projeto hospedado.

## 1. Preparar as contas

1. Entre ou crie sua conta no [Resend](https://resend.com).
2. Confirme o acesso ao Cloudflare da zona `joemarvi.com.br` e ao projeto Supabase indicado acima.
3. Consulte no Resend o plano, cotas diárias/mensais, restrições de conta e aprovação de produção, se exigida. Escolha capacidade suficiente para confirmações e recuperações, não apenas para cadastros.
4. Separe duas caixas de e-mail reais sob seu controle para os testes, preferencialmente em provedores diferentes. Não use endereços fictícios: precisamos testar recebimento e abertura dos links.

## 2. Adicionar o domínio no Resend

1. Abra **Domains → Add Domain**.
2. Informe `joemarvi.com.br` e escolha uma região disponível.
3. Habilite envio. Recebimento de e-mail não é necessário para Supabase Auth.
4. O painel mostrará os registros de verificação, incluindo DKIM e SPF/Return-Path. Copie tipo, nome, conteúdo e prioridade dos registros específicos do seu domínio. Não use uma chave DKIM de exemplo.

Este roteiro usa o domínio raiz para manter o remetente combinado. Uma futura separação por subdomínio, como `auth.joemarvi.com.br`, exigiria verificar esse subdomínio e atualizar o remetente para ele.

## 3. Publicar DNS no Cloudflare

Abra **joemarvi.com.br → DNS → Records → Add record** e transcreva cada registro exigido pelo Resend:

| Campo Resend | Campo Cloudflare |
|---|---|
| Type | Tipo |
| Name | Nome |
| Content/Value | Conteúdo ou servidor de e-mail |
| Priority (MX) | Prioridade |

Use TTL Auto. Se aparecer opção de proxy para um registro de e-mail, use **DNS only**. TXT e MX não usam proxy. Preserve os registros web `@` e `www`, e eventuais MX/TXT de outros serviços.

No campo Nome, use a parte relativa à zona: por exemplo, `send.joemarvi.com.br` vira `send`; `resend._domainkey.joemarvi.com.br` vira `resend._domainkey`. Esses nomes são exemplos: os valores reais vêm do painel. Não crie dois registros SPF distintos no mesmo nome. Se já existir um SPF nesse nome, revise a composição antes de alterar.

Depois de salvar, volte ao Resend e solicite a verificação. Avance somente quando o domínio estiver **Verified** e os registros necessários ao envio estiverem válidos. Registros opcionais de recebimento não precisam ser ativados.

Para conferir DNS público, substitua os nomes abaixo pelos nomes reais do painel:

```bash
dig @1.1.1.1 +short TXT resend._domainkey.joemarvi.com.br
dig @1.1.1.1 +short TXT send.joemarvi.com.br
dig @1.1.1.1 +short MX send.joemarvi.com.br
```

## 4. Criar a credencial de envio

1. No Resend, abra **API Keys → Create API Key**.
2. Nome: `parada-obrigatoria-supabase-auth`.
3. Use permissão de envio e restrinja ao domínio verificado, se a opção estiver disponível.
4. Copie a chave para um gerenciador de senhas e depois diretamente para o campo Password do Supabase.

A chave é a senha SMTP. Não a coloque no frontend, `.env` do Angular, repositório ou mensagens de chat. O remetente pode enviar sem criar uma caixa postal; isso não cria uma caixa para receber respostas. Para atendimento, use um endereço real monitorado quando personalizar Reply-To/templates.

## 5. Configurar SMTP no Supabase

No projeto `sogwnvyjjdkuroevrtof`, abra **Authentication → Email → SMTP Settings** (a seção pode aparecer em Notifications) e ative **Enable custom SMTP**.

| Campo | Valor |
|---|---|
| Sender email address | `nao-responda@joemarvi.com.br` |
| Sender name | `Parada Obrigatória` |
| Host | `smtp.resend.com` |
| Port number | `465` |
| Minimum interval per user | `60` segundos |
| Username | `resend` |
| Password | API key criada no Resend |

Salve, saia da tela e volte para confirmar que a configuração permanece habilitada. Não use a senha da conta Resend nem a antiga senha de app Gmail.

## 6. Configurar autenticação e cotas

1. Em **Authentication → Sign In / Providers → Email**, mantenha cadastro por e-mail habilitado e **Confirm email** ativado.
2. Em **Authentication → URL Configuration**, configure Site URL `https://joemarvi.com.br`.
3. Autorize os redirects exatos:
   - `https://joemarvi.com.br/cliente`
   - `https://joemarvi.com.br/cliente/recuperar`
   - `https://joemarvi.com.br/admin/login`
4. Autorize também os três equivalentes com `https://www.joemarvi.com.br` se esse endereço for usado.
5. Em **Authentication → Rate Limits**, confira **Rate limit for sending emails**. Como ponto de partida para operação pequena, 30 por hora é uma escolha operacional, desde que compatível com as cotas da conta Resend. Ajuste ao volume real e acompanhe os dois serviços. SMTP próprio não elimina a cota do Supabase.
6. Preserve os templates de confirmação e recuperação fornecidos pelo Supabase durante a primeira validação. Se já foram personalizados, confirme que usam o link de autenticação gerado pelo Supabase, não somente a URL da home.
7. Mantenha click tracking desativado para links de autenticação no Resend. Não habilite novas transformações de links durante os testes.

Se a cota já foi consumida, aguarde a janela liberar antes do próximo teste. Não faça dezenas de tentativas seguidas.

## 7. Testar o cadastro completo

Faça o teste em janela anônima, com um e-mail novo sob seu controle:

1. Abra `https://joemarvi.com.br/cliente/cadastro`.
2. Preencha nome, telefone válido, e-mail e senha com pelo menos 8 caracteres; confirme a senha.
3. Marque/desmarque **Mostrar senhas**. Os dois campos devem alternar entre texto e senha sem apagar valores.
4. Clique uma vez em Criar conta. A página deve solicitar confirmação por e-mail; não deve apresentar limite de envio nem erro interno.
5. No Resend, abra **Emails** e procure a mensagem: destinatário, remetente e status corretos. Aceitação/entrega pelo provedor não comprova chegada à caixa de entrada; confira a caixa e spam.
6. Abra o e-mail recebido, confira remetente e clique no link no mesmo navegador do teste.
7. O link deve levar ao domínio de produção e ao contexto `/cliente`. Se aparecer **Complete seu Cadastro**, preencha nome e telefone e salve; o fluxo atual conclui os dados do cliente após confirmação.
8. Confirme que aparecem nome do cliente, veículos e agendamentos. No Supabase, verifique usuário com e-mail confirmado em Authentication → Users e a associação em `customer_accounts`/`customers`.
9. Esse cadastro não deve criar perfil de equipe em `profiles` nem conceder acesso administrativo.

Não altere RLS ou conceda papéis administrativos para contornar erros de cadastro. Se a conclusão do cliente falhar com função/tabela inexistente, confirme a aplicação das migrations 001 a 007 no projeto correto antes de executar SQL.

## 8. Testar login e agendamento

1. Saia da área do cliente e entre novamente em `/cliente/entrar` usando a mesma conta.
2. Confirme que Entrar e Agendar na home encaminham ao fluxo correto.
3. Cadastre um veículo de teste. Com serviço e horário disponíveis, crie um agendamento identificado como teste.
4. Confirme que ele aparece para esse cliente e cancele pelo fluxo normal ao terminar, evitando ocupar a agenda real.
5. Em outra sessão com a segunda conta de teste, confirme que os veículos/agendamentos da primeira não aparecem.
6. Faça uma tentativa de login com senha incorreta: deve aparecer mensagem clara e não abrir a área autenticada.

## 9. Testar recuperação de senha

1. Saia da conta. Abra `/cliente/recuperar` e solicite recuperação para o e-mail confirmado.
2. Confira envio no Resend e recebimento na caixa de e-mail.
3. Abra o link no mesmo navegador. Deve aparecer **Defina sua Nova Senha** no contexto do cliente.
4. Teste Mostrar senha, escolha nova senha válida e salve.
5. Entre com a nova senha e confirme que a antiga não permite login.
6. Abra novamente o link já consumido: ele não deve permitir redefinir a senha de novo sem nova autenticação/solicitação.
7. Se houver conta administrativa de teste, valide também a recuperação em `/admin/login`, mantendo a separação das páginas públicas.

## 10. Registrar resultado e acompanhar

| Verificação | Status / evidência |
|---|---|
| Domínio Resend Verified | Pendente |
| SMTP salvo e persistente | Pendente |
| Cotas Supabase/Resend revisadas | Pendente |
| Confirmação recebida e endereço correto | Pendente |
| Cliente confirmado e associado | Pendente |
| Login e isolamento entre clientes | Pendente |
| Agendamento e cancelamento de teste | Pendente |
| Recuperação e nova senha | Pendente |
| Desktop/mobile e mostrar senha | Pendente |

Registre horário, resultado e IDs das mensagens sem copiar senhas, tokens ou URLs de autenticação completas. Acompanhe bounces, bloqueios, cotas e erros Auth durante os primeiros dias. Evite retries automáticos de envio que consumam a cota. A configuração só está homologada depois dos testes reais acima.

## Solução de problemas

| Sintoma | Verificação |
|---|---|
| `over_email_send_rate_limit` | SMTP persistente, cota de e-mail no Supabase e janela consumida |
| Erro de autenticação SMTP | Host, porta, usuário `resend`, validade e permissão da API key |
| Domínio/remetente não autorizado | Domínio Verified, remetente no domínio e restrição da chave |
| Envio aceito mas mensagem ausente | Resend Emails, bounce/suppression, spam e endereço digitado |
| Link leva ao localhost | Site URL, redirects e templates Supabase |
| Link inválido antes do uso | Expiração, tracking, scanners de segurança e logs Auth |
| HTTP 500 em `/signup` | Corpo da resposta e Logs → Auth → event_message; o código sozinho não identifica banco/SMTP |
| Cliente confirma mas portal não conclui | Migrations, RPC `register_customer`, associação do cliente e logs PostgREST |

## Referências oficiais

- [Resend com Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Resend DNS no Cloudflare](https://resend.com/docs/knowledge-base/cloudflare)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Rate Limits](https://supabase.com/docs/guides/auth/rate-limits)
