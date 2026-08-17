# Auditoria de consistência de UI — área do proprietário

Data da auditoria: 15/08/2026  
Viewport de referência: 390 × 844 px  
Modelo: `design-system/Como Está Minha Obra - prototype (frontend)/Proprietario - Como esta minha obra.dc.html`  
Implementação: `webapp/src/app/(cliente)/c/[obraId]/` e componentes usados por essas rotas

## Resumo executivo

A implementação reaproveita corretamente a maior parte da paleta do protótipo (`#FAFAF9`, `#141414`, cinzas, divisores e laranja `#F25C1F`), o limite de 390 px e alguns raios de borda. Apesar disso, a interface renderizada não preserva a linguagem visual do modelo.

Foram identificadas **84 inconsistências**, sendo:

- **4 críticas**: tipografia global não aplicada, estrutura da página inicial alterada, marcador inferior do gauge em posição incorreta e navegação sem os ícones do design.
- **48 altas**: mudanças que descaracterizam hierarquia, composição ou componentes inteiros.
- **30 médias**: diferenças relevantes de espaçamento, dimensão, estilo e apresentação de estados.
- **2 baixas**: diferenças de microcopy ou acabamento.

As divergências de maior impacto são:

1. **As fontes do design system não aparecem na interface.** Embora `next/font` gere `--font-space-grotesk` e `--font-source-serif` no `body`, os aliases do Tailwind (`--font-sans` e `--font-serif`) são declarados no `:root`. Na renderização auditada, `body` e títulos usam a pilha de fonte do sistema. Isso elimina o contraste editorial entre Space Grotesk e Source Serif 4.
2. **“Informações da obra” saiu da página inicial.** No modelo, a seção está na home, entre Tempo e Atividades Executadas; na implementação ela virou uma rota separada, acessível por um link secundário em Atividades.
3. **As telas Galeria, Linha do tempo e Perfil perderam sua identidade própria.** O modelo usa um cabeçalho de página com eyebrow, título serifado de 32 px e subtítulo. A implementação repete o cabeçalho da home e reduz o nome da tela a um rótulo de 10 px.
4. **A barra inferior perdeu todos os ícones.** O item ativo é indicado por um ponto de 4 px, em vez do ícone de 20 px e do texto colorido previstos.
5. **O gauge foi redesenhado e contém um erro geométrico.** Ele ficou menor e muito mais espesso, alterou a hierarquia dos dois percentuais e posiciona o marcador do arco inferior no hemisfério superior.

## Método e critérios

- Comparação de estrutura, estilos inline e estados do protótipo com o JSX/Tailwind implementado.
- Renderização dos componentes reais em 390 × 844 px com dados equivalentes aos do modelo.
- Inspeção das telas Início, Galeria, Linha do tempo, Informações e Perfil, além de navegação, accordions, lightboxes e PDF overlay.
- Estados sem relatório, sem fotos ou sem clima não foram marcados como inconsistência quando o protótipo não oferece um estado equivalente.

Prioridades usadas no relatório:

- **Crítica**: quebra transversal do design system, da arquitetura visual ou da leitura correta de dados.
- **Alta**: diferença estrutural ou de hierarquia claramente perceptível.
- **Média**: diferença relevante de componente, dimensão, espaçamento ou acabamento.
- **Baixa**: microcopy ou detalhe visual de menor impacto.

