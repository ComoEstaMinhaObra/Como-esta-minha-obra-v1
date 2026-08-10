# Relatório de Análise Técnica — "Como Está Minha Obra"

**Escopo da análise:** todo o repositório local · **Data:** 10/08/2026 · **Papel:** Tech Lead
**Legenda:** texto sem marcação = fato do briefing (com a fonte entre parênteses) · **⚠️ Achado** = inconsistência ou lacuna que encontrei · **💡 Sugestão** = recomendação minha, não está no briefing · **❓** = decisão em aberto que precisa de resposta sua/do Geraldino.

---

## 1. Sumário executivo

O repositório é a base de pré-desenvolvimento de um SaaS de acompanhamento de obras com dois lados: o **Empreiteiro** (cria obras e publica relatórios semanais) e o **Proprietário** (acompanha tudo em modo somente leitura — 100% derivado dos relatórios). Ainda **não existe código de produção**; existem o contrato assinado, a proposta de valor, a especificação funcional e dois protótipos navegáveis de alta fidelidade com o design system e as regras de negócio críticas já codificadas.

A qualidade do material de briefing está acima da média — o protótipo já resolve as regras difíceis (monotonicidade do avanço, fluxo rascunho→envio, numeração automática de medições/aditivos). Os problemas que encontrei são de outra natureza:

1. **Divergências entre documentos** — preços, autenticação e cálculo do avanço (pesos) mudaram no Readme/escopo e o protótipo ficou para trás (seção 5).
2. **Escopo contratado sem especificação** — dashboard admin, landing page, blog CMS+SEO, LGPD e e-mails de autenticação estão no contrato, mas não têm protótipo nem spec (seção 4).
3. **Riscos operacionais** — credenciais em texto plano no Readme, prazo de 40 dias (a assinatura foi há 44 dias), e a recorrência por cartão no AbacatePay ainda não validada (seções 5.3, 8 e 9).

💡 **Recomendação central:** antes de escrever código, fechar as decisões da seção 10 com o Geraldino (meio dia de conversa), fazer um spike de 1 dia no AbacatePay e sanear as credenciais. Depois seguir o plano de execução da seção 9.

---

## 2. Inventário do repositório

| Caminho | O que é | Avaliação |
|---|---|---|
| `Readme.md` | Fonte da verdade mais recente (editado hoje, 10/08): stack, precificação, auth, credenciais | ⚠️ contém credenciais (ver 5.3) |
| `Context/Proposta Comercial....pdf` | Contrato assinado em 27/06/2026 via gov.br — opção 2: R$ 5.950 + 20% de participação societária, prazo 40 dias | Base do escopo (seção 4) |
| `Context/Site - ...Linha de criação.xlsx` | 2 abas: "Proposta de valor" (posicionamento, missão, diferenciais) e "Relatório Cliente" (modelo de referência do relatório com dados de exemplo: ficha, prazos, financeiro, 23 etapas, atividades, clima, galeria) | Modelo de dados de referência |
| `Context/Explicacao-do-escopo-da-obra.md` | Regra: etapas padrão vêm da planilha, com **pesos editáveis** por etapa | Muda o cálculo do avanço (ver 5.1-C) |
| `Context/explicacao-do-prototype.md` | Especificação funcional detalhada dos dois apps + design system + 9 regras de negócio consolidadas | Excelente qualidade |
| `Context/design references/` | 1 referência visual (dashboard greige/âmbar estilo Dribbble) | Origem clara da estética do protótipo |
| `design-system/.../ Empreiteiro....dc.html` (985 linhas) e `Proprietario....dc.html` (660 linhas) + `support.js` | Protótipos navegáveis em formato "DC" (templates `sc-if`/`sc-for` + classe `DCLogic` sobre React via runtime gerado) | Regras de negócio já codificadas; **não** é código portável direto (ver seção 6) |
| `.claude/launch.json` | Server estático do design-system na porta 4173 | ⚠️ contém entrada "lifeplanner" de outro projeto (resíduo) |
| — | **Não é repositório git** | ⚠️ ver 5.3 |
| — | Duplicações: o zip do protótipo está em `Context/` **e** em `design-system/`; a **proposta assinada (com CPF do Geraldino)** também está duplicada em `design-system/.../uploads/` | ⚠️ higiene + dado pessoal (ver 5.3) |

