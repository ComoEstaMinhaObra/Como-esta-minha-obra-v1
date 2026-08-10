# Briefing do Projeto — Como Está Minha Obra

**Versão 2.0 · 10/08/2026 · Documento-mestre do projeto**

Este documento consolida o briefing original (Readme, Proposta Comercial, planilha "Linha de criação", spec do protótipo) com a análise técnica ([ANALISE-TECH-LEAD.md](ANALISE-TECH-LEAD.md)) e as **decisões fechadas com o Geraldino em 10/08/2026**. Em caso de conflito com qualquer documento anterior, **este documento prevalece**.

Legenda: 💡 = detalhe de implementação sugerido pelo Tech Lead ainda não validado explicitamente (tudo o mais está decidido).

---

## 1. Visão do produto

SaaS de acompanhamento de obras que substitui o caos de WhatsApp por relatórios semanais organizados. Dois lados:

- **Empreiteiro** (desktop + mobile): cria obras, publica relatórios semanais (avanço físico, financeiro, fotos, prazo, clima), compartilha com o cliente.
- **Proprietário** (mobile-first, somente leitura): acompanha tudo — cada informação da sua tela é derivada dos relatórios enviados. Nunca edita nada.

Público: pequenos construtores, engenheiros, arquitetos, empreiteiros; do outro lado, proprietários e investidores. Missão, visão e diferenciais completos na aba "Proposta de valor" da planilha.

**Marca:** "Como Está Minha Obra" · domínio `comoestaminhaobra.com.br` **já comprado**. Logo: ícone placeholder por enquanto. O protótipo usa a marca provisória "Demobra" — substituir em todas as telas e copies no port.

---

## 2. Escopo contratual

Contrato assinado (27/06/2026, opção 2: R$ 5.950 + 20% participação societária): aplicação web responsiva para até 50 mil usuários, contendo interface do cliente, interface do empreiteiro, integração de pagamentos, dashboard de administrador, base de dados, página de vendas/website, blog com CMS e SEO, política de privacidade (LGPD), e-mails de autenticação personalizados, domínio e e-mail profissional, vídeos de instrução, 1 ano de garantia, 1 mês de consultoria pós-launch (meta: 10 pagantes). Escopo futuro (fora deste ciclo): apps iOS e Android.

Prazo contratual de 40 dias: tratamento do cronograma **adiado por decisão** (10/08) — plano de fases na seção 12 permanece em dias relativos.

---

## 3. Planos e monetização (decidido em 10/08/2026)

| Plano | Preço | Por obra |
|---|---|---|
| 1 obra | R$ 129,90/mês | R$ 129,90 |
| 3 obras | R$ 319,90/mês | R$ 106,63 |
| 5 obras | **R$ 499,90/mês** | R$ 99,98 |
| E-mail adicional de proprietário (por obra) | + R$ 29,90/mês | — |

- O plano de 5 obras foi ajustado de R$ 599,90 → **R$ 499,90** para manter desconto progressivo consistente (decisão 5.1-B). Como os preços são variáveis de ambiente, ajustar é trivial se o Geraldino preferir outro valor.
- **Preços dinâmicos via variáveis de ambiente** em todos os pontos (billing, landing, componentes React). Fonte única: módulo `config/pricing.ts` validado com zod.
- Cada obra inclui **1 e-mail de proprietário**; e-mails adicionais são add-on cobrado por obra.
- **Trial: 14 dias grátis, limitado a 1 relatório** (decisão 10.1). Implementação: trial gerenciado pelo app, **sem cartão** — 1 obra, rascunhos livres, **1 envio de relatório** incluído. Conversão obrigatória ao fim dos 14 dias ou na tentativa de enviar o 2º relatório, o que vier primeiro. (O AbacatePay tem trial nativo com tokenização de cartão; não usaremos na v1 — só entra no checkout quem converte.)
- **Excluir páginas de cliente libera vaga do plano** (decisão 10/08): o empreiteiro pode excluir uma página de acompanhamento (obra) para não precisar contratar plano maior. A vaga é liberada imediatamente e o acesso do proprietário é revogado imediatamente. 💡 Implementação sugerida: exclusão como arquivamento (soft-delete) com 30 dias de retenção antes da remoção definitiva de dados/fotos — protege contra perda acidental de histórico e atende LGPD (eliminação efetiva ao fim da retenção).

---

## 4. Autenticação e acessos (decidido)

