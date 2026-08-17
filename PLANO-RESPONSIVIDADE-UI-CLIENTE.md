# Plano de execução controlada — responsividade da UI do cliente

**Versão:** 2.0  
**Data:** 16/08/2026  
**Executor:** Cursor ou outro agente de código  
**Escopo exclusivo:** área do proprietário em `webapp/src/app/(cliente)/c/[obraId]/`  
**Baseline visual obrigatório:** implementação mobile atual em `390 × 844px`

> Este documento é um contrato de execução, não uma referência criativa. O executor deve implementar somente o que está explicitamente determinado aqui. Ausência de instrução significa proibição de decidir por conta própria.

---

## 0. Instrução principal para o Cursor

Ao receber este documento, o Cursor deve:

1. ler o documento inteiro antes de editar qualquer arquivo;
2. executar apenas a fase que o usuário autorizar;
3. editar somente os arquivos permitidos para essa fase;
4. preservar integralmente o comportamento mobile atual;
5. não aproveitar a tarefa para corrigir, refatorar ou melhorar qualquer outra parte do projeto;
6. interromper a execução diante de ambiguidade, arquivo inesperado, teste quebrado ou necessidade de sair do escopo;
7. apresentar o resultado da fase e aguardar aprovação antes de iniciar a próxima.

**Proibido executar duas fases no mesmo ciclo sem autorização explícita do usuário.**

---

## 1. Resultado autorizado

Criar comportamento responsivo para as quatro telas da área do cliente:

- Início;
- Linha do tempo;
- Galeria;
- Perfil.

O resultado deve:

- manter o mobile atual como fonte de verdade;
- introduzir uma faixa tablet sem alterar a arquitetura de navegação;
- substituir a barra inferior por um rail lateral no desktop;
- reorganizar os mesmos elementos existentes em grids maiores;
- ampliar lightboxes e PDFs apenas quando a viewport comportar;
- preservar textos, dados, regras, componentes visuais e interações existentes.

Não existe autorização para criar funcionalidades, conteúdo ou telas.

---

## 2. Hierarquia das fontes de verdade

Quando houver conflito, usar esta ordem:

1. **este documento**, apenas para responsividade da área do cliente;
2. **código mobile atual** em `webapp/src/app/(cliente)/c/[obraId]/` e componentes usados por ele;
3. `RELATORIO_UI_PROPRIETARIO.md`, para identidade e fidelidade mobile;
4. `Context/explicacao-do-prototype.md` e o protótipo em `design-system/`, somente para conferir a identidade existente;
5. `BRIEFING.md`, para regras do produto e de negócio.

O executor não deve reinterpretar o protótipo, restaurar versões antigas, nem refazer o trabalho mobile durante esta tarefa.

---

## 3. Regra contra alucinação

### 3.1 O que conta como alucinação

É alucinação qualquer alteração não descrita neste documento, incluindo:

- inventar componente, seção, texto, ícone, métrica, estado ou funcionalidade;
- escolher medida diferente da especificada porque “parece melhor”;
- assumir comportamento de uma tela sem abrir seu código;
- alterar dados, carregamento, autenticação, banco ou regras de negócio para facilitar o layout;
- instalar biblioteca para resolver algo que CSS já resolve;
- criar uma versão desktop separada da árvore mobile;
- corrigir um problema não relacionado encontrado durante a execução;
- aplicar padrões de dashboard, cards ou navegação não existentes no plano;
- usar conteúdo fictício ou placeholder no código final.

### 3.2 Protocolo obrigatório de dúvida

Se faltar qualquer decisão necessária, o Cursor deve parar e responder exatamente nesta estrutura:

```text
DÚVIDA BLOQUEANTE
Fase: <número e nome>
Arquivo: <caminho>
Fato observado: <o que existe no código>
Instrução ausente ou conflitante: <o que o plano não resolve>
Impacto de prosseguir sem resposta: <risco concreto>
```

Não implementar uma “solução provisória”. Não criar `TODO`. Não escolher silenciosamente uma alternativa.

---

## 4. Proteção do estado atual do repositório