---

## 3. O produto — briefing consolidado

**Proposta de valor** (Planilha · aba "Proposta de valor"): substituir o caos de WhatsApp por um ambiente único onde o construtor publica relatórios semanais e o cliente acompanha com transparência. Público: pequenos construtores, engenheiros, arquitetos, empreiteiros; do outro lado, proprietários e investidores. Domínio: `www.comoestaminhaobra.com.br`.

**Fluxo central** (Spec do protótipo): o empreiteiro cria a obra (ficha em 4 seções: informações, prazos, financeiro, etapas) → publica relatórios semanais (4 seções: avanço físico por sliders, financeiro em 3 grupos, atividades da semana com fotos, clima automático) → o relatório nasce **rascunho** e só o envio explícito aplica os efeitos e notifica o cliente → a página do proprietário (mobile-first, somente leitura) deriva tudo disso: gauge físico×financeiro, indicadores, clima 7 dias, galeria por etapa, linha do tempo em calendário, acordeões de informações.

**Regras de negócio** (fontes: Spec §4, Escopo.md, Readme):

1. Avanço geral da obra é sempre **derivado** das etapas, nunca digitado (Spec §4.1).
2. Percentual de etapa é **monotônico** — nenhum relatório pode reduzir o valor do anterior enviado (Spec §4.2).
3. Medições numeradas automaticamente ("Medição 05", só valor); aditivos com prefixo automático ("Aditivo 04 — descrição"); materiais com rótulo livre (Spec §4.3).
4. Aditivos somam ao contratado total; % pago = pago ÷ contratado total (Spec §4.4).
5. Rascunho não altera nada; só o envio aplica avanço + financeiro e dispara e-mail (Spec §4.5).
6. Número do relatório é sequencial e preservado ao editar rascunho (Spec §4.6).
7. Lado do proprietário 100% derivado e read-only; acesso por e-mail cadastrado + login (Spec §4.7).
8. Clima obtido automaticamente pela localização da obra (Spec §4.8).
9. Toda ação confirma com toast escuro (Spec §4.9).
10. Etapas padrão vêm da planilha (23 etapas), com CRUD e **peso editável por etapa na porcentagem total** (Escopo.md).
11. Preços **dinâmicos via variáveis de ambiente** em todos os pontos: billing, landing, componentes React (Readme).
12. Cada obra inclui **1 e-mail de proprietário**; e-mails adicionais custam R$ 29,90/mês cada, por obra (Readme).

**Stack definida** (Readme): React, TypeScript, Next.js, Tailwind CSS, Supabase, AbacatePay (somente cartão). Autenticação: magic link primeiro; depois e-mail+senha, Google e Microsoft. Projeto Next em subpasta deste repositório. Logo: qualquer ícone placeholder por enquanto.

**Precificação** (Readme — prevalece sobre o protótipo por ser mais recente):

| Plano | Preço |
|---|---|
| 1 obra | R$ 129,90/mês |
| 3 obras | R$ 319,90/mês |
| 5 obras | R$ 599,90/mês |
| E-mail adicional por obra | + R$ 29,90/mês |

---

## 4. Escopo contratado × cobertura atual

O contrato (Proposta, p.1) inclui itens que o protótipo não cobre. Mapa de cobertura:

| Item contratado | Coberto hoje? | Observação |
|---|---|---|
| Interface do empreiteiro | ✅ Protótipo completo | Portar para Next |
| Interface do cliente | ✅ Protótipo completo | Portar para Next |
| Integração de pagamentos | ⚠️ Parcial | Tela de planos existe, mas com preços/modelo antigos; sem checkout nem recorrência |
| Base de dados | ❌ | 💡 modelo proposto na seção 7 |
| Dashboard de administrador | ❌ Sem spec | 💡 escopo mínimo proposto na seção 7 |
| Página de vendas / website | ❌ Sem spec | O design system dá a base visual |
| Blog com CMS e SEO | ❌ Sem spec | 💡 MDX na v1 (seção 7) |
| Política de privacidade (LGPD) | ❌ | Seção 8 |
| E-mails de autenticação personalizados | ❌ | 💡 Resend + SMTP custom no Supabase (seção 7) |
| Vídeos de instrução do aplicativo | ❌ | Entregável não-código; gravar no fim (fase S5) |
| Domínio e e-mail profissional | ❌ | 💡 registrar cedo — DKIM/reputação de e-mail leva dias para "esquentar" |
| 1 ano de garantia | — | 💡 definir por escrito o que a garantia cobre (bugs sim, features novas não) |
| Consultoria 1 mês (chegar a 10 pagantes) | — | Pós-launch |
| Até 50 mil usuários | — | Dimensionamento na seção 7 |