- **v1: magic link** (e-mail + login, sem senha). Fases seguintes: e-mail+senha, Google, Microsoft — tudo via Supabase Auth, sem mudança de arquitetura.
- **Proprietário**: acesso por e-mail cadastrado + login (nada de link público com senha — copies do protótipo que mencionam "senha" serão atualizadas).
- E-mails de autenticação personalizados (item contratado): SMTP custom do Supabase Auth apontando para o Resend, templates com a marca.

---

## 5. Regras de negócio consolidadas (v2 — substituem a lista da spec do protótipo)

1. **Avanço geral = média ponderada** das etapas: Σ(peso × pct) ÷ Σ(pesos). Pesos default iguais (equivale à média simples do protótipo até alguém editar). Nunca é digitado diretamente.
2. **Monotonicidade**: nenhum relatório pode reduzir o percentual de uma etapa abaixo do último relatório **enviado**. Garantido na UI (mínimo do slider) e no banco (trigger).
3. **Numeração automática**: medições "Medição NN" (sem texto livre, só valor); aditivos "Aditivo NN — descrição"; materiais com rótulo livre. Numeração gerada no servidor, em transação.
4. **Aditivos** somam ao contratado total; % pago = pago (medições + materiais) ÷ contratado total.
5. **Sinal contratual**: campo opcional "Sinal (R$)" na ficha da obra — vira o primeiro lançamento pago com rótulo próprio, fora da numeração de medições (decisão 5.2-H).
6. **Rascunho → envio**: relatório nasce rascunho (não altera nada, não notifica); só o envio explícito aplica avanço + financeiro + prazo, gera PDF, e notifica o cliente por e-mail. Envio é uma transação única com snapshot imutável.
7. **Número do relatório** é sequencial por obra e preservado ao editar rascunho.
8. **Dias aditivados entram pelo relatório** (decisão 5.2-G): grupo "Prazo" no formulário — motivo padronizado + quantidade de dias. Motivos conforme convenções da construção civil (decisão 10.4):
   - Chuvas acima da média / condições climáticas adversas
   - Aditivo de escopo (serviços extras)
   - Atraso no fornecimento de materiais
   - Licenças e aprovações de órgãos públicos
   - Interferências imprevistas (solo, estrutura, vizinhança)
   - Caso fortuito ou força maior
   - Outro (descrição livre)
   A data prevista de término é recalculada: término contratual + Σ dias aditivados.
9. **Correção pós-envio (v1)**: relatório enviado é imutável; erros são corrigidos por lançamento de estorno/ajuste no relatório seguinte, transparente no histórico (decisão 5.2-J). Retificação formal com trilha de auditoria: fase 2.
10. **Fotos**: máximo **12 por etapa por relatório**; compressão client-side (~1600px, WebP) no upload (decisão 5.2-K). **Vídeo: fase 2** (decisão 5.2-I) — remover menções a vídeo das telas da v1.
11. **PDF**: todo relatório enviado gera PDF imutável no ato do envio; **download disponível para o empreiteiro e para o proprietário** (decisão 10/08).
12. **Clima**: preenchido automaticamente, sem input do usuário — CRUD interno alimentado por API meteorológica (decisão 10/08): geocodificação do endereço 1× na criação da obra; job diário busca previsão/observado e persiste em `clima_snapshots` (1 registro/obra/dia); todas as telas leem do banco, nunca da API ao vivo. Candidatas: INMET (público) ou Open-Meteo (validar licença comercial na S0).
13. **Proprietário 100% derivado e somente leitura**; multi-obras no perfil.
14. **Toasts** escuros confirmam toda ação relevante (padrão do design system).
15. **23 etapas canônicas** (decisão 5.1-F — lista da planilha com ortografia corrigida), com CRUD (adicionar/remover/editar) e **peso editável** por etapa:
    1. Montagem do canteiro de obras · 2. Demolições · 3. Terraplanagem · 4. Fundações · 5. Estrutura · 6. Alvenarias · 7. Cobertura · 8. Instalações elétricas e rede · 9. Instalações hidrossanitárias · 10. Instalações de ar condicionado · 11. Rebocos e contrapisos · 12. Impermeabilizações · 13. Revestimentos de piso · 14. Revestimentos de parede · 15. Revestimentos de teto · 16. Fachadas · 17. Esquadrias (janelas) · 18. Esquadrias (portas) · 19. Acabamentos de granito · 20. Acabamentos elétricos e luminárias · 21. Louças e metais sanitários · 22. Pintura · 23. **Limpeza** final de obra