O repositório pode conter alterações não commitadas do usuário. Elas não pertencem ao Cursor.

Antes de qualquer edição, executar apenas comandos de leitura:

```bash
git status --short
git diff --stat
```

Regras:

- não descartar, restaurar, sobrescrever ou formatar alterações preexistentes;
- não usar `git reset`, `git checkout --`, `git restore`, `git clean`, stash ou rebase;
- não fazer commit, push, merge ou criação de branch sem pedido explícito;
- se uma alteração preexistente impedir uma edição segura, parar pelo protocolo de dúvida;
- depois de cada fase, conferir que os arquivos modificados pelo Cursor pertencem à allowlist da fase.

---

## 5. Escopo fechado de arquivos

### 5.1 Allowlist completa

Somente estes arquivos podem ser alterados ao longo de todas as fases:

1. `webapp/src/components/shells/ClienteShell.tsx`
2. `webapp/src/components/cliente/ClienteHeader.tsx`
3. `webapp/src/components/cliente/ClientePageHeader.tsx`
4. `webapp/src/app/(cliente)/c/[obraId]/page.tsx`
5. `webapp/src/app/(cliente)/c/[obraId]/galeria/page.tsx`
6. `webapp/src/components/cliente/GaleriaCliente.tsx`
7. `webapp/src/app/(cliente)/c/[obraId]/linha-do-tempo/page.tsx`
8. `webapp/src/components/cliente/LinhaDoTempoCalendario.tsx`
9. `webapp/src/app/(cliente)/c/[obraId]/perfil/page.tsx`
10. `webapp/src/components/cliente/AtividadesGrade.tsx`
11. `webapp/src/components/cliente/PdfOverlay.tsx`
12. `webapp/src/components/ui/Lightbox.tsx`
13. `PLANO-RESPONSIVIDADE-UI-CLIENTE.md`, somente pelo autor do plano; o Cursor não pode editá-lo.

Nenhum arquivo novo está autorizado.

### 5.2 Arquivos e áreas explicitamente protegidos

É proibido alterar:

- `webapp/src/app/globals.css`;
- `webapp/src/app/layout.tsx`;
- `webapp/src/app/(cliente)/c/[obraId]/layout.tsx`;
- `webapp/src/app/(cliente)/c/[obraId]/informacoes/page.tsx`;
- `webapp/src/components/cliente/GaugeDuplo.tsx`;
- `webapp/src/components/cliente/InformacoesAcordeao.tsx`;
- `webapp/src/components/ui/Acordeao.tsx`;
- `webapp/src/components/ui/Avatar.tsx`;
- qualquer rota de empreiteiro, marketing, autenticação, admin ou API;
- `webapp/src/lib/**`;
- `webapp/supabase/**`;
- `webapp/package.json` e `webapp/package-lock.json`;
- configurações de Next, TypeScript, ESLint, Vitest, Playwright ou Vercel;
- `BRIEFING.md`, `PROGRESS.md`, `RELATORIO_UI_PROPRIETARIO.md`, `Context/**` e `design-system/**`.

Se a implementação parecer exigir um arquivo protegido, parar. Não ampliar a allowlist por conta própria.

---

## 6. Invariantes funcionais

As seguintes partes não podem mudar:

- rotas e URLs;
- autenticação, redirects e controle de acesso;
- chamadas a `carregarDadosCliente` e Supabase;
- formato e transformação dos dados;
- ordem, presença e texto das seções;
- microcopy, labels, títulos e mensagens vazias;
- links e destinos dos quatro itens de navegação;
- cálculo, geometria, labels e dimensões mobile do gauge;
- funcionamento dos accordions;
- abertura de atividades, galeria e PDF;
- IDs, `aria-label`, `aria-current`, roles e comportamento de teclado existentes;
- regras de clima, datas, percentuais, valores e relatórios;
- Server Components e Client Components atuais. Não adicionar `"use client"` a páginas server;
- comportamento visual abaixo de `768px`.

Não mover lógica entre arquivos. Não renomear props, tipos, funções ou variáveis sem necessidade direta da regra responsiva especificada.