---

## 5. Inconsistências e lacunas encontradas

### 5.1 Conflitos entre documentos

**A. ⚠️ Precificação divergente.** O protótipo e a spec (§2.3) mostram planos por *recursos* (Básico grátis / Profissional R$ 79 / Empresa R$ 199); o Readme define planos por *quantidade de obras* (129,90 / 319,90 / 599,90 + e-mail extra). O Readme prevalece (mais recente) → a tela de Planos precisa ser **redesenhada**, não só ter os números trocados: a lógica vira limite de obras ativas + add-on de e-mails.
❓ Existe plano grátis ou trial? O protótipo tinha "Básico grátis"; o Readme não menciona. 💡 Sugestão: trial de 14 dias sem cartão (reduz fricção e o AbacatePay só entra quando há conversão).

**B. ⚠️ Anomalia no preço por obra.** 3 obras = R$ 106,63/obra; 5 obras = **R$ 119,98/obra** — o plano maior é pior por unidade, o que inverte o incentivo de upgrade. 💡 Sugestão: rever o plano de 5 obras (ex.: R$ 499,90 → R$ 99,98/obra, desconto progressivo consistente). Pode ser intencional, mas parece erro de digitação.

**C. ⚠️ Média simples × média ponderada.** A spec (§4.1) e o código do protótipo calculam avanço geral como **média aritmética** das etapas; o `Explicacao-do-escopo-da-obra.md` exige **peso editável por etapa** na porcentagem total. A planilha não traz valores de peso. O escopo.md prevalece → avanço geral = Σ(peso × pct) ÷ Σ(pesos). 💡 Sugestão: pesos default iguais (comportamento idêntico ao protótipo até alguém editar), campo de peso na seção 4 da ficha da obra, e recálculo ao editar peso **não** pode violar a monotonicidade dos relatórios já enviados — o histórico guarda o % geral da época (snapshot, seção 7).

**D. ⚠️ Autenticação divergente.** O cadastro do protótipo pede senha; o Readme define **magic link primeiro** (senha/Google/Microsoft depois). → Tela de cadastro/login da v1 sem campo de senha. Textos residuais do modelo antigo no protótipo: "página que o cliente abre **com senha**" (painel promocional) e "Compartilhamento com senha" (card do plano Profissional) — a própria spec §2.9 já corrigiu para e-mail + login; atualizar as copies no port.

**E. ⚠️ Marca.** O protótipo usa "Demobra" e `demobra.app`; o produto é "Como está minha obra" / `comoestaminhaobra.com.br` (Planilha). Trocar em todas as telas no port.

**F. ⚠️ Lista canônica de etapas.** São **23 etapas** (Planilha B30–B52 = JS do protótipo, idênticas). O texto da spec §2.5 diz "23" mas enumera 20 (agrupou revestimentos e esquadrias) — usar a lista da planilha/JS. Typo na planilha: "Limpez final de obra" → "Limpeza final de obra" (o protótipo já corrige).

### 5.2 Lacunas funcionais (buracos na spec que vão travar o dev se não decidir antes)

**G. ⚠️ Dias aditivados não têm porta de entrada.** A ficha diz "dias aditivados e nova data de término são registrados **pelos relatórios**" (Spec §2.5) e o lado do proprietário os exibe com motivos e data recalculada (§3.3) — mas o formulário de relatório (§2.7) **não tem campo para isso** (só avanço, financeiro, atividades, clima). 💡 Sugestão: adicionar ao relatório um grupo "Prazo" (motivo + dias aditivados), com numeração livre de motivo; o proprietário passa a mostrar exatamente o que foi lançado, relatório a relatório.

**H. ⚠️ "Sinal contratual" não cabe no fluxo de medições.** A planilha e o estado do protótipo têm "Sinal contratual — R$ 100.000" como primeira linha de medições, mas o fluxo só gera rótulos automáticos "Medição NN" sem texto livre. 💡 Sugestão: campo opcional "Sinal (R$)" na seção Financeiro da **ficha da obra** — vira o primeiro lançamento pago com rótulo próprio e mantém a numeração de medições limpa.