## 1. Fundação visual e shell

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| F-01 | **Crítica** | As famílias tipográficas não são aplicadas | Space Grotesk em textos e Source Serif 4 em títulos/números | A renderização computada usa `-apple-system/system-ui` tanto no `body` quanto nos elementos `font-serif`. A origem está na combinação de `webapp/src/app/globals.css:17-18` com as variáveis adicionadas apenas ao `body` em `webapp/src/app/layout.tsx:42-44` |
| F-02 | Alta | Peso tipográfico base incorreto | Container inteiro com `font-weight: 300` | Peso computado do `body` é 400; vários textos ficam visualmente mais pesados |
| F-03 | Alta | Margem horizontal global reduzida | Conteúdo principal e telas secundárias usam 28 px; largura útil de 334 px | `ClienteShell` usa 16 px (`px-4`); largura útil de 358 px (`ClienteShell.tsx:25`) |
| F-04 | Média | Ritmo vertical comprimido | Seções principais usam 50–56 px de respiro | Home usa `space-y-6` (24 px) para quase todas as transições (`page.tsx:121`) |
| F-05 | Média | Fundo externo em desktop não diferencia o canvas móvel | `body` cinza `#EDEDED` e app de 390 px em `#FAFAF9` | `body` e shell usam o mesmo `#FAFAF9`; em telas largas o canvas se perde no fundo |
| F-06 | Alta | Peso dos títulos serifados divergente | Títulos principais e de seção geralmente em peso 400 | Componentes usam repetidamente `font-light` (300), mesmo quando a fonte for corrigida |
| F-07 | Alta | Telas secundárias deixaram de ser superfícies próprias | Galeria, Linha do tempo e Perfil são overlays full-screen com `padding: 34px 28px 120px` | São páginas normais dentro do mesmo shell, com `padding: 16px` e o cabeçalho da home |

### Falha tipográfica confirmada

Na inspeção renderizada:

- `--font-space-grotesk` e `--font-source-serif` existem no `body`.
- `--font-sans` e `--font-serif` não resolvem no elemento renderizado.
- O `body` e o `h1.font-serif` usam a pilha de fonte do sistema.

Isso não é apenas uma diferença de intenção no código: é a aparência efetivamente entregue ao usuário.

## 2. Cabeçalho compartilhado

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| H-01 | Alta | Cabeçalho sem gradiente quente | Gradiente do pêssego translúcido para o fundo, com blur | Fundo uniforme `bg-fundo/90`, sem a camada pêssego (`ClienteHeader.tsx:26`) |
| H-02 | Média | Padding e altura menores | 28 px no topo/laterais e 16 px embaixo | Conteúdo começa em 16 px; header adiciona apenas 8 px no topo e 12 px embaixo |
| H-03 | Alta | Saudação com estilo incorreto | 11 px, uppercase, tracking `0.22em` | 14 px, caixa normal, sem tracking (`ClienteHeader.tsx:32`) |
| H-04 | Alta | Nome da obra menor e sem composição editorial | 32 px, serif 400, line-height 1.05; quebra deliberada em duas linhas | 26 px, light, uma linha com `truncate` (`ClienteHeader.tsx:33`), podendo cortar nomes longos |
| H-05 | Alta | Avatar com tratamento oposto ao modelo | 36 px, fundo transparente, borda cinza e texto cinza | 40 px, preenchimento escuro e texto branco (`Avatar.tsx:19-20`) |
| H-06 | Alta | Cabeçalho da home repetido nas telas secundárias | Cabeçalho de saudação aparece apenas na home; outras telas têm título próprio | `ClienteHeader` é repetido em Galeria, Linha do tempo, Informações e Perfil |

## 3. Início — relatório e gauge

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| I-01 | Alta | Metadados do relatório mudaram de composição | Bloco centralizado em três linhas: relatório, atual, anterior | Layout em duas colunas, número à esquerda e datas à direita (`page.tsx:128-148`) |
| I-02 | Média | Rótulo principal divergente | “RELATÓRIO Nº 12” | “RELATÓRIO VIGENTE” + “nº 12” em outra linha |
| I-03 | Baixa | Formato das datas diverge | `ATUAL 14/07/26` e `ANTERIOR 10/07/26`, uppercase | `Atual · 14/07/2026` e `Anterior · 10/07/2026` |
| I-04 | Alta | Gauge menor | 250 × 250 px | 220 × 220 px (`GaugeDuplo.tsx:7`) |
| I-05 | Alta | Traço do gauge excessivamente espesso | Arcos de 3 px | Círculos de 10 px (`GaugeDuplo.tsx:13`) |
| I-06 | Alta | Construção visual dos arcos é diferente | Duas meias-luas finas, separadas por uma faixa central; leitura leve | Dois semicírculos grossos que formam visualmente quase um anel contínuo |
| I-07 | **Crítica** | Marcador do desembolso está no hemisfério errado | Marcador acompanha o fim do arco inferior | O cálculo usa `y = cy - r * sin(ângulo)` para os dois arcos (`GaugeDuplo.tsx:38-40`); o marcador inferior aparece acima do eixo central |
| I-08 | Média | Estilo dos marcadores invertido | Centro na cor do fundo, contorno laranja de 1,5 px | Centro laranja, contorno branco de 2 px (`GaugeDuplo.tsx:110-125`) |
| I-09 | Alta | Hierarquia entre percentuais alterada | Avanço e desembolso têm o mesmo tamanho: 52 px + `%` de 26 px | Avanço 42 px; pago 28 px (`GaugeDuplo.tsx:129-139`) |
| I-10 | Média | `%` perdeu o tom terciário | Sinal de porcentagem em `#B5B5B0` | Herda a cor preta do valor |
| I-11 | Média | Nomenclatura dos indicadores do gauge mudou | “AVANÇO FÍSICO” e “DESEMBOLSO” | “AVANÇO” e “PAGO” |