---

## 7. Invariantes visuais

Preservar sem alteração:

- fundo interno `#FAFAF9` e fundo externo `#EDEDED` já existentes;
- texto `#141414`;
- cinzas `#8A8A85` e `#B5B5B0`;
- bordas `#E4E4E0` e divisores `#ECECE9`;
- laranja `#F25C1F` como único destaque;
- Source Serif 4 e Space Grotesk;
- raios, bordas, gradientes e espessuras já definidos nos componentes;
- ícones atuais da navegação;
- gauge de `250px`;
- células do calendário de `36 × 36px`;
- imagem dos cards de atividade com `94px` de altura;
- avatar da home com `36px`;
- avatar do perfil com `64px`;
- botão fechar do lightbox com `34 × 34px`;
- navegação mobile e safe area inferior.

Proibido:

- criar novos cards;
- adicionar sombras;
- adicionar gradientes;
- adicionar cores;
- trocar ícones;
- criar pills decorativas;
- adicionar logo ou wordmark;
- adicionar animações, zoom de imagem, parallax ou biblioteca de motion;
- alterar a copy;
- transformar a interface em um dashboard de métricas;
- aumentar componentes proporcionalmente ao monitor.

As únicas transições novas permitidas são de `color` e `border-color`, com `150ms`, em links e botões que já existem.

---

## 8. Breakpoints fechados

Usar apenas os breakpoints padrão do Tailwind já disponível:

| Faixa | Breakpoint | Shell | Navegação | Composição |
|---|---|---|---|---|
| `0–767px` | base | `max-w-[390px]` | inferior fixa | mobile atual, sem mudanças |
| `768–1023px` | `md` | `max-w-[760px]` | inferior fixa | conteúdo ampliado e grids secundários |
| `1024–1279px` | `lg` | `max-w-[1280px]` | rail esquerdo de `216px` | desktop compacto |
| `≥1280px` | `xl` | `max-w-[1280px]` | rail esquerdo de `216px` | desktop completo em duas áreas |

Constantes obrigatórias:

- gutter mobile: `28px` (`px-7`);
- gutter tablet: `32px` (`md:px-8`);
- gutter desktop: `40px` (`lg:px-10`);
- gap estrutural desktop: `32px` (`gap-8`);
- largura do rail: `216px`;
- largura máxima do shell: `1280px`;
- não criar breakpoint customizado;
- não adicionar media query em CSS global.

Em monitores maiores que `1280px`, centralizar o shell. Não aumentar a largura máxima.

---

## 9. Especificação fechada por área

### 9.1 Shell e navegação

#### Base e tablet

- manter o mesmo markup e os mesmos quatro links;
- manter a barra fixa no rodapé;
- base: barra e shell com `max-w-[390px]`;
- `md`: barra e shell com `max-w-[760px]`;
- manter grid de quatro colunas;
- manter ícone sobre label;
- manter padding inferior com `env(safe-area-inset-bottom)`;
- manter `pb-[92px]` no conteúdo.

#### Desktop a partir de `lg`

- o shell vira grid com colunas `216px minmax(0, 1fr)`;
- a mesma navegação deixa de ser fixa no rodapé e passa a ocupar a primeira coluna;
- o rail usa `position: sticky`, `top: 0` e `height: 100dvh`;
- o rail mantém somente os quatro links existentes;
- os links ficam empilhados e alinhados à esquerda;
- cada link mantém o ícone de `20px` e o label atual;
- o ativo continua sendo indicado apenas por ícone e texto laranja;
- adicionar somente uma borda direita `border-divisor` ao rail;
- remover o padding inferior de `92px` do conteúdo em `lg`;
- não adicionar cabeçalho, marca, avatar, rodapé, botão ou texto ao rail;
- não duplicar a navegação em dois blocos focáveis. O mesmo `<nav>` deve mudar de layout por CSS.

### 9.2 Cabeçalho da home

