# Como Está Minha Obra — Especificação para implementação front-end

Protótipo com dois aplicativos que compartilham o mesmo design system: **Empreiteiro** (lado do construtor, responsivo desktop + mobile) e **Proprietário** (lado do cliente, mobile-first, somente leitura). O elo entre os dois é o **relatório**: o empreiteiro cria e envia relatórios; tudo que o proprietário vê é derivado deles.

---

## 1. Design system (comum às duas páginas)

**Tipografia**
- Textos, rótulos e UI: Space Grotesk, peso 300 (base), 400 para ênfase.
- Títulos, números grandes e valores: Source Serif 4, pesos 300–400; itálico usado apenas em destaques promocionais.
- Rótulos de seção/coluna: caixa alta, letter-spacing largo (0.10–0.22em), tamanhos 8.5–11px, cor cinza.

**Cores**
- Fundo geral: greige claro `#FAFAF9`; cartões em gradiente sutil branco → `#F6F4F1`.
- Tinta principal: quase-preto `#141414`; cinzas de apoio `#8A8A85` (secundário) e `#B5B5B0` (terciário); bordas `#E4E4E0` / divisores `#ECECE9`.
- Âmbar/laranja da marca: `#F25C1F` (hover `#D94F16`), tom claro `#FFB38A` para acentos sobre fundo escuro.
- Cartão de destaque escuro: gradiente `#1A1A1A → #2E2B28 → #4A3327`.
- Semântica de status: concluído = preto/verde discreto, em andamento = âmbar, não iniciado = cinza.

**Componentes recorrentes**
- Botões em pill (border-radius total): primário âmbar com texto branco, secundário contornado, terciário escuro `#141414`.
- Cartões com raio 18–22px, borda de 1px, sem sombras fortes.
- Barras de progresso finas (2–3px): âmbar em andamento, preta quando 100%.
- Toast escuro flutuante no rodapé (centro), auto-dismiss ~2.8s, confirma cada ação (rascunho salvo, link copiado, plano ativado, relatório enviado etc.).
- Ícones em stroke fino (1.3–1.5), sem preenchimento.

---

## 2. Página do Empreiteiro

### 2.1 Estrutura e navegação
- **Desktop (≥800px)**: barra lateral fixa estreita e transparente à esquerda — logotipo (triângulo branco sobre quadrado âmbar) no topo; três botões-ícone (Minhas obras, Nova obra, Planos); o item ativo ganha pill quase-preto com ícone branco. No rodapé, avatar circular com iniciais do engenheiro, que leva ao cadastro/conta.
- **Mobile (<800px)**: os mesmos quatro destinos viram tab bar fixa inferior com blur; item ativo em âmbar. O breakpoint é detectado ao redimensionar.
- O conteúdo tem largura máxima de ~1240px, com padding extra à esquerda no desktop para compensar a sidebar.

### 2.2 Cadastro
- Tela dividida em duas colunas (empilha no mobile): formulário à esquerda (nome, e-mail profissional, senha) com botão âmbar "Criar conta" e link "Entrar"; painel promocional à direita em gradiente escuro com o slogan "Da fundação à entrega, tudo registrado" (trecho em itálico âmbar-claro).
- Criar conta redireciona ao dashboard e dispara toast de boas-vindas.

### 2.3 Planos
- Três cartões: Básico (grátis, 1 obra), Profissional (R$ 79/mês, cartão escuro com selo "Recomendado") e Empresa (R$ 199/mês).
- Clicar num cartão o seleciona (borda âmbar + marcador "✓ selecionado"); o botão "Assinar {plano}" reflete a seleção e confirma via toast.

### 2.4 Dashboard — Minhas obras
- Topo: busca em pill branco (filtra por nome da obra ou cliente, em tempo real, case-insensitive) e botão escuro "+ Nova obra".
- Título com contagem de obras (respeitando o filtro; singular/plural).
- Grade de cartões de obra: foto de capa, selo de status calculado (Em obra / Concluída / A iniciar — derivado do avanço geral: 100% = concluída, 0% = a iniciar, senão em obra), nome, cliente, barra de progresso com % geral, "X de Y etapas" concluídas e contagem de relatórios.
- **Avanço geral da obra = média aritmética dos percentuais das etapas.** Nunca é digitado; é sempre derivado.
- Clicar num cartão abre o detalhe da obra.

