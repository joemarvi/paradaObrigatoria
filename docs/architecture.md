# Arquitetura

SPA Angular standalone e zoneless, TypeScript estrito, rotas lazy e estado com Signals. Supabase é a única integração de dados. HttpClient é provido para extensões; o SDK Supabase usa o transporte próprio para autenticação e PostgREST. O SDK é carregado dinamicamente quando o projeto está configurado, preservando o carregamento inicial da demonstração.

`Auth` centraliza sessão, perfil ativo e recuperação. As guardas aguardam a sessão inicial e verificam o perfil. Permissões da UI não substituem RLS. O serviço de dados limpa o estado ao encerrar uma sessão. Dados pessoais de demonstração são fictícios; dados de produção não são persistidos em localStorage pela aplicação. O token de sessão persistente é administrado pelo Supabase SDK.

`Store` carrega lotes limitados em paralelo, serializa mutações e apresenta loading, falhas e avisos de paginação. Recarrega apenas as tabelas afetadas após gravar. Cadastros fazem busca e paginação diretamente no servidor. CRUDs simples usam RLS. Operações financeiras e de OS são RPCs transacionais. Relatórios retornam agregados com janela de no máximo 367 dias.

`domain.ts` contém cálculo em centavos, validação de documentos, regras de transição, pagamento, CSV e conversão de fuso. Datas do negócio usam America/Sao_Paulo e formulários tratam horário local como UTC−03:00. Se houver mudança legislativa do fuso, revisar essa conversão.

Um lava-jato, perfis provisionados por convite e caixa único. Sem dependência paga, SSR, gateway, fotos ou armazenamento de arquivos. Não foi criado bucket Storage, pois não há fluxo que demande uploads nesta versão.

## UX e acessibilidade

Tema por CSS variables, ícones SVG locais, navegação desktop/mobile, tabelas com rolagem interna, modais com Escape e contenção/restauração do foco, formulários etiquetados, validação em pt-BR, estados vazios, mensagens amigáveis e anúncios de feedback. Confirmação para desativar, cancelar e fechar caixa. Não há dados artificiais de receita apresentados como reais.

## Próximas evoluções

Seletores remotos para cadastros grandes; histórico por consulta dedicada; geração de tipos pelo Supabase CLI; Realtime com eventos restritos; edição controlada de itens antes do pagamento; estornos transacionais; conversão agenda→OS; teste de concorrência em PostgreSQL hospedado; PWA com shell estático e política explícita de dados. Antes de multitenancy, acrescentar isolamento obrigatório por empresa em todas as tabelas e RPCs.