- manter o comportamento sticky atual em todas as faixas;
- base: preservar todas as classes computadas atuais;
- `md`: padding horizontal `32px`;
- `lg`: padding horizontal `40px`;
- título continua com `32px` até `lg`;
- em `xl`, título passa exatamente para `40px`;
- manter saudação, gradiente, blur, avatar e borda de scroll;
- não truncar nem inserir quebra manual no nome da obra;
- permitir a quebra natural do nome da obra, sem `truncate`, `line-clamp` ou altura fixa.

### 9.3 Cabeçalhos de Galeria, Linha do tempo e Perfil

- manter eyebrow, título e subtítulo existentes;
- base: `32px` no título;
- `xl`: `40px` no título;
- limitar o bloco textual a `680px`;
- não adicionar ações, ícones, breadcrumbs ou avatar;
- aplicar gutters definidos na seção 8 por meio do container da página.

### 9.4 Home

A ordem no DOM permanece:

1. status do relatório, gauge e indicadores;
2. Tempo;
3. Informações da obra;
4. Atividades Executadas e relatório em PDF.

#### Base

Não alterar layout, espaçamento ou tamanho.

#### `md` e `lg`

- usar gutters de `32px` e `40px`, respectivamente;
- manter as quatro seções em sequência vertical;
- dentro da primeira seção, posicionar gauge e matriz de indicadores lado a lado;
- usar colunas `250px minmax(0, 1fr)` e gap de `32px`;
- os metadados do relatório permanecem acima das duas colunas;
- Tempo, Informações e Atividades permanecem abaixo e nessa ordem;
- Atividades usa três colunas em `md` e `lg` enquanto estiver em largura total;
- o card escuro do relatório permanece abaixo da grade.

#### `xl`

Usar grid de 12 colunas com gap horizontal de `32px`:

```text
colunas 1–7  / linha 1: status, gauge e indicadores
colunas 8–12 / linha 1: Tempo
colunas 1–7  / linha 2: Informações da obra
colunas 8–12 / linha 2: Atividades + relatório PDF
```

Regras:

- as áreas da linha 1 começam no mesmo eixo vertical;
- as áreas da linha 2 começam `56px` abaixo da linha 1;
- status mantém gauge e indicadores lado a lado, com gauge de `250px`;
- Tempo mantém um único card de sete dias;
- Informações não ganha card, borda externa ou fundo novo;
- Atividades volta a duas colunas na área lateral;
- card escuro permanece abaixo da grade com `26px` de margem superior;
- nenhuma área se torna sticky.

### 9.5 Galeria

- base: duas colunas;
- `md`: três colunas;
- `lg` e `xl`: quatro colunas;
- gap continua `10px` (`gap-2.5`);
- fotos continuam quadradas e com raio de `14px`;
- legendas permanecem fora das fotos;
- cabeçalhos de data, divisor e contagem permanecem inalterados;
- página usa gutters da seção 8;
- não adicionar paginação, filtro, ordenação ou CTA;
- não alterar o agrupamento nem a ordenação dos dados;
- não adicionar efeito de zoom ou transformação no hover.

### 9.6 Linha do tempo

- base: meses em uma coluna;
- `md`, `lg` e `xl`: meses em duas colunas;
- gap entre colunas: `32px`;
- gap vertical continua `38px`;
- células permanecem `36 × 36px` em todas as faixas;
- manter grid interno de sete dias;
- manter ordem cronológica, labels e contagens;
- não mostrar três meses por linha;
- não alterar o intervalo de datas;
- não alterar clique, PDF ou estado de relatório.

### 9.7 Perfil

- base e `md`: preservar sequência vertical atual;
- `lg` e `xl`: usar duas colunas;
- coluna esquerda: `320px`;
- coluna direita: `minmax(0, 1fr)`;
- gap: `32px`;
- esquerda contém, nesta ordem: identidade, dados pessoais e ações;
- direita contém somente “Minhas obras” e a lista;
- em `lg`, cards de obra permanecem em uma coluna;
- em `xl`, cards de obra usam duas colunas;
- gap dos cards permanece `14px`;
- manter conteúdo e geometria interna dos cards;
- não mover “Sair da conta” para o rail;
- não alterar queries Supabase nem cálculo de avanço.