### 2.5 Nova obra (ficha da obra)
Formulário em quatro seções numeradas — esta ficha define a estrutura que os relatórios preencherão depois:
1. **Informações da obra**: nome, endereço, cliente (proprietário), construtora, engenheiro responsável, escritório de arquitetura, arquiteto responsável, projetista de estruturas, projetista de instalações, e slot para foto principal.
2. **Prazos**: início contratual e término previsto contratual. Dias aditivados e nova data de término NÃO entram aqui — são registrados pelos relatórios.
3. **Financeiro**: apenas o valor contratado. Medições, materiais e aditivos entram pelos relatórios.
4. **Etapas**: lista pré-preenchida com as 23 etapas padrão de construção (Montagem do canteiro, Demolições, Terraplanagem, Fundações, Estrutura, Alvenarias, Cobertura, Instalações elétricas e rede, Instalações hidrossanitárias, Ar condicionado, Rebocos e contrapisos, Impermeabilizações, Revestimentos de piso/parede/teto, Fachadas, Esquadrias janelas/portas, Acabamentos de granito, Acabamentos elétricos e luminárias, Louças e metais, Pintura, Limpeza final). Cada etapa é numerada e removível ("×"); campo com Enter ou botão "+" adiciona etapas próprias. Cada etapa vira uma linha de avanço físico nos relatórios e uma pasta na galeria.

"Criar página de acompanhamento" cria a obra com todas as etapas a 0%, abre seu detalhe e confirma por toast.

### 2.6 Detalhe da obra
- Cabeçalho: nome, endereço, cliente, entrega prevista; botões "Ver página do cliente", "Compartilhar" e "Novo relatório" (âmbar, primário).
- **Cartão escuro de resumo**: anel circular com o % de avanço geral, barra linear, e três números — etapas concluídas ("7 de 23"), total pago (formato compacto "R$ 473 mil" + % do contrato) e entrega prevista.
- **Coluna Avanço físico**: lista de todas as etapas com dot de status, percentual e mini-barra. Reflete sempre o **último relatório enviado** (rascunhos não alteram esses números).
- **Coluna Relatórios**: feed do mais recente ao mais antigo. Cada cartão traz número, data, transição do avanço geral ("26% → 46% +20%"), total financeiro, chips com as etapas trabalhadas e miniaturas das fotos (até 5).

### 2.7 Novo relatório (modal, mesma estrutura da ficha)
Numeração automática: relatório nº = último nº + 1. Data automática. Quatro seções:

1. **Avanço físico** — um slider (0–100%) por etapa. **Regra crítica: o slider nunca pode voltar atrás do percentual do último relatório enviado** (mínimo = valor anterior). Etapas alteradas destacam nome e % em âmbar. O topo mostra ao vivo "geral: X% → Y%" (média recalculada).
2. **Financeiro** — três grupos de lançamentos, cada um com total ao vivo e histórico de linhas:
   - *Pago em medições*: **sem campo de texto**. O rótulo é automático ("Medição 05"), calculado como o maior número de medição existente + lançamentos novos + 1. O usuário digita apenas o valor.
   - *Pago em materiais*: rótulo livre + valor.
   - *Aditivos ao contrato*: chip com numeração automática ("Aditivo 04") + campo de descrição ("Do que se refere?"). Ao adicionar, o lançamento é gravado como "Aditivo 04 — {descrição}". Aditivos somam ao valor contratado total (afetam o denominador do % pago).
   - O resumo do bloco mostra "pago: R$ X · Y% do contrato", recalculado a cada lançamento.
3. **Atividades executadas na semana** — lista de todas as etapas com checkbox circular. Marcar uma etapa expande campo "O que foi feito nesta etapa?" e grade de fotos com botão de anexar. Essas notas e fotos alimentam a galeria da etapa na página do cliente.
4. **Clima da semana** — informativo, preenchido automaticamente por servidor meteorológico público a partir do endereço da obra (sem input do usuário).

### 2.8 Fluxo de rascunho → envio (importante)
O relatório **não é enviado direto**. O botão do formulário é "**Salvar rascunho do relatório nº X**":
- Salvar rascunho grava o relatório com selo "Rascunho" no topo do feed, **sem aplicar nada à obra** (avanço, financeiro e página do cliente permanecem intactos) e sem notificar o cliente.
- O cartão de rascunho oferece três ações: **Visualizar como cliente** (pré-visualização somente leitura), **Editar** (reabre o formulário preenchido com os dados salvos; salvar de novo substitui o mesmo rascunho, mantendo o número) e **Enviar ao cliente** (âmbar).
- Só o "Enviar ao cliente" aplica os percentuais às etapas, incorpora os lançamentos financeiros à obra, marca o relatório como enviado ("enviado por e-mail ao cliente" com check) e dispara a notificação por e-mail.
- Relatórios enviados mostram o rodapé de confirmação + botão "Ver relatório do cliente".

### 2.9 Compartilhamento com o proprietário
Modal "Compartilhar obra": o acesso do proprietário é por **e-mail + login** (não mais link público com senha) — o empreiteiro adiciona o e-mail do proprietário, libera um link de visualização e o proprietário faz login para acessar. A página do cliente é sempre somente leitura.

---

## 3. Página do Proprietário

App mobile (largura de referência 390px), somente leitura — o proprietário nunca edita nada; todo conteúdo vem dos relatórios enviados pelo empreiteiro.