## 4. Início — indicadores, tempo e ordem das seções

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| I-12 | Alta | Indicadores viraram seis cards | Duas colunas limpas, três linhas cada, separadas apenas por divisores | Grade de seis cards com borda, gradiente, raio de 20 px e gap de 12 px (`page.tsx:155-166`) |
| I-13 | Alta | Hierarquia dos indicadores foi invertida | Valor centralizado em 24 px acima do rótulo | Rótulo em 10 px acima do valor de 18 px, alinhados à esquerda |
| I-14 | Média | Formatação financeira e de data não segue a composição | Prefixo/sufixo (`R$`, `/26`, `mil`) menores e em cinza | Valor inteiro no mesmo corpo e cor; “Saldo” aparece sem compactação |
| I-15 | **Crítica** | “Informações da obra” não está na home | Ordem visual: Header → Gauge → Tempo → Informações → Atividades → Relatório | Ordem implementada: Header → Metadados → Gauge → Indicadores → Tempo → Atividades → Relatório. Informações virou `/informacoes` |
| I-16 | Alta | Acesso a Informações foi introduzido no lugar errado | Não há link lateral em “Atividades Executadas” | Link laranja “Informações” ao lado do título (`page.tsx:204-206`) |
| T-01 | Alta | “Tempo” deixou de ser título de seção | Título serifado de 24 px | Micro-rótulo uppercase de 10 px (`page.tsx:170-172`) |
| T-02 | Média | Localização perdeu o estilo previsto | 10,5 px uppercase com tracking | 10 px, sem uppercase/tracking; o endereço completo pode ser truncado |
| T-03 | Alta | Contexto temporal ausente | “últimos 7 dias antes do relatório nº 12” | Linha removida |
| T-04 | Alta | Previsão perdeu o card único | Um card gradiente com borda, raio de 18 px e padding interno | Sete pequenos cards individuais com borda e raio de 12 px (`page.tsx:180-195`) |
| T-05 | Alta | Ícones meteorológicos não seguem o sistema visual | SVGs lineares de 17 px, com cor por condição | Emojis (`☀`, `☁`, `🌧`), dependentes da plataforma e com aparência preenchida |
| T-06 | Média | Ordem interna dos dados mudou | Ícone → probabilidade → data | Ícone → data → probabilidade |
| T-07 | Média | Legenda explicativa foi removida | “% de chance de chuva registrada no dia” | Não existe |

## 5. Atividades e cartão do relatório

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| A-01 | Alta | Título da seção perdeu hierarquia | Serif 24 px, peso 400 | Uppercase 10 px (`page.tsx:201-203`) |
| A-02 | Média | Geometria dos cards mudou | Raio 18 px; imagem com altura fixa de 94 px; conteúdo `12px 14px 14px` | Raio 16 px; imagem `aspect-ratio: 4/3`; conteúdo 10 px (`AtividadesGrade.tsx:33-44`) |
| A-03 | Alta | Nome e status foram reorganizados | Nome de 14 px com dot ao lado; status uppercase em linha separada | Nome de 12 px; dot, status e quantidade de fotos na mesma linha de 10 px |
| A-04 | Média | Badge de quantidade de fotos foi removido da imagem | Badge escuro sobre a capa, no canto inferior direito | Quantidade aparece como texto depois do status |
| A-05 | Alta | CTA do relatório não segue o modelo | Botão transparente com borda clara, 9,5 px uppercase | Botão sólido laranja, 14 px, caixa normal (`PdfOverlay.tsx`) |
| A-06 | Média | Selo “novo” tem tratamento diferente | Fundo laranja sólido e texto branco, 7,5 px uppercase | Fundo laranja translúcido e texto laranja, 11 px (`Selo`) |
| A-07 | Baixa | Linha de publicação perdeu contexto | “publicado hoje · 14 jul 2026” | Apenas a data numérica |
| A-08 | Média | Padding do cartão escuro é menor | 20 px vertical e 22 px horizontal | 16 px (`page.tsx:211`) |