16. **Limites de plano**: nº de obras ativas conforme plano; exclusão/arquivamento de página libera vaga imediatamente (seção 3).

---

## 6. Especificação funcional

**Base:** [Context/explicacao-do-prototype.md](Context/explicacao-do-prototype.md) continua sendo a spec de referência de telas e componentes. **Deltas decididos** sobre ela:

| Tela | Mudança |
|---|---|
| Cadastro/Login | Sem campo de senha — magic link. Painel promocional: trocar "abre com senha" por acesso por e-mail |
| Planos | Redesenho: 3 cartões por nº de obras (preços da seção 3) + add-on de e-mail + chamada do trial "14 dias grátis · 1 relatório" |
| Ficha da obra | + campo "Sinal (R$)" na seção Financeiro; seção Etapas ganha peso editável por etapa |
| Formulário de relatório | + grupo "Prazo" (motivo padronizado + dias aditivados); fotos limitadas a 12/etapa; sem vídeo na v1 |
| Detalhe da obra (empreiteiro) | + botão de download do PDF em cada relatório enviado |
| Página do proprietário | Mantém "Abrir em PDF"; remover contadores de vídeo dos cards na v1 |
| Conta/obras (empreiteiro) | + ação "Excluir página de acompanhamento" (com confirmação forte; libera vaga do plano) |
| Todas | Marca "Como Está Minha Obra" no lugar de "Demobra"; domínio real no link de compartilhamento |

---

## 7. Integração de pagamentos — AbacatePay (verificado na documentação oficial em 10/08/2026)

Confirmado: **assinatura recorrente por cartão é suportada** (e cartão é o único método aceito em assinaturas). Modelo da plataforma e mapeamento para o produto:

- **Produtos** (`POST /v2/products/create`, preço em centavos): criar 3 produtos recorrentes `cycle: MONTHLY` (Plano 1 Obra, 3 Obras, 5 Obras) + 1 produto **avulso** (`cycle: null`) "E-mail adicional de proprietário" (R$ 29,90).
- **Assinatura** (`POST /v2/subscriptions/create`): exatamente 1 produto por assinatura; retorna URL de checkout hospedado; a assinatura (`subs_...`) só existe após o pagamento, confirmado pelo webhook `subscription.completed`. Política de retry configurável (`maxRetry` até 10, `retryEvery` até 30 dias) antes do cancelamento automático.
- **Upgrade/downgrade** (`POST /subscriptions/change-plan`): agendado como `PENDING` e aplicado **no próximo ciclo** (sem pró-rata). Uma alteração pendente por vez.
- **E-mail adicional** (`POST /subscriptions/record-usage`): o produto avulso é lançado como uso na assinatura ativa (`action: add`/`subtract`, `units`); consolida automaticamente na **próxima parcela** do ciclo. Isso responde a pergunta 10.9: **a cobrança do e-mail extra entra na próxima fatura mensal, sem pró-rata** (comportamento da plataforma). Remover um e-mail = `subtract` antes da cobrança / não lançar no ciclo seguinte.
- **Webhooks** (HTTPS obrigatório, validação HMAC com `secret`): tratar `subscription.completed` (ativa plano), `subscription.renewed` (renovação paga), `subscription.cancelled` (bloqueia recursos; campo `cancelledDueTo` informa o motivo, ex. esgotamento de retries). Registrar todos em `webhooks_log`.
- **Atenção**: a documentação não prevê alteração de preço de produto existente → mudança de preço = criar produto novo (versionado por `externalId`, ex. `plano-1-obra-v2`) e usar nos checkouts novos; assinantes antigos mantêm o preço (grandfathering) ou migram via change-plan. O trial é gerenciado pelo app (seção 3), então o checkout AbacatePay só aparece na conversão.

---

## 8. Arquitetura (aprovada em 10/08/2026)

Resumo executivo — detalhes completos na seção 7 do [ANALISE-TECH-LEAD.md](ANALISE-TECH-LEAD.md):

