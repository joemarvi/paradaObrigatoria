# Banco de dados e autorização

Aplique os arquivos SQL em ordem num projeto Supabase novo. Não execute repetidamente sobre um banco já migrado; use o registro de migrations do CLI em ambientes seguintes.

| Tabela             | Uso                                                    |
| ------------------ | ------------------------------------------------------ |
| customer_accounts  | Vínculo de conta Auth com cliente, sem papel de equipe |
| profiles           | Perfil associado ao UUID de Auth, papel e acesso ativo |
| customers          | Clientes e contatos                                    |
| vehicles           | Veículos e cliente proprietário                        |
| service_categories | Categorias de catálogo                                 |
| services           | Preço atual e duração                                  |
| employees          | Equipe e vínculo opcional com perfil                   |
| appointments       | Agenda, duração e status                               |
| work_orders        | OS, valor, entrada/conclusão/saída e responsável       |
| work_order_items   | Snapshot de serviços/produtos e preços                 |
| payments           | Recebimentos sem informações de cartão                 |
| cash_registers     | Sessões de caixa e conferência                         |
| cash_movements     | Entradas, saídas, vendas e conferência                 |
| business_settings  | Configuração única da empresa                          |
| parada_audit_logs  | Usuário, ação, entidade, UUID e horário                |

UUIDs, timestamps, índices, foreign keys, constraints, enum de papéis/status/pagamento e atualização automática de `updated_at`. Número de OS sequencial não garante ausência de lacunas após rollback.

## Matriz de RLS

| Operação                              | Administrador | Gerente      | Atendente      | Operador       | Anônimo |
| ------------------------------------- | ------------- | ------------ | -------------- | -------------- | ------- |
| Leitura operacional                   | Sim           | Sim          | Sim            | Sim            | Não     |
| Clientes, veículos, agenda            | Criar/editar  | Criar/editar | Criar/editar   | Leitura        | Não     |
| Serviços, categorias, equipe, negócio | Criar/editar  | Criar/editar | Leitura        | Leitura        | Não     |
| Criar/cancelar OS e registrar saída   | Sim           | Sim          | Sim            | Não            | Não     |
| Iniciar/concluir execução             | Sim           | Sim          | Sim            | Sim            | Não     |
| Caixa e pagamentos                    | Sim           | Sim          | Sim            | Não            | Não     |
| Relatórios e auditoria                | Sim           | Sim          | Não            | Não            | Não     |
| Alterar perfis                        | Sim           | Leitura      | Próprio perfil | Próprio perfil | Não     |

Acesso depende de perfil **ativo**, consultado no banco. `has_role` é SECURITY DEFINER com search_path vazio e leitura controlada; evita recursão na política de profiles. Metadata do usuário nunca autoriza acesso. Anônimos não recebem privilégios de tabela. Exclusão não está exposta; preservar histórico através de status/inativação.

## Operações atômicas

- `create_work_order`: confere cliente/veículo/funcionário ativos, serviços únicos, snapshots e totais, grava OS/itens juntos.
- `transition_order`: valida transições e permissões, conclusão/cancelamento.
- `assign_order_employee`: atribui equipe ativa antes de concluir.
- `record_payment`: bloqueia caixa e OS com `FOR UPDATE`, exige caixa aberto, aceita parcelas, rejeita excesso e conclui somente ao quitar.
- `settle_free_order`: finaliza cortesias com total zero após execução, sem inventar um pagamento.
- `release_vehicle`: somente OS paga/finalizada; saída uma vez.
- `open_register`: índice parcial permite apenas um caixa aberto.
- `move_cash`, `close_register`: trava o caixa, protege saldo físico, grava conferência.
- `management_report`, `dashboard_summary`: autorização explícita e agregações filtradas no servidor.

- `finance_summary`: totais financeiros e saldo físico de todo o caixa, sem depender dos lotes carregados na interface.
- `search_catalog`: busca paginada com whitelist de tabelas e parâmetros vinculados, executada como invoker com RLS.

Essas tabelas não concedem INSERT/UPDATE/DELETE direto ao usuário autenticado. Funções expostas revogam o EXECUTE padrão de PUBLIC. Não se armazena chave administrativa no cliente. O backend garante preço/total, mesmo se alguém alterar o JavaScript.

A agenda valida vínculo do veículo, serviços ativos e capacidade em qualquer limite de início. Advisory lock transacional serializa a validação de concorrência. Auditoria registra eventos sem snapshots completos de dados pessoais; logs não podem ser editados pelos usuários da aplicação.

## Homologação obrigatória