**I. ⚠️ Vídeos prometidos, mas sem captura.** A proposta de valor (Planilha) promete "Vídeos" e o início do proprietário mostra "1 vídeo" nos cards — o formulário de relatório só anexa **fotos**. ❓ Vídeo entra na v1? 💡 Sugestão: v1 só fotos (com compressão client-side); vídeo na fase 2 — storage/transcodificação/streaming têm custo e complexidade desproporcionais para 40 dias.

**J. ⚠️ Não existe correção pós-envio.** Relatório enviado é imutável (correto para confiança), mas errar um valor de medição acontece na vida real e hoje não há caminho. ❓ Como corrigir? 💡 Sugestão v1: lançamento de estorno/ajuste no relatório seguinte (fica transparente no histórico); fase 2: fluxo formal de retificação com trilha de auditoria visível ao proprietário.

**K. ❓ Limite de fotos por relatório/etapa?** Sem limite definido em nenhum documento. Impacta custo de storage e UX. 💡 Sugestão: 12 fotos por etapa/relatório, compressão para ~1600px/WebP no upload.

### 5.3 Riscos operacionais e higiene

**L. ⚠️ Credenciais em texto plano no Readme.** API key do AbacatePay (`abc_dev_...`) e chaves do Supabase estão no `Readme.md`. A publishable key do Supabase pode ser pública **desde que a RLS esteja correta**, mas a key do AbacatePay não deve ir para nenhum commit. O repo ainda não é git — é a hora perfeita de corrigir. 💡 Ação imediata: mover tudo para `.env.local` (com `.env.example` sem valores), **rotacionar** a key do AbacatePay e remover as credenciais do Readme antes do primeiro commit.

**M. ⚠️ Prazo.** A proposta fixa 40 dias e foi assinada em 27/06/2026 — hoje já se passaram 44 dias corridos. Se o marco zero é a assinatura, o prazo já estourou antes do primeiro commit. 💡 Ação: alinhar por escrito com o Geraldino o marco de início do desenvolvimento e o cronograma da seção 9.

**N. ⚠️ Nome da pasta raiz contém "?"** (`Como está minha obra?`). "?" é curinga de shell e separador de query em URLs — quebra scripts, CI e algumas ferramentas de forma intermitente. 💡 Sugestão: renomear a pasta para `como-esta-minha-obra` **ou** fazer do subdiretório do app Next (ex.: `webapp/`) a raiz do repositório git.

**O. ⚠️ Higiene de arquivos.** Zip do protótipo duplicado (em `Context/` e `design-system/`); a **proposta assinada com CPF** duplicada dentro de `design-system/.../uploads/` (pasta de mock do protótipo — não deveria carregar documento real); `.DS_Store` espalhados; `launch.json` com entrada de outro projeto ("lifeplanner"). 💡 Limpar antes do `git init` + `.gitignore` cobrindo `.env*`, `.DS_Store`, `node_modules`.

**P. ⚠️ AbacatePay "somente cartão" não validado.** O AbacatePay é historicamente forte em Pix; assinatura recorrente por cartão + webhooks de ciclo de vida (criada, paga, falha, cancelada) precisam ser confirmados na prática, inclusive o caso "adicionar e-mail extra no meio do ciclo" (cobrança pró-rata? add-on? nova assinatura?). 💡 Ação: spike de 1 dia com a key de dev **antes** de desenhar o schema de billing. É o maior risco técnico do projeto.

---

## 6. Avaliação do protótipo / design system

**Pontos fortes**

- Design system consistente e bem documentado (Spec §1): tipografia Space Grotesk 300/400 + Source Serif 4, paleta greige `#FAFAF9` / tinta `#141414` / âmbar `#F25C1F`, pills, cartões 18–22px, barras finas, toasts.
- As regras críticas **já estão codificadas e testáveis** no protótipo: monotonicidade (`Math.max(pct_anterior, novo)`), média derivada, numeração `pad2` de medições/aditivos, rascunho que não aplica nada, envio que aplica tudo atomicamente. Isso vira referência de comportamento para os testes do produto real.
- Copy em pt-BR madura e coerente com o posicionamento.