### 9.8 Atividades

- cards mantêm altura de imagem, raio, badge, dot, nome e status;
- base: duas colunas;
- `md` e `lg`, quando a grade ocupa a largura total da home: três colunas;
- `xl`, quando a grade ocupa a área lateral: duas colunas;
- não alterar dados, nota, autor, fotos ou click handler.

### 9.9 Lightboxes e PDF

É permitida uma única alteração de API em `Lightbox`: adicionar uma prop opcional chamada `variante` com os valores exatos:

```ts
type LightboxVariante = "compacto" | "midia" | "atividade" | "pdf";
```

Regras:

- default: `"compacto"`;
- `compacto`: comportamento e largura atual de `390px` em todas as faixas;
- `midia`: `390px` na base e `760px` a partir de `md`;
- `atividade`: `390px` na base e `840px` a partir de `lg`;
- `pdf`: `390px` na base, `max-w-[calc(100vw-40px)]` em `md`, e `max-w-[1000px]` a partir de `lg`;
- `pdf` usa altura `calc(100dvh - 64px)` a partir de `md`;
- Galeria usa `variante="midia"`;
- Atividades usa `variante="atividade"`;
- `PdfOverlay` e o PDF da Linha do tempo usam `variante="pdf"`;
- o showcase em `webapp/src/app/dev/ui/DevUiShowcase.tsx` não pode ser alterado e deve continuar usando o default;
- backdrop, blur, título, botão fechar e clique externo permanecem iguais;
- manter fechamento por `Escape`;
- não instalar biblioteca de diálogo;
- não implementar carousel, setas, thumbnails ou download novo.

No conteúdo da atividade:

- base e `md`: descrição acima das fotos;
- `lg`: descrição em coluna de `280px` e fotos em `minmax(0, 1fr)`;
- gap de `24px`;
- não alterar a composição interna do card de descrição nem das imagens.

---

## 10. Plano em fases com allowlist por fase

Depois de cada fase com edição, executar em `webapp/`:

```bash
npm run typecheck
npm run lint
npm run test
```

Também executar `git diff --name-only` e conferir o resultado contra a allowlist da fase. Arquivos que já estavam modificados antes da fase podem continuar listados, mas o Cursor não pode ter alterado seu conteúdo se estiverem fora da allowlist.

### Fase 0 — auditoria somente leitura e baseline

**Arquivos permitidos para edição:** nenhum.

Executar:

1. `git status --short`;
2. `git diff --stat`;
3. ler os 12 arquivos de código da allowlist;
4. iniciar a aplicação sem editar configuração;
5. registrar na resposta as evidências visuais das quatro telas em `390 × 844px`, sem salvar screenshots dentro do repositório;
6. registrar na resposta Galeria, Atividade e PDF abertos, sem criar arquivos;
7. conferir que os dados necessários já existem no ambiente.

Se não for possível acessar a área autenticada, parar. Proibido criar bypass de autenticação, seed novo ou mock.

**Gate:** nenhuma edição realizada; baseline mobile disponível para comparação.

### Fase 1 — shell e navegação

**Arquivos permitidos:**

- `webapp/src/components/shells/ClienteShell.tsx`

Implementar somente a seção 9.1.

**Gate visual:**

- `390px`: barra inferior idêntica ao baseline;
- `768px`: barra inferior ocupa o shell de `760px`;
- `1024px`: rail de `216px`, sem barra inferior;
- os quatro links navegam para os mesmos destinos;
- nenhum conteúdo fica coberto.

Parar e aguardar aprovação.

### Fase 2 — cabeçalhos e home

**Arquivos permitidos:**

- `webapp/src/components/cliente/ClienteHeader.tsx`;
- `webapp/src/app/(cliente)/c/[obraId]/page.tsx`;
- `webapp/src/components/cliente/AtividadesGrade.tsx`.

Implementar somente as seções 9.2, 9.4 e 9.8, exceto alterações de overlay da atividade, que ficam para a Fase 5.

**Gate visual:**

