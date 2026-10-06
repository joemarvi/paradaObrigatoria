# Identidade visual — Parada Obrigatória

Referência: emblema enviado pelo proprietário, com água e bolhas azuis/ciano, carro e espuma brancos, faixa vermelha, nome amarelo e telefone (61) 99137-9913.

| Token                 | Cor     | Aplicação                                 |
| --------------------- | ------- | ----------------------------------------- |
| primary               | #0066AD | Navegação, ícones, links e gráficos       |
| primary-dark          | #00487F | Texto de marca e variações escuras        |
| secondary             | #052D53 | Fundo do login e card financeiro          |
| brand-aqua            | #38CBED | Foco e detalhes da água                   |
| brand-red             | #D91524 | Botões principais e destaque da navegação |
| brand-yellow / accent | #FFF075 | Destaques sobre azul escuro               |
| background            | #F3F7FB | Fundo geral                               |
| surface               | #FFFFFF | Cards, tabelas e formulários              |
| text                  | #102D46 | Texto principal                           |
| muted                 | #63788D | Texto secundário                          |

As cores da marca são aproximações visuais da referência, centralizadas em `src/styles.scss`. Amarelo e ciano são usados como acentos, sem texto de baixa legibilidade em superfícies brancas. Sucesso, erro e aviso mantêm sua função semântica.

`public/brand-logo.png` é uma versão derivada da imagem anexada, preparada com o recurso integrado image_gen para remover o fundo externo. A ferramenta reconstrói pixels; não é uma cópia pixel a pixel do arquivo original. O símbolo em `public/brand.svg` é uma adaptação simplificada do carro, água e faixa, para favicon em tamanhos pequenos. A versão PNG é usada no login (incluindo celular) e na navegação lateral; o tema do navegador e manifesto usam o azul da marca.

## Prompt usado

> Use case: background-extraction. Edit target: the user-attached round LAVA JATO PARADA OBRIGATÓRIA logo. Asset type: exact existing business logo for a web application, NOT a redesign. Remove ONLY the grey rectangular area outside the circular blue emblem. Preserve the original circular aqua water and bubble border, blue watery background, white car and foam, sweeping red oval, typography, colors and composition unchanged as faithfully as possible. Preserve exact words LAVA JATO, PARADA OBRIGATÓRIA, and exact telephone (61) 99137-9913. Center the complete circular logo on a transparent square canvas, with minimal transparent padding, no clipping, no added elements, no new lettering. High fidelity to the supplied image.

Foi usado o modo integrado, com a imagem anexada como referência e fundo transparente; nenhuma API paga adicional foi configurada no projeto.

## Tipografia

IBM Plex Sans é a fonte principal do site público, formulários e painel administrativo, com fallback sans-serif e pesos de 400 a 700. Os arquivos WOFF2 para Latin e Latin Extended ficam em `public/fonts`, com licença OFL preservada; são servidos localmente com `font-display: swap`. Fonte: [Google Fonts — IBM Plex Sans](https://github.com/google/fonts/tree/main/ofl/ibmplexsans). O peso 400 é usado em texto, 500 em rótulos, 600 em subtítulos/botões e 700 em títulos/destaques. Elementos como placas mantêm a fonte monoespaçada para facilitar a leitura.
