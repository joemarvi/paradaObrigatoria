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

## Limites desta validação

Não havia projeto Supabase, variáveis públicas configuradas, imagem de marca ou remote Git. Portanto, **não foram homologados** login e persistência de sessão no serviço real, envio de e-mail de recuperação, PostgREST hospedado, concorrência entre conexões reais, deploy e identidade da imagem de referência.

PGlite executa PostgreSQL e RLS, mas não simula o serviço completo de Supabase Auth. Os testes de navegador usam exclusivamente a demonstração. A extensão pgcrypto não é instalada no teste embarcado; a função UUID é nativa nesse ambiente.

A auditoria de dependências é um retrato da data e deve ser repetida antes do deploy. Free tiers devem ser conferidos nos fornecedores; nenhum serviço pago ou deploy externo foi contratado/executado.
