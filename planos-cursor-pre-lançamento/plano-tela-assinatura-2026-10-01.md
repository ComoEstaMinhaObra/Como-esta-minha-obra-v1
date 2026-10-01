# Plano — tela de Cobrança com assinatura por obra

**Data:** 01/10/2026

**Regras de negócio:** [`decisoes-financeiras-2026-09-28.md`](decisoes-financeiras-2026-09-28.md), seção 2, com a atualização de 01/10/2026 (fonte da verdade; este plano não cria regras novas)

**Relação com o plano de 28/09:** [`plano-implementacao-financeiro-2026-09-28.md`](plano-implementacao-financeiro-2026-09-28.md). As partes de cobrança desse plano (fases 2.1, 2.2, 3 e 4.1 a 4.4) foram pensadas para um ciclo único por conta e ficam **superadas por este documento** nos pontos em que conflitam. A fase 1 (financeiro da obra) já está entregue.

**Status:** pronto para execução; decisões D1 a D5 e Q1 a Q4 resolvidas em 01/10/2026 (seção 9), restando validar os pontos técnicos no spike E0

---

## 1. Por que este plano existe

Em produção (`como-esta-minha-obra.vercel.app`), a tela `/planos` ainda vende o modelo descartado: cartões de "1 obra · R$ 129,90", "3 obras · R$ 319,90" e "5 obras · R$ 499,90", com limite de obras por plano.

A regra vigente (decisões de 28/09 e 01/10/2026) é: **R$ 129,90 por obra ativa por mês, sem limite de obras, com uma assinatura e uma fatura por obra**, e o usuário cancela obras específicas na tela de **Cobrança**. Motivos: o cliente escolhe o que mantém, e, se o limite do cartão não comportar todas as obras de uma vez, uma ou outra é faturada sem derrubar as demais.

O teste de 01/10/2026 expôs três problemas:

- O trial da conta de teste permite 1 envio de relatório; o segundo foi barrado com "Assinatura necessária", e a única saída é o checkout.
- O checkout falhou com `CHECKOUT: No products found`. O dev mode do AbacatePay é um ambiente separado da produção ([documentação](https://docs.abacatepay.com/pages/devmode)); o produto configurado na Vercel não existe no ambiente da chave usada.
- O checkout cobraria o plano antigo, e o webhook gravaria `plano = obra_1` e `limite_obras = 1`.

---

## 2. Estado atual (verificado no código em 01/10/2026)

| Área | Arquivo | Hoje |
|---|---|---|
| Preços e planos | `webapp/src/config/pricing.ts` | `PlanoId = obra_1 \| obra_3 \| obra_5`, `PLANOS[]`, `planoPorId`, `limiteObras` |
| Ambiente | `webapp/src/config/env.ts` | `getServerEnv()` valida tudo de uma vez, inclusive `ABACATEPAY_PROD_OBRA_1/3/5`; uma ausente derruba o fluxo |
| Tela | `webapp/src/app/(app)/planos/{page,PlanosCliente,actions}.tsx` | três cartões; `iniciarCheckout(planoId)` com `quantity: 1`; `agendarTrocaDePlano` (upgrade/downgrade) |
| Conta | `webapp/src/app/(app)/conta/{page,actions}.tsx` | mostra `plano · status`; cancelamento na AbacatePay e a conta fica `cancelada` na hora |
| Gating | `webapp/src/lib/gating.ts` | uma única `assinatura` por usuário; `podeCriarObra` usa `limiteObras` |
| AbacatePay | `webapp/src/lib/abacatepay.ts` | `produtoIdDoPlano`, `planoPorProdutoId`, `limiteDoPlano` |
| Webhook | `webapp/src/lib/abacatepay-webhook.ts` | produto → plano; grava `plano` e `limite_obras` na assinatura do usuário |
| Banco | `assinaturas` | uma linha por usuário: `plano`, `limite_obras`, `trial_fim`, `relatorios_enviados_trial`; nada por obra |
| Upsell | `webapp/src/components/ui/ModalUpsellLimite.tsx` | "Limite do plano" em nova obra, relatórios e compartilhar |

**Limitações do AbacatePay que o modelo por obra respeita** (documentação consultada em 01/10/2026): o checkout de assinatura aceita exatamente um produto, com `quantity`; só aceita cartão (`["CARD"]`); o cancelamento é sempre imediato; não existe evento de falha de pagamento (esgotadas as tentativas, vem `subscription.cancelled` com `cancelledDueTo: "max_payment_retries_exceeded"`); o `retryPolicy` aceita `maxRetry` de 1 a 10 e `retryEvery` de 1 a 30 dias (padrão: 3 tentativas, 1 dia); **não existe data de início futura**: a assinatura ativa quando o checkout é pago, e a única forma de adiar a primeira cobrança é um produto com `trialDays` (o checkout cobra R$ 0,00 e só guarda o cartão); **a documentação não descreve reutilização de cartão salvo nem criação de assinatura sem checkout**. Com uma assinatura por obra, cada assinatura tem **um produto e `quantity: 1`**, e a dúvida antiga sobre trocar a quantidade (`change-plan`) deixa de existir.

---

## 3. Escopo

### Dentro

1. Tela **Cobrança** (`/cobranca`, antiga `/planos`), com a lista de obras e o estado da cobrança de cada uma.
2. Assinatura por obra: checkout, webhook e estado de cobrança por obra.
3. Cancelamento e reativação **por obra**, com a regra de `acesso_ate`.
4. Banco: estado de cobrança por obra.
5. Gating por obra, sem limite de obras.
6. Remoção do upsell por limite e dos textos de planos por faixa nas telas autenticadas.
7. Ambiente por domínio, produto único no dev mode e roteiro de teste com cartões do dev mode.

### Fora (continuam em outros planos)

- Vagas de e-mail adicional, aceite de convite e popup de compra do convite (plano de 28/09, fases 2.2 e 4.3), agora cobrados na assinatura da obra.
- Fluxo completo de "criar obra" com popup de compra (fase 4.1 do plano de 28/09): este plano define o que a **tela de Cobrança** faz com uma obra sem assinatura, e a criação de obra precisa chamá-la.
- Histórico financeiro completo do perfil (resumo aqui; completo na fase 4.4 do plano de 28/09).
- Landing, `/precos` pública, FAQ e termos (fase 4.5 do plano de 28/09).
- Admin e MRR (fase 4.6).

---

## 4. Comportamento da tela de Cobrança

### Cabeçalho

- Faixa do trial (se aplicável): "X dias · 1 relatório incluído · Y usado(s)".
- Total mensal: soma das faturas das obras com cobrança ativa, e a próxima data de cobrança mais próxima.

### Lista de obras

Uma linha por obra ativa (e por obra cancelada que ainda não chegou a `acesso_ate`), com nome, valor (R$ 129,90), estado e as datas relevantes.

| Estado da obra | O que mostra | Ação |
|---|---|---|
| Sem assinatura (obra do trial) | "Em trial até dd/mm" ou, se expirado, "Somente leitura" | **Assinar esta obra** |
| `ativa` | "Ativa · próxima cobrança em dd/mm" | **Cancelar cobrança** |
| `inadimplente` | "Pagamento pendente desde dd/mm. Esta obra está somente leitura e a assinatura é cancelada em dd/mm se não for paga." | **Regularizar pagamento** (D3) |
| `cancelamento_agendado` | "Cancelada. Você mantém tudo até dd/mm." | **Reativar** desabilitado até `acesso_ate`, com o motivo (D4) |
| `cancelada` | "Somente leitura. Suas informações continuam disponíveis para consulta." | **Reativar** |

Princípios (seção 2.4 das decisões): popup com item, valor e período **antes** de qualquer ação que mude a cobrança; toast **depois**. Aqui: assinar, cancelar e reativar.

### Cancelar cobrança de uma ou mais obras

Seleção múltipla com resumo ("2 obras · R$ 259,80/mês deixam de ser cobradas a partir de dd/mm e dd/mm; você mantém tudo até essas datas") e confirmação.

### Mensagens de erro

Substituir códigos crus (`CHECKOUT: No products found`, `PRODUTO_NAO_CONFIGURADO`) por mensagens para o usuário e registrar o código técnico só no log (`logSeguro`). Exemplo: "Não foi possível abrir o pagamento agora. Tente novamente em alguns minutos."

---

## 5. Mudanças técnicas

### 5.1. Ambiente e configuração

- `src/config/env.ts`: separar o schema do servidor por domínio (`supabase`, `cobranca`, `email`, `cron`), com um getter por domínio, como já foi feito com `getAdminEnv()` (commit `d7906ea`). Telas de relatório não dependem das variáveis de cobrança.
- Variáveis de cobrança novas, no lugar de `ABACATEPAY_PROD_OBRA_1/3/5`: `ABACATEPAY_PROD_OBRA_ATIVA`, `ABACATEPAY_PROD_EMAIL_EXTRA` (mantida) e `NEXT_PUBLIC_PRECO_OBRA_CENTAVOS`.
- Atualizar `.env.example`, `.env.local` e Vercel juntos. **Remover os valores provisórios** colocados na Vercel em 01/10/2026.
- `src/config/pricing.ts`: remover `PlanoId`, `PLANOS`, `planoPorId` e `limiteObras`. Exportar `OBRA_ATIVA`, `EMAIL_EXTRA`, `TRIAL` e `calcularTotalMensal(obrasAtivas, emailsAdicionais = 0)`. Atualizar `pricing.test.ts`.

### 5.2. Produto no AbacatePay (dev mode primeiro)

- `scripts/abacatepay-bootstrap.ts`: criar `obra-ativa-v2` (mensal, 12990) e `email-adicional-v2` (sem ciclo, 2990), de forma idempotente por `externalId`, e imprimir os IDs.
- **Produtos com início adiado (Q1):** como o provedor só adia a primeira cobrança por `trialDays` no produto, a assinatura de uma obra criada durante o período pago de uma arquivada usa um produto `obra-ativa-v2-td<dias>` criado sob demanda (mesmo preço, `trialDays` = dias restantes do período pago da arquivada). Registrar o ID criado para reaproveitar. Validar no spike o limite e o arredondamento do `trialDays` e o que `subscription.trial_started` entrega.
- Rodar no **mesmo ambiente da chave de API** usada pela Vercel de testes (dev mode). A chave fica no `.env.local` do responsável, não no chat.
- Em produção (E7), repetir a criação com a chave de produção. Desativar os produtos antigos.

### 5.3. Banco (migration única, estilo expandir/contrair)

Nova tabela `public.cobrancas_obra`, uma linha por assinatura de obra:

- `id`, `user_id`, `obra_id`, `abacatepay_subscription_id` (único), `status` (`ativa`, `inadimplente`, `cancelamento_agendado`, `cancelada`);
- `periodo_inicio`, `periodo_fim`, `inadimplente_desde`, `cancelamento_solicitado_em`, `acesso_ate`;
- `valor_centavos` (valor cobrado, para o histórico) e `criado_em`.
- Índice parcial único: uma cobrança **não cancelada** por obra.
- RLS: dono lê; gravação só por funções `security definer`.

`assinaturas` continua guardando o trial (`trial_fim`, `relatorios_enviados_trial`) e o `abacatepay_customer_id`. Colunas `plano` e `limite_obras` ficam sem uso e saem na segunda migration (contrair, E6).

Funções que usam `limite_obras` ou o status da conta (`private.assinatura_permite_escrita`, `fn_criar_obra`, convites e envio de relatório) passam a consultar o estado **da obra**. Regerar `src/lib/database.types.ts` e atualizar `security.test.sql` (pgTAP).

### 5.4. Checkout (`cobranca/actions.ts`)

- `contratarObra(obraId)`: valida que a obra é do usuário e não tem cobrança ativa; cria o cliente AbacatePay se faltar; escolhe o produto: `ABACATEPAY_PROD_OBRA_ATIVA` (primeira cobrança na contratação) ou, se a obra foi criada durante o período já pago de uma obra arquivada (Q1), o produto com `trialDays` igual aos dias restantes; cria a assinatura com `items: [{ id: <produto>, quantity: 1 }]`, `externalId: <id da obra>`, `methods: ["CARD"]`, `retryPolicy` conforme o spike (hoje previsto `{ maxRetry: 7, retryEvery: 2 }`); `completionUrl` e `returnUrl` em `/cobranca`.
- Remover `agendarTrocaDePlano` e a ação de reduzir plano com excesso de obras.
- Manter o rate limit `checkout`.

### 5.5. Cancelamento e reativação

- `cancelarCobrancaObra(obraId)`: grava `cancelamento_solicitado_em` e `acesso_ate = periodo_fim` **antes** de chamar o cancelamento na AbacatePay; se o provedor falhar, desfaz.
- O cancelamento no provedor é imediato, então o app usa `acesso_ate` para preservar o que já foi pago.
- Reativar: só quando `agora >= acesso_ate` (D4); chama `contratarObra`.

### 5.6. Webhook (`abacatepay-webhook.ts`)

O webhook localiza a cobrança pelo `abacatepay_subscription_id` (ou pelo `externalId`, que é o id da obra):

- `subscription.completed`: cria ou atualiza `cobrancas_obra` como `ativa`, com o período; limpa os campos de inadimplência e cancelamento.
- `subscription.renewed`: renova o período; se estava `inadimplente`, volta a `ativa`.
- `subscription.cancelled`:
  - `cancelledDueTo = max_payment_retries_exceeded` → `cancelada`;
  - cancelamento pedido pelo app (existe `cancelamento_solicitado_em`) → `cancelamento_agendado` até `acesso_ate`;
  - qualquer outro motivo → `cancelada` e alerta no admin.
- Idempotência e assinatura do webhook continuam como estão.
- Remover `planoPorProdutoId` e `limiteDoPlano` de `abacatepay.ts`.

### 5.7. Jobs diários

Como o AbacatePay não envia evento de falha de pagamento, o app infere:

- cobrança `ativa` com `periodo_fim + 1 dia < agora` e sem renovação → `inadimplente`, `inadimplente_desde = agora` e e-mail ao usuário (cita a obra);
- `cancelamento_agendado` com `acesso_ate < agora` → `cancelada`.

Rodam no cron existente (`vercel.json`); o plano Hobby limita crons a execução diária, o que basta aqui.

### 5.8. Gating (`src/lib/gating.ts`)

Passa de "estado da conta" para **estado da obra**:

- `podeEditarObra`, `podeEnviarRelatorio` e `podeCompartilhar` dependem da cobrança da obra (`ativa`, ou `cancelamento_agendado` com `agora <= acesso_ate`), ou do trial (a obra do trial, dentro do prazo e com 1 envio).
- `inadimplente` e `cancelada`: somente leitura **daquela obra**.
- `podeCriarObra`: sem limite de obras; criar obra exige confirmação de compra (fluxo de 4.1 do plano de 28/09). O trial continua com 1 obra.
- Atualizar `gating.test.ts` (criar se não existir).

### 5.9. Telas

- Renomear a rota para `/cobranca` (menu, títulos e e2e), com redirecionamento permanente de `/planos`; atualizar `returnUrl`/`completionUrl` e o link do `ModalUpsellLimite`.
- `cobranca/page.tsx`: ler `cobrancas_obra` das obras do usuário, a contagem de obras ativas e o trial; montar o estado único por obra da seção 4.
- `cobranca/CobrancaCliente.tsx` (no lugar de `PlanosCliente.tsx`): lista de obras, seleção múltipla para cancelar, `ModalBase` para as confirmações.
- `conta/page.tsx`: resumo curto com link para Cobrança; remover `plano · status` e o botão único de cancelar assinatura (`CancelarAssinatura.tsx`).
- Substituir `ModalUpsellLimite` por um aviso "Esta obra está somente leitura / contrate a cobrança" que leva a `/cobranca`, nos três pontos de uso (`FormNovaObra.tsx`, `FeedRelatorios.tsx`, `ModalCompartilhar.tsx`). O texto "limite do plano" deixa de existir.

---

## 6. Testes

### Automatizados

- **Vitest:** `pricing.test.ts` (`calcularTotalMensal` bate com a tabela de 2.1 das decisões), `gating.test.ts` (por obra; `cancelamento_agendado` até `acesso_ate`; `inadimplente`/`cancelada` somente leitura; sem limite de obras), `abacatepay-webhook.test.ts` (cada evento e motivo de cancelamento, localizando a obra, idempotência).
- **pgTAP:** permissão de escrita por estado da cobrança da obra; índice parcial (uma cobrança não cancelada por obra); RLS de `cobrancas_obra`.
- **Playwright:** `/cobranca` no trial lista a obra com "Assinar esta obra" e nenhum cartão de faixa; o botão abre o popup de confirmação; estados semeados (`ativa`, `inadimplente`, `cancelamento_agendado`) mostram o texto e as ações da seção 4; `/planos` redireciona.

### Dev mode (roteiro manual)

Cartões do dev mode ([documentação](https://docs.abacatepay.com/pages/devmode)): aprovado `4242 4242 4242 4242` (validade futura, CVV de 3 ou 4 dígitos); rejeitados `4000000000000002`, `4000000000009995`, `4000000000000127`, `4000000000000069`, `4000000000000101`. **O responsável digita o cartão**; o agente não digita dados de cartão em página de pagamento.

Pré-requisitos: produto criado no dev mode; variáveis da Vercel sem placeholders; webhook do AbacatePay apontando para `/api/webhooks/abacatepay`, com o segredo configurado.

0. Q1: arquivar a obra paga e criar outra dentro do período; contratar a nova e conferir que o checkout cobra R$ 0,00, guarda o cartão e que a primeira cobrança fica para o fim do período da arquivada.
1. Trial com 1 obra → `/cobranca` → "Assinar esta obra" → popup → checkout com o cartão aprovado → `?sucesso=1`.
2. Banco: `cobrancas_obra` com a obra `ativa`, período preenchido. Enviar o segundo relatório (o que o trial barrava) e confirmar que passa.
3. Criar uma segunda obra, contratá-la e conferir que cada obra tem a sua assinatura, o seu ciclo e a sua data (Q4).
4. Cancelar a cobrança de **uma** obra: ela fica `cancelamento_agendado` até `acesso_ate`; a outra segue `ativa`. O botão "Reativar" fica desabilitado até a data (D4).
5. Falha de pagamento: contratar uma obra com um cartão rejeitado e observar o que o provedor envia e quando (inclui `max_payment_retries_exceeded`); verificar que **só aquela obra** fica somente leitura (Q3).
6. Regularização: exercitar a ação da tela de Cobrança sobre a obra inadimplente e registrar como o provedor reage (nova tentativa automática ou novo checkout).
7. Renovação: simular pelo painel do dev mode e conferir `renewed`.

---

## 7. Ordem de entrega

| Etapa | Conteúdo | Pode ir para produção sozinha? |
|---|---|---|
| E0 | Spike no dev mode: o `externalId` volta no webhook; se o checkout com `customerId` reaproveita o cartão de uma assinatura anterior (a documentação não diz); `trialDays` por produto para a Q1 (limites, `trial_started`, quando ocorre a primeira cobrança); comportamento das falhas (`retryPolicy`); payloads de `completed`, `renewed` e `cancelled` | Sim (só pesquisa) |
| E1 | Ambiente por domínio (5.1) e produto no dev mode (5.2) | Sim, sem mudar comportamento |
| E2 | Migration expandir (5.3) | Sim |
| E3 | Webhook, gating e jobs (5.6, 5.7, 5.8), lendo o estado novo com fallback no antigo | Sim |
| E4 | Checkout, cancelamento e telas (5.4, 5.5, 5.9), com a rota `/cobranca` | Sim, depois do roteiro da seção 6 |
| E5 | Migration contrair (`drop` de `plano` e `limite_obras`) e limpeza de código morto | Depois de E4 verificado em produção |
| E6 | Textos públicos (landing, `/precos`, FAQ, termos) e e-mails com o novo modelo | Junto da liberação |
| E7 | Produto em produção, variáveis finais na Vercel e desativação dos produtos antigos | Junto da liberação |

Cada etapa com `npm run typecheck`, `lint`, `test` e `build` passando.

---

## 8. Critérios de aceite

- `/cobranca` não exibe "1 obra / 3 obras / 5 obras" nem "limite do plano", em estado nenhum.
- Cada obra mostra a sua própria cobrança, e o total mostrado é a soma das obras.
- Cancelar uma obra não altera as demais.
- Uma obra com pagamento pendente fica somente leitura sem bloquear as outras.
- Uma conta em trial assina uma obra no dev mode e, em seguida, envia o segundo relatório.
- Cancelar mantém os recursos da obra até `acesso_ate`; "Reativar" só habilita depois dessa data.
- Nenhuma tela de relatório ou obra quebra por falta de variável de cobrança.
- Nenhum erro técnico do provedor aparece cru para o usuário.

---

## 9. Decisões

### Resolvidas em 01/10/2026

| # | Decisão |
|---|---|
| D1 | O pagamento de teste usa o **cartão de teste do dev mode** (seção 6). Mantém-se `methods: ["CARD"]`. |
| D2 | **Uma assinatura e uma fatura por obra**, mesmo que a cobrança não seja unificada. A tela de Cobrança lista as obras ativas e permite cancelar obras específicas; se o limite do cartão não comportar todas as obras, uma ou outra é faturada. (Substitui a quantidade/ciclo único; a dúvida sobre `change-plan` deixa de existir.) |
| D3 | A regularização de pagamento pendente acontece na **tela de Cobrança** (a tela hoje "Planos" passa a se chamar Cobrança, `/cobranca`). A mecânica do provedor é validada no dev mode com os cartões rejeitados. |
| D4 | **Opção A:** quem cancelou só reativa a obra depois de `acesso_ate`. Registrada na seção 2.7 das decisões. |
| D5 | Nomes: `ABACATEPAY_PROD_OBRA_ATIVA`, `ABACATEPAY_PROD_EMAIL_EXTRA` e `NEXT_PUBLIC_PRECO_OBRA_CENTAVOS`. A chave de API decide o ambiente (dev ou produção); o prefixo `PROD` é histórico. |

### Resolvidas em 01/10/2026 (derivadas da D2; registradas na seção 4 de [`decisoes-financeiras-2026-09-28.md`](decisoes-financeiras-2026-09-28.md))

| # | Decisão | Consequência técnica |
|---|---|---|
| Q1 | Obra nova durante o período já pago de uma obra arquivada: **assinatura nova, com a primeira cobrança no próximo ciclo** (fim do período pago da arquivada). | Produto com `trialDays` criado sob demanda (5.2 e 5.4); validar no E0 |
| Q2 | A documentação não descreve reutilização de cartão salvo: **cada obra passa pelo seu próprio checkout**. | A tela mostra as obras sem pagamento e contrata uma de cada vez (seção 4); o spike E0 verifica se o cartão é reaproveitado |
| Q3 | Obra inadimplente bloqueia **só ela mesma**. | Gating por obra (5.8); criar obra nova não depende de outras obras |
| Q4 | Datas de cobrança diferentes por obra são aceitas, **por enquanto**. | A tela mostra a data de cada obra e o total do mês |

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| O provedor não devolver o `externalId` da obra no webhook | Spike E0; alternativa: mapear pelo `abacatepay_subscription_id` gravado no checkout |
| Cada obra exigir um checkout com novo cartão (Q2) | Já é a regra adotada: a tela mostra as obras pendentes e contrata uma de cada vez; o spike E0 pode reduzir o atrito |
| O `trialDays` por produto não servir para adiar a primeira cobrança da Q1 (limites, arredondamento ou não coberta pelo dev mode) | Spike E0; alternativa: cobrar a obra nova na contratação e registrar um crédito de um período no histórico, ou reabrir a Q1 |
| Datas de cobrança diferentes confundirem o usuário (Q4, aceita "por enquanto") | Mostrar a data de cada obra e o total do mês; texto explicativo; reavaliar após o lançamento |
| Webhook em produção antes da migration | Ordem E2 → E3 → E4; o webhook lê o estado novo e mantém o fallback |
| Cancelamento pedido no app e falha na chamada ao provedor | Gravar a intenção primeiro e desfazer se o provedor falhar; o job diário reconcilia |
| Usos avulsos de e-mail pendentes se perdem no cancelamento imediato | Limitação já aceita no plano de 28/09 (valor baixo); agora afeta só a obra cancelada |
| Variáveis provisórias da Vercel esquecidas em produção | Passo explícito em E1 e E7 |
| Conflito com a migration de login social em `handle_new_user` | Esta migration não toca `handle_new_user`; a fase 4.3 do plano de 28/09 continua responsável |