Os testes PGlite comprovam sintaxe SQL e parte do comportamento real de PostgreSQL/RLS. No Supabase real, conferir: revogação de sessão e de perfil ativo, Auth redirects e SMTP, chamadas PostgREST/RPC por perfil, requests simultâneos de pagamento/fechamento, capacidade de agenda e configuração de backup. Não foi aplicada nenhuma migration externa nesta entrega.

## Recuperação da execução interrompida

Se `001_schema` falhou porque `audit_logs` já existe e as migrations `003_reporting` e `006_finance_summary` foram executadas mesmo assim, aplique os seis arquivos corrigidos em ordem, de `001` a `006`, no SQL Editor. A transação de `001` foi revertida; por isso faltam `app_role` e `customers` nas migrations seguintes. Se a sessão informar que a transação está abortada, execute `ROLLBACK` antes de continuar.

A auditoria da aplicação agora usa `public.parada_audit_logs`. A tabela `public.audit_logs` existente, seus dados e permissões são preservados. As permissões de `001` se limitam às tabelas e à sequência da aplicação. `003` e `006` substituem as funções já criadas, sem exigir exclusão. As migrations dependentes verificam os pré-requisitos antes de criar objetos.

Este procedimento atende à falha relatada de `001`; não reaplique `001` se ela já foi concluída com sucesso. Em bancos já migrados, use uma nova migration de atualização.

## Portal do cliente (migration 007)

A migration `202610060007_customer_portal.sql` é incremental para bancos com `001` a `006` aplicadas. `customer_accounts` liga `auth.users` a um cliente e usa RLS de leitura do próprio vínculo. Não há trigger público de criação de perfis de equipe. Depois da confirmação e autenticação, `register_customer` provisiona o vínculo de forma idempotente e não aceita `customer_id` ou papel do usuário. Não vincula automaticamente cadastros existentes por contato.

As políticas adicionais permitem somente consultas de cliente, veículos e agendamentos próprios, além de serviços ativos. Os clientes escrevem apenas pelas RPCs `portal_add_vehicle`, `portal_book` e `portal_cancel`. A reserva usa a duração do catálogo e o trigger existente de capacidade sob trava transacional. O cliente não escolhe o status nem o proprietário da reserva, e só cancela reservas futuras em estado agendado/confirmado. Clientes desativados não acessam dados operacionais do portal.

## Cadastro bloqueado por provisionamento master (migration 008)

No projeto hospedado foi identificado o constraint trigger `auth.users.on_auth_user_created`, que chama `public.create_user_profile()` e exige um administrador master de um fluxo legado de tenants. O erro `Master provisioning required` desfaz a criação do usuário após o envio do e-mail. O responsável confirmou que o projeto é exclusivo da Parada Obrigatória.

Aplique `supabase/migrations/202610070008_customer_signup.sql` no SQL Editor do projeto correto, após a migration 007. O script verifica a assinatura do trigger diagnosticado e remove somente esse trigger. Preserva a função legada e todas as tabelas, dados e políticas. Pode ser executado novamente. Se encontrar um trigger com definição diferente, interrompe a transação para revisão.

Depois, faça um novo cadastro com um e-mail sob seu controle, confirme que o usuário aparece em Authentication → Users, abra a confirmação e conclua o cadastro no portal com Salvar Cadastro. Confira o vínculo em `customer_accounts` e o cliente em `customers`; não deve surgir perfil de equipe em `profiles`. Um e-mail enviado durante uma transação desfeita não comprova que o usuário existe; use a confirmação do novo cadastro.

A reversão manual está em `supabase/diagnostics/rollback-customer-signup.sql` e restaura o bloqueio anterior. Esta migration não configura SMTP nem aplica alterações automaticamente ao projeto hospedado.

## Agendamento Confirmado e Fila

Aplique `202610080010_appointment_work_orders.sql` no SQL Editor após as migrations do schema/portal (001–008). A migration 009 de pagamentos é opcional para esse ajuste. A confirmação passa a criar uma OS em **AGUARDANDO** com serviço, cliente, veículo, valor e previsão de conclusão. O vínculo `work_orders.appointment_id` é único. Reservas já confirmadas também recebem uma OS durante a aplicação; revise previamente eventuais OS criadas manualmente para as mesmas reservas, pois não existe vínculo confiável para identificá-las automaticamente.

Cancelar uma reserva cancela a OS vinculada que ainda está aguardando e não recebeu pagamentos. Uma OS iniciada ou paga exige tratamento pela equipe. O campo `created_by` pode ser nulo em confirmações automáticas, sem atribuir a ação a um funcionário fictício. Não execute criação manual adicional da OS ao confirmar.

Se aparecer a mensagem genérica de erro inesperado, o Console passa a registrar o erro original e a stack para diagnóstico. Essa mensagem, sozinha, não identifica a causa.