**Limitações para produção (nada disso é defeito — é protótipo)**

- Formato `.dc.html` proprietário (templates `sc-if`/`sc-for` + `DCLogic` sobre React via CDN): **não é código reaproveitável** — é spec executável. O port para Next/Tailwind é reescrita, não copy-paste.
- Sem estados de loading/erro/vazio, sem acessibilidade formal (aria/foco/contraste auditado), inputs de data e moeda como texto livre, imagens e clima mockados, PDF de exemplo estático.
- Breakpoint por JS (`window.innerWidth < 800`); 💡 no port, resolver responsividade com CSS/Tailwind e usar JS só onde a estrutura muda de verdade.

💡 **Sugestões de port**

- Tratar o protótipo como contrato visual: extrair os tokens para o tema do Tailwind (`cores`, raios, letter-spacings, tamanhos tipográficos) logo na fase S0 e manter paridade de tela a tela.
- Fontes via `next/font` (self-host) em vez de Google Fonts CDN — melhor performance e evita transferência de IP para terceiros (LGPD).
- Máscaras/inputs próprios para moeda (centavos como inteiro no banco) e data (date picker), que o protótipo deixou como texto.

---

## 7. 💡 Arquitetura proposta (esta seção inteira é sugestão minha)

### Aplicação

Monolito **Next.js (App Router) + TypeScript estrito + Tailwind** em `webapp/`, com route groups:

```
webapp/src/app/
  (marketing)/   → landing/vendas, preços, blog, política de privacidade, termos
  (auth)/        → login magic link, callback, convite do proprietário
  (app)/         → empreiteiro: obras, nova obra, detalhe, relatórios, planos/billing, conta
  (cliente)/     → proprietário: início, informações, galeria, linha do tempo, perfil
  (admin)/       → dashboard administrador
  api/           → webhooks (AbacatePay), geração de PDF, cron de clima
```

### Supabase

- **Auth**: magic link (depois senha/Google/Microsoft — o Supabase cobre os quatro sem mudar arquitetura). SMTP custom apontando para o Resend = "e-mails de autenticação personalizados" do contrato.
- **Postgres com RLS** (multi-tenant): empreiteiro enxerga só as próprias obras; proprietário só as obras onde seu e-mail/user_id tem acesso.
- **Storage privado** (fotos e PDFs) com URLs assinadas — fotos de obra são dado privado do cliente.

### Modelo de dados (núcleo)

| Tabela | Campos-chave | Observações |
|---|---|---|
| `profiles` | user_id, nome, tipo implícito por uso | espelho de `auth.users` |
| `assinaturas` | user_id, plano, status, abacatepay_id, limite_obras, emails_extras | alimentada por webhook |
| `obras` | owner_id, nome, endereço, lat/lng, cliente_nome, construtora, engenheiro, arquitetura, arquiteto, proj_estruturas, proj_instalacoes, foto_capa, inicio_contratual, termino_contratual, valor_contratado_centavos, sinal_centavos | lat/lng geocodificados 1× na criação |
| `etapas` | obra_id, nome, ordem, **peso**, pct_atual | pct_atual = denormalizado do último enviado |
| `obra_acessos` | obra_id, email, user_id (nullable), status convite/ativo, cobrado_extra | vincula user_id no 1º login |
| `relatorios` | obra_id, **numero** (unique por obra), status rascunho/enviado, criado_em, enviado_em, **snapshot jsonb**, pdf_path, geral_antes, geral_depois | snapshot = relatório congelado |
| `relatorio_etapas` | relatorio_id, etapa_id, pct | os sliders |
| `lancamentos` | obra_id, relatorio_id, tipo medicao/material/aditivo, numero, rotulo, valor_centavos | aplicados só no envio |
| `atividades` + `fotos` | relatorio_id, etapa_id, nota / storage_path, ordem | alimentam galeria |
| `dias_aditivados` | obra_id, relatorio_id, motivo, dias | corrige a lacuna G |
| `clima_snapshots` | obra_id, data, condicao, prob_chuva | 1 registro/obra/dia via cron |

### Invariantes garantidas **no banco** (não só na UI)