## 6. Informações da obra

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| D-01 | Alta | Cabeçalho da seção foi reduzido | Título serifado de 24 px | Rótulo uppercase de 10 px na rota separada |
| D-02 | Alta | “Abrir tudo” perdeu aparência de controle | Pill com borda, raio total, 9 px uppercase e padding | Texto laranja simples em uma linha própria (`InformacoesAcordeao.tsx:110-113`) |
| D-03 | Alta | Accordion foi encapsulado em um card não previsto | Linhas abertas sobre o fundo, apenas com divisores inferiores | Container gradiente com borda, raio 20 px e padding lateral de 16 px |
| D-04 | Média | Títulos dos accordions usam tipografia incorreta | Sans 15 px, peso 400 | `font-serif`, 16 px, peso 300 (`Acordeao.tsx:72-77`) |
| D-05 | Média | Resumos usam cor indevida | Prazo em cinza; percentuais físico/financeiro em laranja; uppercase | Todos os resumos usam laranja, 12 px e caixa normal (`Acordeao.tsx:82-84`) |
| D-06 | Alta | Botão `+ / −` perdeu forma circular | Círculo de 22 px com borda | Caractere solto, sem borda ou área visual própria (`Acordeao.tsx:85-87`) |
| D-07 | Média | Espaçamento vertical das linhas é menor | 18 px vertical no item principal | 12 px (`py-3`) |
| D-08 | Média | Conteúdo interno ficou maior e mais pesado | Linhas de 12,5 px; sublinhas de 11,5 px | Linhas e conteúdo em 14 px, com menos contraste hierárquico |

## 7. Galeria

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| G-01 | Alta | Cabeçalho de página foi substituído | Eyebrow com nome da obra, `h1` “Galeria” em Source Serif 32 px e subtítulo | Cabeçalho de saudação da home + rótulo “Galeria” de 10 px (`galeria/page.tsx:46-54`) |
| G-02 | Alta | Total geral de fotos foi removido | “5 fotos da obra” abaixo do título | Não existe |
| G-03 | Alta | Cabeçalho de cada grupo perdeu a linha editorial | Data uppercase de 10,5 px, divisor horizontal e contagem de 10,5 px | Data numérica de 14 px medium e contagem de 12 px, sem divisor (`GaleriaCliente.tsx:35-42`) |
| G-04 | Alta | Legenda passou a fazer parte de um card | Foto isolada com raio de 14 px; legenda externa uppercase com tracking | Botão inteiro com borda/raio; legenda dentro de um rodapé, em caixa normal (`GaleriaCliente.tsx:46-60`) |
| G-05 | Média | Espaçamento da grade diverge | Gap de 10 px; 14 px entre cabeçalho e grade | Gap de 8 px; 8 px entre cabeçalho e grade |
| G-06 | Média | Fotos ficam maiores do que o modelo | Grade ocupa largura útil de 334 px | Grade ocupa largura útil de 358 px por causa do padding global de 16 px |