### 3.1 Navegação
Tab bar fixa inferior com blur e 4 abas: **Início**, **Linha do tempo**, **Galeria**, **Perfil**. Aba ativa em âmbar. As telas secundárias abrem como camadas em tela cheia sobre o início.

### 3.2 Início
- **Header sticky** com saudação ("Olá, Francisco"), nome da obra em serifa grande e avatar com iniciais. Ganha borda inferior ao rolar (transição suave).
- **Bloco do relatório vigente**: número do relatório atual e datas do atual e do anterior.
- **Gauge duplo circular**: arco superior (esq→dir) = avanço físico (34%), arco inferior (dir→esq) = desembolso financeiro (31%), ambos com gradiente âmbar e marcador circular na ponta. Números grandes em serifa dentro do círculo.
- **Grade de indicadores** (2 colunas × 3 linhas): entrega da obra, dias de obra, dias restantes | total do contrato, desembolsado, saldo a pagar. Todos derivados da ficha + relatórios.
- **Tempo**: régua dos últimos 7 dias antes do relatório vigente — ícone (sol/nuvem/chuva), % de chance de chuva e data por dia; localidade da obra no cabeçalho da seção. Mesma fonte automática de clima do lado do empreiteiro (justifica dias aditivados por chuva).
- **Atividades executadas**: grade 2 colunas de cartões por etapa trabalhada no relatório — foto de capa, contagem de fotos, dot de status e rótulo (Em andamento/Concluída). Tocar abre um **lightbox** escuro em tela cheia com título da etapa, a "Descrição do engenheiro" (a nota escrita na seção 3 do relatório, com autor e data) e as fotos empilhadas. Fecha ao tocar fora ou no "×".
- **Cartão escuro do relatório**: "Relatório nº 12" com badge "novo" (quando publicado recentemente) e botão "Abrir em PDF" — abre visualizador de PDF em overlay (iframe) com título, data e botão de fechar.

### 3.3 Informações da obra (acordeão)
Quatro seções expansíveis com botão "Abrir tudo / Fechar tudo":
1. **Dados do projeto** — obra, endereço, construtora, engenheiro; subgrupos expansíveis "Arquitetos" e "Projetistas" (segundo nível de acordeão).
2. **Prazos** — início e término contratuais; subgrupo "Dias aditivados" com motivos (chuvas, aditivos de escopo); data prevista de término recalculada; dias corridos e restantes. Resumo à direita do cabeçalho ("184 dias restantes").
3. **Avanço físico** — as 23 etapas com % e mini-barra cada (âmbar parcial, preta 100%). Resumo: "34%" em âmbar.
4. **Avanço financeiro** — contratado, subgrupo de aditivos (com % sobre o total), contratado total, subgrupos "Pago em medições" e "Pago em materiais" (linhas individuais dos lançamentos), pago total e saldo a pagar, com linhas de destaque em tinta escura. Resumo: "R$ 323 mil · 31%".

Cada linha/subgrupo espelha exatamente os lançamentos feitos pelo empreiteiro nos relatórios.

### 3.4 Galeria
Todas as fotos da obra, agrupadas por data de relatório (cabeçalho com data + contagem), grade 2 colunas, cada foto etiquetada com a etapa. Tocar abre o lightbox individual com legenda "publicada em {data}".

### 3.5 Linha do tempo
Calendário mensal (D–S) cobrindo o período da obra: dias com relatório aparecem como círculos âmbar clicáveis (abrem o PDF do relatório correspondente); dias futuros em cinza claro. Cabeçalho de cada mês traz contagem de relatórios. Total de relatórios no subtítulo.

### 3.6 Perfil
Dados do proprietário (nome, e-mail, telefone, CPF mascarado, cliente desde), lista "Minhas obras" (cartões com status, barra de progresso, período; a obra ativa tem borda âmbar; tocar volta ao início da obra) e ações de conta (notificações, ajuda, sair — "Sair" em âmbar).

---

## 4. Regras de negócio consolidadas

1. Avanço geral = média dos percentuais das etapas; nunca é editado diretamente.
2. Percentual de etapa é monotônico: nenhum relatório pode reduzir o valor do relatório anterior.
3. Medições são numeradas automaticamente e sequenciais; aditivos recebem prefixo automático "Aditivo NN — descrição"; materiais têm rótulo livre.
4. Aditivos aumentam o contratado total; % pago = pago (medições + materiais) ÷ contratado total.
5. Relatório nasce como rascunho; só o envio explícito altera a obra e notifica o cliente por e-mail.
6. Número do relatório é sequencial e preservado ao editar um rascunho.
7. O lado do proprietário é 100% derivado e somente leitura; acesso via e-mail cadastrado + login.
8. Clima é obtido automaticamente por localização da obra (usado no início do proprietário e na seção 4 do relatório).
9. Toda ação relevante confirma com toast escuro discreto.