- mobile comparado ao baseline sem regressão;
- `768px` e `1024px`: status interno em duas colunas e demais seções verticais;
- `1280px`: grid 7/5 completo;
- gauge continua com `250px`;
- acordeão totalmente aberto não gera sobreposição;
- nenhum dado ou texto mudou.

Parar e aguardar aprovação.

### Fase 3 — Galeria e Linha do tempo

**Arquivos permitidos:**

- `webapp/src/components/cliente/ClientePageHeader.tsx`;
- `webapp/src/app/(cliente)/c/[obraId]/galeria/page.tsx`;
- `webapp/src/components/cliente/GaleriaCliente.tsx`;
- `webapp/src/app/(cliente)/c/[obraId]/linha-do-tempo/page.tsx`;
- `webapp/src/components/cliente/LinhaDoTempoCalendario.tsx`.

Implementar somente as seções 9.3, 9.5 e 9.6. Não alterar ainda as props de Lightbox.

**Gate visual:**

- Galeria: 2/3/4 colunas nos breakpoints definidos;
- Linha do tempo: 1/2/2 colunas;
- células continuam com `36px`;
- datas, fotos, grupos e relatórios permanecem na mesma ordem;
- mobile sem regressão.

Parar e aguardar aprovação.

### Fase 4 — Perfil

**Arquivos permitidos:**

- `webapp/src/app/(cliente)/c/[obraId]/perfil/page.tsx`.

Implementar somente a seção 9.7.

**Gate visual e funcional:**

- mobile e tablet mantêm a sequência atual;
- desktop separa esquerda e direita conforme especificado;
- `lg`: uma coluna de obras;
- `xl`: duas colunas de obras;
- troca de obra e logout continuam funcionando;
- nenhuma query ou função de cálculo foi alterada.

Parar e aguardar aprovação.

### Fase 5 — overlays

**Arquivos permitidos:**

- `webapp/src/components/ui/Lightbox.tsx`;
- `webapp/src/components/cliente/GaleriaCliente.tsx`;
- `webapp/src/components/cliente/AtividadesGrade.tsx`;
- `webapp/src/components/cliente/PdfOverlay.tsx`;
- `webapp/src/components/cliente/LinhaDoTempoCalendario.tsx`.

Implementar somente a seção 9.9.

**Gate funcional:**

- default do Lightbox continua compatível com o showcase não alterado;
- `Esc`, backdrop e botão fecham todos os overlays;
- Galeria chega a `760px`;
- Atividade chega a `840px` e usa duas colunas somente em `lg`;
- PDF chega a `1000px` e usa a altura definida;
- mobile continua com largura máxima de `390px`;
- nenhum novo controle foi criado.

Parar e aguardar aprovação.

### Fase 6 — validação final

**Arquivos permitidos para edição:** nenhum. Se um erro for encontrado, reabrir somente a fase responsável e pedir autorização antes de editar.

Executar em `webapp/`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Depois, validar manualmente:

| Viewport | Verificação obrigatória |
|---|---|
| `320 × 568` | sem overflow; navegação utilizável |
| `390 × 844` | paridade com baseline mobile |
| `768 × 1024` | tablet e barra inferior de `760px` |
| `1024 × 768` | rail, desktop compacto e pouca altura |
| `1280 × 800` | desktop completo 7/5 |
| `1440 × 900` | shell centralizado em `1280px` |
| `1920 × 1080` | nenhum componente esticado além do shell |

Em cada viewport, conferir:

- quatro destinos da navegação;
- estado ativo;
- home com accordion fechado e totalmente aberto;
- Galeria vazia e preenchida;
- Linha do tempo com múltiplos meses;
- Perfil com uma e várias obras;
- foto, atividade e PDF abertos;
- nomes, endereços e valores longos;
- ausência de scroll horizontal;
- navegação por teclado;
- zoom do navegador em `200%`.

---

## 11. Política de falha

Se qualquer comando de validação falhar:

1. registrar o comando exato;
2. registrar a primeira mensagem de erro relevante;
3. identificar se o erro foi introduzido na fase atual;
4. se foi introduzido na fase, corrigir apenas dentro da allowlist da mesma fase;
5. se o erro for preexistente, ambiental ou exigir arquivo protegido, parar e reportar;
6. nunca desabilitar regra de lint, teste ou TypeScript;
7. nunca usar `any`, `@ts-ignore`, `eslint-disable`, teste pulado ou catch vazio para obter verde;
8. nunca alterar configuração, dependência ou script para contornar a falha.

Uma fase só está concluída quando seus gates passam. “Quase pronto” não é conclusão.

---

## 12. Checklist anti-fuga antes de cada resposta do Cursor

O Cursor deve responder internamente a todas as perguntas:

- [ ] Executei somente uma fase autorizada?
- [ ] Editei apenas arquivos da allowlist dessa fase?
- [ ] Mantive todos os arquivos protegidos intactos?
- [ ] Não alterei textos, dados, regras ou rotas?
- [ ] Não instalei dependência?
- [ ] Não criei arquivo ou componente?
- [ ] Não refatorei código fora da necessidade responsiva?
- [ ] Não adicionei card, cor, ícone, sombra, gradiente ou animação?
- [ ] Preservei o comportamento abaixo de `768px`?
- [ ] Comparei `390 × 844px` com o baseline?
- [ ] Rodei os gates da fase?
- [ ] Parei diante de qualquer decisão ausente?

Se alguma resposta for “não”, a fase não pode ser apresentada como concluída.

---

## 13. Formato obrigatório de entrega de cada fase

```text
FASE CONCLUÍDA: <número e nome>

Arquivos alterados:
- <caminho>

Alterações realizadas:
- <lista objetiva ligada aos itens do plano>

Validações executadas:
- <comando ou verificação>: <resultado>

Comparação mobile 390 × 844:
- <resultado>

Desvios do plano:
- nenhum

Próxima ação:
- aguardando autorização para a Fase <número>
```

Se existir qualquer desvio, substituir “nenhum” pela descrição e **não** declarar a fase concluída.

---

## 14. Critérios finais de aceite

1. Nenhum arquivo fora da allowlist foi alterado pelo Cursor.
2. Nenhum arquivo novo ou dependência foi criado.
3. A UI abaixo de `768px` permanece equivalente ao baseline.
4. Tablet mantém navegação inferior e ganha somente a expansão especificada.
5. Desktop usa rail de `216px` com os mesmos quatro destinos.
6. A home usa grid completo somente em `xl`.
7. Gauge permanece com `250px`.
8. Galeria usa exatamente 2, 3 e 4 colunas conforme o breakpoint.
9. Linha do tempo usa uma coluna na base e duas a partir de `md`.
10. Perfil usa duas áreas a partir de `lg` e duas colunas de obras somente em `xl`.
11. Lightboxes respeitam as quatro variantes e mantêm o default compatível.
12. Nenhum texto, dado, regra, rota ou função de produto mudou.
13. Não há scroll horizontal entre `320px` e `1920px`.
14. Typecheck, lint, testes e build passam sem supressões.
15. O relatório final declara zero desvios do plano.

---

## 15. Fora de escopo

Tudo que não estiver descrito nas seções 8, 9 e 10 está fora de escopo. Em especial:

- tela de Informações isolada;
- telas do empreiteiro;
- marketing, login, admin e blog;
- banco, APIs, Supabase, PDF gerado e regras de negócio;
- conteúdo novo;
- correções mobile não relacionadas;
- refatoração de design system;
- novos componentes compartilhados;
- testes novos que exijam mock, seed ou alteração de configuração;
- responsividade de qualquer tela fora das quatro rotas listadas;
- alteração de acessibilidade que exija redesenho de componente compartilhado;
- dark mode;
- novos breakpoints;
- novas animações;
- mudança de marca.

---

## 16. Definição de sucesso

O trabalho está concluído somente quando a área do cliente deixa de parecer um celular centralizado no desktop, preserva integralmente a experiência mobile e utiliza o espaço adicional por meio das composições exatas deste documento. Nenhuma criatividade autônoma, correção paralela ou expansão de escopo faz parte do sucesso.