## 8. Linha do tempo

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| L-01 | Alta | Cabeçalho de página foi substituído | Eyebrow da obra, `h1` serif 32 px e subtítulo de 12 px | Cabeçalho da home + rótulo de 10 px e texto de 14 px (`linha-do-tempo/page.tsx:26-39`) |
| L-02 | Alta | Legenda de interação foi removida | Dot laranja + “dias com relatório · toque para abrir” | Não existe |
| L-03 | Alta | Cabeçalho mensal não segue o modelo | 10,5 px uppercase com tracking, divisor horizontal e contagem pequena | Título de 18 px `font-serif`, capitalizado, sem divisor (`LinhaDoTempoCalendario.tsx:73-80`) |
| L-04 | Alta | Células do calendário estão grandes demais | Dias dentro de área/círculo fixo de 36 × 36 px | `aspect-square` ocupando toda a coluna; com largura útil atual, cerca de 47 × 47 px |
| L-05 | Média | Cor dos dias passados diverge | Passados em `#141414`; futuros em cinza claro e sem fundo | Passados em `#8A8A85`; futuros ganham círculo com fundo `#F0EFEC` (`LinhaDoTempoCalendario.tsx:121-131`) |
| L-06 | Média | Intervalo de meses exibido é diferente | Modelo mostra meses do início até o relatório atual | Implementação gera todos os meses do início contratual até a entrega prevista (`LinhaDoTempoCalendario.tsx:46-51`), incluindo um longo trecho futuro |
| L-07 | Média | Ritmo vertical do calendário mudou | 38 px antes de cada mês; row-gap de 6 px | `space-y-8` (32 px) e gap de 4 px em todas as direções |

## 9. Perfil

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| P-01 | Alta | Cabeçalho próprio do Perfil foi removido | Eyebrow “MINHA CONTA” + `h1` “Perfil” em serif 32 px | Cabeçalho de saudação + rótulo “SEU PERFIL” de 10 px (`perfil/page.tsx:91-101`) |
| P-02 | Alta | Bloco de identidade não existe | Avatar de 64 px, nome serifado de 21 px e papel “PROPRIETÁRIO” | Não existe; sobra apenas o avatar escuro de 40 px no cabeçalho global |
| P-03 | Alta | Dados pessoais mudaram de estrutura | Cinco linhas sem card, com divisores: nome, e-mail, telefone, CPF e cliente desde | Duas linhas dentro de card arredondado: nome e e-mail (`perfil/page.tsx:98-106`) |
| P-04 | Alta | Cabeçalho “Minhas obras” perdeu hierarquia e contagem | Serif 24 px + “2 obras” à direita | Rótulo uppercase 10 px sem contagem (`perfil/page.tsx:108-111`) |
| P-05 | Alta | Estrutura dos cards de obra foi simplificada | Dot de status, nome serif 18, status uppercase, localização, barra + percentual, período uppercase e seta | Nome 16, status em pill, barra e período/percentual em uma linha; sem dot, localização ou seta (`perfil/page.tsx:118-132`) |
| P-06 | Média | Destaque da obra atual é excessivo | Borda laranja muito suave (`#F1C9B5`) | Borda laranja + `ring-1`, visualmente equivalente a contorno duplo forte |
| P-07 | Alta | Lista de ações do perfil foi removida | Notificações, Ajuda e suporte e Sair da conta como linhas com divisores | Apenas um grande botão sólido “Sair” (`perfil/page.tsx:140-143`) |

## 10. Lightboxes e visualizador de PDF

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| O-01 | Alta | Largura máxima dos overlays não preserva o formato móvel | Conteúdo limitado a 390 px | `Lightbox` usa `max-w-3xl` (768 px), alterando muito a composição em desktop (`Lightbox.tsx:35-37`) |
| O-02 | Média | Fundo perdeu blur | Overlay escuro com `backdrop-filter: blur(4px)` | Apenas fundo escuro translúcido, sem blur |
| O-03 | Média | Botão fechar não tem dimensão fixa | Círculo de 34 × 34 px | Pill definido por `px-3 py-1`, sem largura/altura fixa (`Lightbox.tsx:45-50`) |
| O-04 | Alta | Contexto da galeria/atividade foi reduzido | Título + legenda uppercase com quantidade/data | Apenas título; na galeria a data aparece abaixo da imagem em corpo de 14 px |
| O-05 | Alta | Descrição do engenheiro perdeu o card translúcido | Card com padding, borda, fundo sutil e metadados | Texto diretamente sobre o fundo do lightbox (`AtividadesGrade.tsx:70-79`) |
| O-06 | Média | Imagens não seguem a moldura prevista | Proporção 4:3, `background-size: cover`, raio 14 px | `<img>` com proporção natural e raio de 8 px |
| O-07 | Alta | PDF não ocupa a altura restante do overlay | Overlay em coluna; iframe flexível até o rodapé, raio 14 px | Iframe fixo em 70 vh dentro do lightbox genérico, raio 8 px |