- **Monolito Next.js (App Router) + TypeScript estrito + Tailwind** em `webapp/`, route groups: `(marketing)` landing/preços/blog/política · `(auth)` · `(app)` empreiteiro · `(cliente)` proprietário · `(admin)` · `api/` webhooks, PDF, cron de clima.
- **Supabase**: Auth (magic link), Postgres com **RLS multi-tenant testada em CI**, Storage privado com URLs assinadas.
- **Modelo de dados núcleo**: `profiles`, `assinaturas` (+ registro de usos de add-on), `obras` (ficha completa + lat/lng + valor contratado + sinal + arquivada_em), `etapas` (nome, ordem, **peso**, pct_atual), `obra_acessos`, `relatorios` (numero único por obra, status, **snapshot jsonb**, pdf_path), `relatorio_etapas`, `lancamentos` (medição/material/aditivo/estorno), `atividades` + `fotos`, `dias_aditivados` (motivo padronizado + dias), `clima_snapshots`, `webhooks_log`.
- **Invariantes no banco**: trigger de monotonicidade; numerações em transação (`unique (obra_id, numero)`); envio = transação única (snapshot → aplica → lançamentos → PDF → e-mail → enviado); avanço ponderado em função SQL única usada por app, PDF e admin.
- **PDF**: `@react-pdf/renderer` no envio, Storage privado, URL assinada — download para ambos os lados.
- **E-mails**: Resend + React Email (relatório, convite, boas-vindas) e SMTP do Resend no Supabase Auth.
- **Blog**: MDX no repositório na v1 (SEO completo: metadata, sitemap, OG). Migra para CMS headless se o Geraldino for publicar sozinho (pendência 10.8).
- **Admin mínimo**: KPIs (assinantes, MRR, obras ativas, relatórios/semana), busca de contas, estado de assinatura, log de webhooks, reenvio de convite.
- **Port do design system**: tokens do protótipo no tema do Tailwind (greige `#FAFAF9`, tinta `#141414`, âmbar `#F25C1F`/`#D94F16`/`#FFB38A`, cinzas `#8A8A85`/`#B5B5B0`, bordas `#E4E4E0`/`#ECECE9`, gradiente escuro `#1A1A1A→#2E2B28→#4A3327`; Space Grotesk 300/400 + Source Serif 4; pills, cartões 18–22px, barras 2–3px, toasts); fontes via `next/font` (self-host); inputs próprios de moeda (centavos inteiros no banco) e data; responsividade via CSS. Paridade visual tela a tela com o protótipo.
- **Timezone** `America/Bahia` para dias corridos/restantes. Regras no banco preparam os apps móveis futuros.
- **Qualidade**: Vitest (cálculos validados contra os exemplos da planilha), Playwright (rascunho→envio, monotonicidade, RLS, billing), GitHub Actions, migrations via Supabase CLI, Sentry.

---

## 9. Segurança & LGPD (aprovado em 10/08/2026)

- Credenciais fora de qualquer arquivo versionado (`.env.local` + secrets na Vercel); **rotacionar a key do AbacatePay** que estava no Readme (fazer no dashboard AbacatePay antes do primeiro commit).
- RLS multi-tenant com suíte de testes em CI (risco mais crítico do produto).
- Storage: buckets privados, URLs assinadas com expiração, **strip de EXIF/GPS** das fotos no upload.
- LGPD: política de privacidade (item contratado), termos, CPF mascarado na UI, exportação/exclusão de dados, suboperadores (Supabase, Vercel, Resend, AbacatePay), encarregado nomeado; exclusão de página de cliente elimina dados do proprietário ao fim da retenção.
- Rate limiting em magic link e convites; PITR/backups do Supabase antes do launch.

---

## 10. Stack e ambiente

React · TypeScript · Next.js (App Router) · Tailwind CSS · Supabase (Auth/Postgres/Storage) · AbacatePay (cartão) · Resend · `@react-pdf/renderer` · API meteorológica (INMET ou Open-Meteo) · Vercel. GitHub CLI e Supabase CLI instaladas na máquina. App Next em subpasta `webapp/` deste repositório.

Saneamento decidido (5.3-L/N/O), a executar na fase S0: renomear pasta raiz (remover "?") ou tornar `webapp/` a raiz do git; remover duplicatas (zips do protótipo, proposta assinada dentro de `design-system/.../uploads/`); `.gitignore` (`.env*`, `.DS_Store`, `node_modules`); limpar credenciais do Readme; corrigir `launch.json` (remover entrada "lifeplanner").

---

## 11. Plano de execução (fases relativas — cronograma absoluto adiado por decisão)