1. Monotonicidade: trigger rejeita `relatorio_etapas.pct` menor que o último **enviado** da etapa.
2. Numerações: `unique (obra_id, numero)` em relatórios; medição/aditivo numerados em transação no envio (nunca no cliente — evita corrida).
3. Envio de relatório = **uma transação**: congela snapshot jsonb → aplica pcts em `etapas.pct_atual` → grava lançamentos e dias aditivados → gera PDF → dispara e-mail → marca enviado. Snapshot garante que o relatório nº N e seu PDF renderizam iguais para sempre, mesmo que a obra mude depois.
4. Avanço geral = função SQL única (média ponderada por peso) usada por app, PDF e admin — uma só fonte da fórmula.
5. RLS testada por suíte automatizada (o erro clássico de SaaS multi-tenant é vazar obra de outro dono).

### Decisões de implementação

- **Preços dinâmicos** (regra 11 do briefing): módulo `config/pricing.ts` validado com zod lendo `NEXT_PUBLIC_PRECO_1_OBRA`, `_3_OBRAS`, `_5_OBRAS`, `_EMAIL_EXTRA`; consumido por server components e passado como props aos client components. Atenção: mudar env na Vercel exige redeploy — se o Geraldino quiser mudar preço sem deploy no futuro, migrar para tabela `planos` (fora do briefing atual, fica registrado o trade-off).
- **Clima** (regra 8): geocodificar endereço na criação da obra (Nominatim/OSM, 1 chamada) e cron diário buscando previsão + observado (Open-Meteo — checar licença comercial — ou INMET, que é o "servidor meteorológico público" literal do briefing). Snapshots persistidos = a régua de 7 dias do proprietário e a seção 4 do relatório saem do banco, sem depender da API na hora da leitura.
- **PDF**: gerar no envio com `@react-pdf/renderer` (serverless-friendly, sem headless browser), salvar no Storage privado, servir por URL assinada.
- **E-mails**: Resend + React Email (envio de relatório, convite de acesso, boas-vindas) e SMTP do Resend no Supabase Auth (magic links com a marca).
- **Blog CMS + SEO**: v1 com **MDX no repositório** (zero infra, SEO completo com metadata/sitemap/OG) — suficiente se quem publica é você. ❓ Se o Geraldino for publicar sozinho, trocar por CMS headless leve na fase 2.
- **Admin (escopo mínimo proposto)**: KPIs (assinantes ativos, MRR, obras ativas, relatórios/semana), busca de contas, estado da assinatura por conta, log de webhooks de pagamento, reenvio de convite. Sem "entrar como usuário" na v1 (LGPD); se necessário, só com trilha de auditoria.
- **Timezone**: datas de obra calculadas em `America/Bahia` (dias corridos/restantes consistentes com a realidade local).
- **Escopo futuro iOS/Android** (Proposta): manter regras de negócio no banco (funções/RLS) e API limpa — um app React Native/Expo futuro reutiliza o Supabase direto, sem reescrever regra.
- **50 mil usuários** (Proposta): Supabase Pro + Vercel aguentam com folga; o custo real é **storage de fotos** — por isso compressão client-side no upload + transformação de imagem do Supabase para thumbnails.

### Qualidade

- Testes: Vitest para as funções de cálculo (média ponderada, numeração, % pago) contra os valores de exemplo da planilha; Playwright para os fluxos críticos (rascunho→envio, monotonicidade, acesso do proprietário, RLS).
- CI GitHub Actions (typecheck, lint, testes, build) + migrations versionadas pela Supabase CLI (você já tem instalada).
- Sentry + Vercel Analytics desde a S0.

---

## 8. 💡 Segurança & LGPD (sugestões, exceto onde citado)

- **Imediato**: rotacionar a key do AbacatePay; credenciais fora do Readme; `.env.local` + secrets na Vercel.
- **RLS multi-tenant** com testes automatizados (item mais crítico do produto).
- **Storage**: buckets privados, URLs assinadas com expiração, strip de EXIF/GPS das fotos no upload (foto de obra denuncia endereço e rotina da família).
- **LGPD** (política de privacidade é item contratado — Proposta): banner de consentimento mínimo (sem trackers de terceiros = banner simples), CPF do proprietário mascarado na UI (o protótipo já faz — `•••.456.789-••`), página de termos, fluxo de exportação/exclusão de dados, lista de suboperadores (Supabase, Vercel, Resend, AbacatePay), encarregado (DPO) nomeado.
- Rate limiting em magic link e convite de acesso (endpoints que enviam e-mail são alvo de abuso).
- Backups: PITR do Supabase habilitado no plano pago antes do launch.

