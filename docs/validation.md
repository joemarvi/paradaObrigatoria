# Validação local — 06/10/2026

| Verificação      | Resultado                                                           |
| ---------------- | ------------------------------------------------------------------- |
| npm install      | Dependências instaladas e lockfile criado                           |
| npm run lint     | Sem erros ou avisos                                                 |
| npm run build    | Build de produção aprovado; sem warnings de compilação ou orçamento |
| npm test         | 17 testes de unidade aprovados                                      |
| npm run test:db  | 16 testes de PostgreSQL/RLS aprovados                               |
| npm run test:e2e | 7 testes de navegador aprovados                                     |
| npm audit        | 0 vulnerabilidades na auditoria realizada                           |

Total: **40 testes aprovados**. Bundle inicial: aproximadamente 312 kB brutos / 85 kB transferidos. Supabase SDK e módulos de funcionalidades são carregados sob demanda.

## Cobertura observada

- Cálculo em centavos, descontos, acréscimos, quantidades e pagamentos divididos.
- CPF/CNPJ por dígitos verificadores, placas, fuso de Brasília e validação de valores.
- Login por SDK simulado, perfil ativo/inativo, credenciais inválidas, logout e guardas por papel.
- Migrations executadas em PostgreSQL embarcado, simulando também os grants padrão do Supabase.
- Acesso anônimo negado; operador não altera cadastros, caixa ou permissões; perfil inativo perde acesso; administrador não desativa o próprio acesso.
- OS com snapshot de preço, rejeição de relacionamentos inválidos e rollback, transições permitidas, cortesia e liberação após quitação.
- Caixa único, pagamento que exige caixa aberto, proteção contra excesso, múltiplas formas, quitação, sangria com saldo e fechamento.
- Saldo/totais e pagamento parcial corretos após **mais de 200 movimentos**, sem depender da paginação da UI.
- Busca paginada por telefone do proprietário, whitelist de tabelas, agenda com limite de capacidade e auditoria restrita.
- Todas as rotas principais, criação de cliente e veículo com telefone/CPF formatados, entrada→serviço→pagamento dividido→saída→fechamento, agenda→confirmação→remarcação→cancelamento e exportação CSV.
- Ausência de rolagem horizontal da página no dashboard em 1920×1080, 1440×900, 1366×768, tablet 834×1112 e celular 390×844; fila em celular, menu responsivo, Escape e restauração do foco no modal.

## Portal do cliente

Validação local após integrar a migration 007: 23 testes de banco, 18 testes unitários, 7 cenários de navegador da equipe e 1 cenário de navegador do portal, além de lint e build. O fluxo do portal usa respostas simuladas de Supabase Auth/PostgREST: cadastro com confirmação pendente, entrada, conclusão de cadastro, veículo, reserva, cancelamento e logout. A simulação não envia nem confirma e-mails reais.

Os testes PostgreSQL cobrem isolamento entre clientes, impossibilidade de criar perfil administrativo ou escrever diretamente uma reserva, acesso negado a operações financeiras, idempotência de cadastro, propriedade do veículo, duração do serviço, limite de capacidade, horário futuro, cancelamento e bloqueio de cliente inativo. As reservas são consultáveis pela equipe na mesma tabela de agendamentos.

## Limites desta validação

Não foram homologados login e persistência de sessão no Supabase hospedado, envio/confirmação de e-mail, PostgREST hospedado, concorrência entre conexões reais ou deploy. Nenhuma alteração foi aplicada ao banco remoto nesta etapa.

PGlite executa PostgreSQL e RLS, mas não simula o serviço completo de Supabase Auth. Os testes de navegador usam demonstração para a equipe e respostas simuladas de Supabase para o portal. A extensão pgcrypto não é instalada no teste embarcado; a função UUID é nativa nesse ambiente.

A auditoria de dependências é um retrato da data e deve ser repetida antes do deploy. Free tiers devem ser conferidos nos fornecedores; nenhum serviço pago ou deploy externo foi contratado/executado.

## Home pública

A home em `/` foi validada com os quatro serviços e preços das imagens, ambos os links de WhatsApp, localização e acesso ao cadastro do cliente. O teste confirma que a home não consulta Supabase nem dados internos, e que um visitante anônimo continua sendo redirecionado ao login ao tentar acessar `/caixa`. Foram verificadas larguras de 1440, 834, 390 e 320 pixels sem rolagem horizontal. `npm run test:portal` cobre agora o fluxo do cliente e a home pública. Lint e build passaram.