| Fase | Dias | Entregas |
|---|---|---|
| **S0 — Fundação** | 1–3 | Saneamento (seção 10), app Next + tokens, schema + RLS + migrations, auth magic link, produtos e webhook AbacatePay em sandbox, escolha da API de clima |
| **S1 — Empreiteiro core** | 4–12 | Dashboard obras, ficha completa (23 etapas + pesos + sinal), detalhe da obra |
| **S2 — Relatórios** | 13–22 | Formulário completo (avanço, financeiro, atividades ≤12 fotos, **prazo**, clima), rascunho/editar/enviar (transação + snapshot), PDF nos dois lados, e-mail, compartilhamento |
| **S3 — Proprietário** | 23–30 | Início (gauge duplo, indicadores, clima 7 dias), acordeões, galeria, linha do tempo, perfil; cron de clima em produção |
| **S4 — Monetização + marketing** | 31–36 | Billing completo (planos, trial 14 dias/1 relatório, add-on e-mail via record-usage, change-plan, webhooks, bloqueios por limite, excluir página libera vaga), tela de planos nova, landing com preços por env, política de privacidade |
| **S5 — Encerramento** | 37–40 | Admin mínimo, blog MDX + SEO, QA/acessibilidade/estados vazios, domínio + DKIM + e-mail profissional, vídeos de instrução, deploy final |

---

## 12. Registro de decisões (10/08/2026, com Geraldino)

| Achado/Pergunta | Decisão |
|---|---|
| 5.1-A Preços divergentes | Readme prevalece (planos por nº de obras), com ajuste do 5.1-B |
| 5.1-B Anomalia 5 obras | **R$ 499,90** (desconto progressivo consistente) |
| 5.1-C Média × pesos | Média ponderada; pesos default iguais, editáveis na ficha |
| 5.1-D Autenticação | E-mail + login (magic link na v1) |
| 5.1-E Marca | "Como Está Minha Obra"; domínio .com.br já comprado |
| 5.1-F Etapas | As 23 da planilha, ortografia corrigida ("Limpeza final de obra") |
| 5.2-G Dias aditivados | Grupo "Prazo" no relatório; motivos padronizados da construção civil (10.4) |
| 5.2-H Sinal contratual | Campo "Sinal (R$)" na ficha da obra |
| 5.2-I Vídeos | v1 só fotos; vídeo na fase 2 |
| 5.2-J Correção pós-envio | Estorno/ajuste no relatório seguinte; retificação formal na fase 2 |
| 5.2-K Limite de fotos | 12 por etapa/relatório, compressão no upload |
| 5.3-L Credenciais | Mover para `.env.local`, rotacionar key, limpar Readme (S0) |
| 5.3-M Prazo dos 40 dias | Ignorar por enquanto (fases relativas) |
| 5.3-N Pasta com "?" | Renomear / git root no subdiretório (S0) |
| 5.3-O Higiene de arquivos | Limpar duplicatas + .gitignore (S0) |
| 5.3-P AbacatePay | Cartão confirmado na documentação oficial (seção 7) |
| 6 Port do protótipo | Aprovado (tokens, next/font, inputs, CSS) |
| 7 Arquitetura | Aprovada |
| 8 Segurança & LGPD | Aprovado |
| 10.1 Trial | 14 dias grátis, limitado a 1 relatório (sem cartão) |
| 10.4 Motivos de dias aditivados | Padronizados conforme convenções da construção civil (seção 5.8) |
| 10.9 Cobrança do e-mail extra | Resolvido pela plataforma: entra na próxima parcela via record-usage, sem pró-rata |
| Obs. Clima | CRUD interno alimentado por API meteorológica |
| Obs. PDF | Exportação em PDF para proprietário **e** empreiteiro |
| Obs. Exclusão de páginas | Excluir página de cliente libera vaga do plano (💡 soft-delete com retenção de 30 dias) |

## 13. Pendências ainda abertas

1. **10.8 — Blog**: quem vai publicar? (define MDX × CMS headless; default atual: MDX)
2. **Logo final** (placeholder por enquanto, conforme Readme)
3. **Marco zero do prazo/cronograma absoluto** (adiado por decisão 5.3-M)
4. 💡 Definir por escrito o que o "1 ano de garantia" cobre (bugs sim, features novas não)
5. Fase 2 (backlog): vídeo nos relatórios, retificação formal com auditoria, CMS para blog, senha/Google/Microsoft no login, apps iOS/Android