---

## 9. 💡 Plano de execução proposto (40 dias)

Premissa: decisões da seção 10 fechadas antes da S1. Marcos com entregável demonstrável ao Geraldino no fim de cada fase.

| Fase | Dias | Entregas |
|---|---|---|
| **S0 — Fundação** | 1–3 | Saneamento (credenciais, rename, git init), projeto Next em `webapp/`, tokens do design system no Tailwind, Supabase (schema núcleo + RLS + migrations), auth magic link, **spike AbacatePay** |
| **S1 — Empreiteiro core** | 4–12 | Dashboard "Minhas obras" (busca, cards, status), ficha de nova obra completa (23 etapas default + CRUD + **pesos**), detalhe da obra (cartão escuro, avanço por etapa) |
| **S2 — Relatórios** | 13–22 | Formulário 4 seções + grupo Prazo (lacuna G), rascunho/editar/enviar (transação + snapshot), monotonicidade fim-a-fim, PDF no envio, e-mail ao cliente, compartilhamento por e-mail |
| **S3 — Proprietário** | 23–30 | Início (gauge duplo, indicadores, clima, atividades, lightbox), informações (acordeões), galeria, linha do tempo, perfil multi-obras; cron de clima em produção |
| **S4 — Monetização + marketing** | 31–36 | Billing AbacatePay (planos por nº de obras + add-on e-mail extra + webhooks + bloqueios por limite), tela de planos nova, landing page com preços por env, política de privacidade |
| **S5 — Encerramento** | 37–40 | Dashboard admin mínimo, blog MDX + SEO, QA/acessibilidade/estados vazios, domínio + e-mail profissional + DKIM, vídeos de instrução, deploy final |

**Riscos priorizados**

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Recorrência cartão no AbacatePay não atende (add-on, retry, pró-rata) | Média | Alto | Spike na S0; plano B: outra adquirente (ex.: Stripe/Pagar.me) — decidir cedo |
| 40 dias × escopo contratado (admin+blog+landing além do produto) | Alta | Alto | Cronograma acima assinado pelas duas partes; cortar vídeo/retificação para fase 2 |
| Vazamento entre tenants (RLS mal configurada) | Baixa | Crítico | Testes de RLS na CI desde S0 |
| Custo/licença da API de clima | Baixa | Médio | Snapshots diários (1 chamada/obra/dia) + INMET como alternativa pública |
| Entregabilidade de e-mail (magic link no spam) | Média | Médio | Domínio + DKIM/SPF na S0, não na S5 |

---

## 10. ❓ Perguntas em aberto (fechar com o Geraldino antes da S1)

1. Existe plano grátis ou trial? (protótipo tinha "grátis"; Readme não tem)
2. Preço do plano de 5 obras — confirmar R$ 599,90 (hoje sai mais caro por obra que o de 3)
3. Vídeo nos relatórios: v1 ou fase 2?
4. Dias aditivados: confirmam entrada pelo relatório (grupo "Prazo" com motivo + dias)? Motivos padronizados (chuva, aditivo de escopo, outro)?
5. Sinal contratual: campo na ficha da obra, como proposto?
6. Correção de relatório enviado: estorno no relatório seguinte resolve a v1?
7. Limite de fotos por etapa/relatório: 12 está bom?
8. Blog: quem vai publicar? (define MDX × CMS)
9. E-mail adicional (R$ 29,90): cobra imediato pró-rata ou no próximo ciclo?
10. Marco zero dos 40 dias e data de aceite de cada fase — formalizar por escrito.

---

## 11. Próximos passos imediatos

1. Rotacionar key do AbacatePay + mover credenciais para `.env.local` + limpar Readme.
2. Renomear pasta raiz (sem "?"), remover duplicatas (zips, proposta em `uploads/`), `git init` + `.gitignore` + primeiro commit do briefing.
3. Sessão de decisões (seção 10) com o Geraldino + formalizar cronograma.
4. Spike AbacatePay: criar assinatura recorrente de teste no cartão + receber webhooks (1 dia).
5. Criar o app Next em `webapp/` com os tokens do design system.
6. Schema + RLS no Supabase via CLI (migrations versionadas).
7. Executar S1 em diante conforme seção 9.
