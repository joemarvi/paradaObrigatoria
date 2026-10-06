# Banco de dados e autorização

Aplique os arquivos SQL em ordem num projeto Supabase novo. Não execute repetidamente sobre um banco já migrado; use o registro de migrations do CLI em ambientes seguintes.

| Tabela             | Uso                                                    |
| ------------------ | ------------------------------------------------------ |
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
| audit_logs         | Usuário, ação, entidade, UUID e horário                |

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