## 11. Navegação inferior

| ID | Prioridade | Inconsistência | Modelo | Implementação |
|---|---|---|---|---|
| N-01 | **Crítica** | Todos os ícones foram removidos | Home, calendário, galeria e usuário em SVG linear de 20 px | Não há ícones (`ClienteShell.tsx:35-49`) |
| N-02 | Alta | Estado ativo usa indicador diferente | Ícone e texto mudam para laranja | Ponto de 4 × 4 px acima do texto; o item perde reconhecimento visual |
| N-03 | Média | Tipografia dos rótulos diverge | 8,5 px, uppercase, tracking `0.12em` | 10 px, caixa normal, sem tracking |
| N-04 | Alta | Barra está baixa e com alvos visuais menores | Padding `12px 22px 20px`; ícone + texto e gap de 5 px | Padding de 8 px; ponto + texto; não reserva os 20 px inferiores previstos |
| N-05 | Média | Opacidade do fundo difere | `rgba(..., 0.9)` | `bg-fundo/85` |

## O que está consistente

- Largura máxima principal de 390 px.
- Fundo interno `#FAFAF9`.
- Cor de texto principal `#141414`.
- Tons secundários `#8A8A85` e `#B5B5B0`.
- Divisores `#ECECE9`, bordas `#E4E4E0` e cor de marca `#F25C1F`.
- Gradientes dos cards claros e do cartão escuro existem como tokens reutilizáveis.
- Grades de duas colunas para atividades e galeria.
- Uso de barra de 2 px para progresso de etapas/obras.
- Estrutura funcional de accordions, lightboxes e abertura de PDFs está presente.

## Plano recomendado de correção

### Prioridade 1 — restaurar a fundação

1. Corrigir o escopo das variáveis de fonte e validar por `getComputedStyle` que `font-sans` resolve para Space Grotesk e `font-serif` para Source Serif 4.
2. Ajustar peso base para 300 e títulos para os pesos/tamanhos do protótipo.
3. Restaurar padding horizontal de 28 px e o ritmo vertical de 50–56 px.
4. Recriar a barra inferior com os quatro SVGs, tipografia uppercase e padding inferior de 20 px/safe area.

### Prioridade 2 — corrigir arquitetura e componentes principais

1. Recolocar Informações da obra na home, antes de Atividades Executadas.
2. Restaurar os cabeçalhos próprios de Galeria, Linha do tempo e Perfil.
3. Refazer o gauge em 250 px, traço de 3 px, dois arcos independentes e marcador inferior geometricamente correto.
4. Trocar a grade de cards de indicadores pela matriz tipográfica com divisores.
5. Restaurar o card único de clima com SVGs do design system.

### Prioridade 3 — fidelidade das telas e overlays

1. Alinhar cards de atividade, cartão do relatório e accordion às medidas do modelo.
2. Restaurar cabeçalhos de grupos, legendas e apresentação das fotos na Galeria.
3. Ajustar calendário para células de 36 px, cabeçalhos mensais com divisor e intervalo de meses do modelo.
4. Restaurar identidade, linhas de dados, cards de obras e lista de ações do Perfil.
5. Criar variantes de lightbox/PDF limitadas a 390 px, com blur, legendas e molduras previstas.

## Critério de aceite visual sugerido

- Comparação lado a lado em 390 × 844 px para os quatro tabs.
- Fontes computadas exatamente como Space Grotesk e Source Serif 4.
- Diferença máxima de 2 px em espaçamentos e dimensões principais.
- Mesma ordem de seções e mesma hierarquia de títulos do protótipo.
- Ícones, marcadores, badges, divisores e estados ativos visualmente equivalentes.
- Validação adicional em desktop para confirmar canvas móvel centralizado sobre fundo cinza e overlays limitados a 390 px.
