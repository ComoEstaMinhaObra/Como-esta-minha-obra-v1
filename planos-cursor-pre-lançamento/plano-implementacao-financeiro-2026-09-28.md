# Plano de implementação — financeiro da obra e cobrança por quantidade

**Data:** 28/09/2026

**Regras de negócio:** [`decisoes-financeiras-2026-09-28.md`](decisoes-financeiras-2026-09-28.md) (fonte da verdade; este plano não cria regras novas)

**Status:** pronto para execução

---

## 0. Visão geral

| Fase | Entrega | Depende de |
|---|---|---|
| 0 | Preparação e validação da AbacatePay no sandbox | — |
| 1 | Financeiro da obra: contrato > 0, supressão, estornos vinculados, limites do pago, sinal, fim da retificação | — |
| 2 | Modelo de dados da cobrança: quantidades, vagas pagas, histórico financeiro | 0 |
| 3 | Integração AbacatePay: produtos, checkout, sincronização de quantidade, webhooks, inadimplência, cancelamento | 0, 2 |
| 4 | Fluxos e telas: nova obra, arquivamento, convite e aceite, conta/perfil, textos públicos, admin | 2, 3 |
| 5 | Testes finais, sandbox ponta a ponta e liberação | 1–4 |

A fase 1 não depende da AbacatePay e pode começar imediatamente, em paralelo com a fase 0.

### D1 — cobrança da obra criada no meio do ciclo (resolvida em 29/09/2026: leitura i)

A próxima fatura passa a cobrar N+1 obras (o mês seguinte). Os dias restantes do ciclo atual não geram cobrança adicional. Implementação: só `change-plan`; não existe produto de período parcial.

Exemplo com ciclo de 01 a 30 e obra criada no dia 20: no dia 01 a fatura cobra 2 obras (R$ 259,80).

---

## Fase 0 — Preparação

1. Commitar os documentos de decisão e este plano.
2. Criar uma branch própria para o trabalho financeiro.
3. Zerar os dados financeiros de teste do banco (autorizado: só existem dados de testes internos) e regenerar o `scripts/seed-demo.ts` com as regras novas depois da fase 1.
4. **Spike no sandbox da AbacatePay** — confirmar e registrar o resultado neste documento antes da fase 3:
   - [ ] `change-plan` aceita o **mesmo produto** com outra `quantity`.
   - [ ] `change-plan` com a quantidade igual à atual não dá erro (ou descobrir como cancelar uma alteração `PENDING`).
   - [ ] Checkout de assinatura aceita `quantity > 1` (reativação de conta com várias obras).
   - [ ] `retryPolicy: { maxRetry: 7, retryEvery: 2 }` resulta em cancelamento cerca de 14 dias depois da primeira falha.
   - [ ] Payload de `subscription.cancelled` traz `cancelledDueTo` e permite distinguir cancelamento voluntário de `max_payment_retries_exceeded`.
   - [ ] Payload de `subscription.completed` e `subscription.renewed` traz datas suficientes para calcular o fim do período atual.
   - [ ] `record-usage` de produto sem ciclo entra na próxima parcela, e o que acontece com usos pendentes quando a assinatura é cancelada.

### Limitações da AbacatePay que moldam o desenho (verificadas na documentação em 28/09/2026)

- Uma assinatura tem exatamente um item; o item aceita `quantity`.
- `change-plan` recebe `productId` e `quantity`, fica `PENDING` e é aplicado no início do próximo ciclo. Só existe uma alteração pendente por assinatura; uma nova chamada sobrescreve a anterior.
- `record-usage` só aceita produtos sem ciclo e entra na próxima parcela.
- Status de assinatura: apenas `ACTIVE` e `CANCELLED`. **Não existe evento de falha de pagamento.** Esgotadas as tentativas, a assinatura é cancelada com `cancelledDueTo: "max_payment_retries_exceeded"`.
- **O cancelamento é sempre imediato.** Não existe cancelar no fim do período.
- Eventos de assinatura: `subscription.completed`, `subscription.renewed`, `subscription.cancelled`, `subscription.trial_started`.

---

## Fase 1 — Financeiro da obra

### 1.1. Contrato e valores maiores que zero

- Migration: `obras.valor_contratado_centavos > 0`; `fn_criar_obra` rejeita `p_valor_centavos <= 0`.
- `validar_rascunho`: medições, materiais, aditivos, supressões e estornos com `valorCentavos > 0`.
- `FormNovaObra.tsx`: valor obrigatório maior que zero, mensagem de erro e botão bloqueado.
- `calculos.ts`: remover a tolerância a contrato zero.

### 1.2. Supressão

- Migration: `lancamento_tipo` ganha `supressao`; `lancamento_grupo` ganha `supressoes`; numeração sequencial por obra como os aditivos (`unique (obra_id, tipo, numero)` ou equivalente).
- Rascunho (`tipos.ts`): `financeiro.supressoes: { descricao: string; valorCentavos: number }[]`.
- Rótulo: `Supressão NN — descrição`.
- Snapshot: novo campo `supressoesAcumuladoCentavos`; `contratadoTotalCentavos = original + aditivos − supressões − estornos de aditivos`.
- Atualizar `montar-snapshot.ts`, o snapshot SQL do envio e `calcularFinanceiro`.

### 1.3. Estornos vinculados

- Migration: `lancamentos.lancamento_origem_id uuid references lancamentos(id)`; `check ((tipo = 'estorno') = (lancamento_origem_id is not null))`.
- Rascunho: `estornos: { origemId: string; descricao: string; valorCentavos: number }[]`; o grupo passa a ser derivado da origem.
- Origem permitida: lançamento já persistido da mesma obra, do tipo `sinal`, `medicao`, `material` ou `aditivo`.
- Estorno de aditivo reduz o contratado; os demais reduzem o pago.
- Nova função SQL `fn_saldo_estornavel(p_obra)` que devolve, por lançamento de origem, o valor ainda estornável (usada pela tela e pela validação).

### 1.4. Invariantes validadas no envio

Validar no estado final do relatório, dentro de `fn_preparar_envio_relatorio` (fonte da verdade), com mensagens de erro próprias em `rpc-erros.ts`:

- `CONTRATADO_INVALIDO`: contratado vigente ≤ 0.
- `PAGO_NEGATIVO`: pago líquido < 0.
- `PAGO_ACIMA_CONTRATADO`: pago líquido > contratado vigente (inclui o caso de supressão sem devolução).
- `ESTORNO_ACIMA_ORIGEM`: soma dos estornos de uma origem > valor da origem.
- `ESTORNO_ORIGEM_INVALIDA`: origem de outra obra, não persistida ou de tipo não permitido.

Rede de segurança: trigger `constraint deferrable initially deferred` em `lancamentos` que revalida os totais da obra no fim da transação.

Espelhar as mesmas regras em TypeScript (`calculos.ts`) para feedback imediato no formulário.

### 1.5. Sinal no primeiro relatório

- Rótulo do lançamento de sinal: `Sinal` (migration corrige os existentes e o `fn_criar_obra`).
- No envio do primeiro relatório, o lançamento de sinal (hoje com `relatorio_id` nulo) passa a ser vinculado a esse relatório e incluído em `lancamentosNovos` do snapshot.
- PDF (`relatorio-pdf.tsx`) e cliente (`InformacoesAcordeao.tsx`): o sinal aparece no grupo de medições, primeiro da lista, com o rótulo **Sinal** e sem número.

### 1.6. Remoção da retificação

- UI: remover o link "Retificar relatório" (`FeedRelatorios.tsx`), o modo `?retificar=` (`DetalheAcoes.tsx`, `ModalRelatorio.tsx`) e o caminho de retificação em `enviar-relatorio-action.ts`.
- E-mail: remover `src/emails/retificacao-relatorio.tsx`, o envio em `src/lib/email/enviar.ts` e o teste correspondente.
- Banco: migration que remove `fn_preparar_retificacao`, `fn_finalizar_retificacao`, `private.montar_snapshot_retificacao` e `private.aplicar_deltas_retificacao`, e restringe `relatorio_versoes.tipo` a `original`. A tabela `relatorio_versoes` continua (é usada no envio e no reprocessamento do PDF).
- Remover `historicoVersoes` de `carregar-dados.ts` se não houver outro uso.
- Atualizar `supabase/SECURITY.md` e `security.test.sql`.

### 1.7. Telas

- `SecaoFinanceiro.tsx`:
  - novo grupo **Supressões**;
  - estorno escolhido a partir de uma lista de lançamentos com saldo estornável, com valor limitado a esse saldo;
  - editar qualquer estorno, não só o último;
  - avisos em tempo real: pago acima do contratado, contratado ≤ 0.
- Página da obra (`obras/[obraId]/page.tsx`), PDF e cliente: exibir supressões e o contratado vigente.

### 1.8. Testes da fase 1

- Vitest: `calculos.test.ts` e `montar-snapshot.test.ts` com contrato > 0, supressão abaixo do original, supressão com devolução no mesmo relatório, estorno parcial e total, estorno acima da origem, sinal no primeiro relatório.
- pgTAP (`security.test.sql`): as cinco invariantes da 1.4 e a remoção das funções de retificação.
- Playwright (`smoke.spec.ts`): criar obra com valor zero é bloqueado; enviar relatório com supressão.

**Critério de conclusão:** `npm run typecheck`, `lint`, `test`, `build` e testes do banco passando; dados de demonstração regenerados.

---

## Fase 2 — Modelo de dados da cobrança

### 2.1. Assinatura por quantidade

Migration em `assinaturas`:

- Remover `plano` e `limite_obras` (e o enum `plano_tipo`) depois que o código deixar de usá-los.
- Adicionar:
  - `obras_cobradas int` — quantidade cobrada no período atual;
  - `vagas_obra_periodo int` — vagas pagas no período (não diminuem ao arquivar);
  - `periodo_inicio timestamptz`, `periodo_fim timestamptz`;
  - `inadimplente_desde timestamptz`;
  - `cancelamento_solicitado_em timestamptz`, `acesso_ate timestamptz`.
- `assinatura_status` ganha `cancelamento_agendado` (recursos completos até `acesso_ate`).

Regra das vagas de obra:

- Criar obra: se `obras ativas < vagas_obra_periodo`, usa vaga paga e não cobra; senão, compra (vaga + 1 e quantidade do próximo ciclo + 1, sem cobrança do período parcial — D1).
- Arquivar: não altera `vagas_obra_periodo`; reduz a quantidade do próximo ciclo.
- Renovação: `vagas_obra_periodo = obras ativas`.

### 2.2. Vagas de e-mail adicional

Nova tabela `public.vagas_email`:

- `id`, `obra_id`, `assinatura_id`, `acesso_id` (nulo quando a vaga está livre), `inicio`, `pago_ate`, `renovar boolean`, `criado_em`.

Mudanças em `obra_acessos`:

- `confirmado_em timestamptz`;
- `autorizado_cobranca_em timestamptz` (quando o proprietário confirmou o popup);
- `substituido_por uuid`.

Regras:

- O gratuito da obra é o acesso ativo com o `confirmado_em` mais antigo (função SQL única, `private.acesso_gratuito(p_obra)`).
- Aceite de um convite que não é o gratuito: ocupa uma vaga livre da obra, se houver; senão cria uma vaga nova (`pago_ate = agora + 30 dias`) e enfileira a cobrança.
- Remoção de acesso pago: revoga o acesso na hora, libera a vaga (`acesso_id = null`) até `pago_ate` e marca `renovar = false`.
- Remoção do gratuito: o próximo confirmado mais antigo vira gratuito; a vaga dele fica livre até `pago_ate` e não renova. Sem estorno.
- Vencimento da vaga: ocupada e com renovação → estende 30 dias e cobra; livre → expira.
- Arquivar obra: todas as vagas da obra deixam de renovar.
- Remover a lógica atual de "promoção com subtract" da função de remoção de acesso.

### 2.3. Histórico financeiro

Nova tabela `public.eventos_cobranca`, somente leitura para o dono (RLS) e gravada apenas por funções `security definer`:

- `id`, `user_id`, `ator_id`, `criado_em`, `tipo` (enum: `obra_comprada`, `obra_vaga_reutilizada`, `obra_arquivada`, `email_autorizado`, `email_comprado`, `email_vaga_reutilizada`, `email_renovado`, `email_removido`, `email_expirado`, `assinatura_ativada`, `assinatura_renovada`, `pagamento_pendente`, `cancelamento_solicitado`, `assinatura_cancelada`);
- `obra_id`, `acesso_id`;
- `quantidade_anterior`, `quantidade_nova`;
- `valor_unitario_centavos`, `impacto_centavos`;
- `inicio`, `expira_em`;
- `estado` (`pendente`, `confirmado`, `falhou`);
- `referencia_provedor`.

### 2.4. Outbox

`private.billing_outbox` passa a ter o tipo da operação (`usage_add`, `usage_subtract`, `change_quantity`), o produto e a quantidade alvo. `change_quantity` é idempotente: sempre envia a quantidade final desejada para o próximo ciclo.

### 2.5. Testes da fase 2

pgTAP para: gratuito pelo `confirmado_em`, reaproveitamento de vaga de obra e de e-mail, remoção do gratuito sem estorno, expiração e renovação de vaga, RLS do histórico.

---

## Fase 3 — Integração AbacatePay

### 3.1. Produtos e configuração

- `scripts/abacatepay-bootstrap.ts`: criar `obra-ativa-v2` (`MONTHLY`, 12990) e `email-adicional-v2` (sem ciclo, 2990).
- `.env.example` e `src/config/env.ts`: remover `NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS`, `NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS`, `ABACATEPAY_PROD_OBRA_1/3/5`; adicionar `NEXT_PUBLIC_PRECO_OBRA_CENTAVOS`, `ABACATEPAY_PROD_OBRA_ATIVA` e `ABACATEPAY_PROD_EMAIL_EXTRA`.
- `src/config/pricing.ts`: remover `PlanoId`, `PLANOS`, `planoPorId`; exportar `OBRA_ATIVA`, `EMAIL_EXTRA`, `TRIAL` e `calcularMensalidade(obras, emails)`. Atualizar `pricing.test.ts`.
- `src/lib/abacatepay.ts`: remover `produtoIdDoPlano`, `planoPorProdutoId`, `limiteDoPlano`; nova função `alterarQuantidadeObras(subscriptionId, quantidade)` sobre `change-plan`.

### 3.2. Checkout

- Conversão do trial e reativação: `items: [{ id: OBRA_ATIVA, quantity: max(1, obras ativas) }]`, `retryPolicy: { maxRetry: 7, retryEvery: 2 }` (ajustar conforme o spike).
- Remover `agendarTrocaDePlano`.

### 3.3. Webhooks (`abacatepay-webhook.ts`)

- `subscription.completed`: status `ativa`, `obras_cobradas`, `vagas_obra_periodo`, período; evento no histórico.
- `subscription.renewed`: status `ativa`, limpa `inadimplente_desde`, novo período, `vagas_obra_periodo = obras ativas`; evento no histórico. Remover o reenfileiramento de e-mails por renovação (substituído pelo job de vagas da 3.5).
- `subscription.cancelled`:
  - `cancelledDueTo = max_payment_retries_exceeded` → `cancelada`;
  - cancelamento pedido pelo app → mantém `cancelamento_agendado` até `acesso_ate`;
  - outro motivo → `cancelada` e alerta no admin.
- Eventos de `checkout.refunded` e `checkout.disputed`: registrar no log e no admin, sem mudar status automaticamente.

### 3.4. Inadimplência (sem evento de falha)

Como a AbacatePay não avisa a falha, o app infere:

- Job diário: assinatura `ativa` com `periodo_fim + 1 dia < agora` e sem `subscription.renewed` → `inadimplente`, `inadimplente_desde = agora`, evento `pagamento_pendente`, e-mail ao usuário.
- `subscription.renewed` durante a recuperação → volta a `ativa`.
- `subscription.cancelled` por tentativas esgotadas (cerca de 14 dias com 7 × 2) → `cancelada`.
- `private.assinatura_permite_escrita` e `gating.ts`: `inadimplente` e `cancelada` são somente leitura.

### 3.5. Cancelamento voluntário

- A ação chama o cancelamento na AbacatePay (sempre imediato, então não há cobrança seguinte) e grava `cancelamento_agendado` com `acesso_ate = periodo_fim`.
- Job diário: `cancelamento_agendado` com `acesso_ate < agora` → `cancelada`.
- **Limitação aceita:** usos avulsos ainda pendentes para a próxima parcela (e-mails comprados) não são cobrados quando o cliente cancela. Registrar essa limitação.

### 3.6. Jobs

- Job diário de vagas de e-mail: renova vagas vencidas ocupadas (`usage_add`, histórico `email_renovado`) e expira as livres.
- A outbox continua precisando rodar a cada 5 minutos antes do lançamento ([`pendencia-cron-outbox.md`](pendencia-cron-outbox.md)).
- Observação: o ciclo da assinatura é mensal e as vagas de e-mail são de 30 dias; de vez em quando uma fatura terá duas renovações do mesmo e-mail ou nenhuma. Isso segue a regra decidida.

### 3.7. Testes da fase 3

`abacatepay-webhook.test.ts` para cada evento e motivo de cancelamento; testes do job de inadimplência e do job de vagas.

---

## Fase 4 — Fluxos e telas

### 4.1. Nova obra

- Remover o upsell por limite (`LIMITE_OBRAS`, `ModalUpsellLimite` nesse fluxo).
- Antes de criar:
  - com vaga paga livre → aviso "Esta obra usa uma vaga já paga até dd/mm";
  - sem vaga → popup de compra: "Obra ativa — R$ 129,90/mês, cobrada a partir da fatura de dd/mm".
- Depois: toast "A nova obra aparecerá na sua cobrança de dd/mm".

### 4.2. Arquivar obra

Confirmação informando que a obra sai da cobrança a partir de dd/mm, que a vaga paga fica disponível até lá e que os e-mails adicionais da obra deixam de renovar. Toast e evento no histórico.

### 4.3. Convite e aceite

- `ModalCompartilhar.tsx`:
  - convite que pode ser cobrado → popup "Se aceitar, este acesso custa R$ 29,90 a cada 30 dias, cobrados na fatura unificada";
  - lista mostra gratuito, pago (até dd/mm), pendente, vaga livre até dd/mm;
  - ação "Substituir convite pendente".
- Enviar convite nunca cobra.
- Aceite: tela para o convidado (link do convite ou `/c/[obraId]` quando o status é `convidado`) com o botão **Aceitar acesso**, que chama a RPC de aceite (define `confirmado_em`, calcula gratuito ou pago, ocupa ou cria vaga, enfileira cobrança).
- `handle_new_user` deixa de ativar acessos automaticamente no cadastro. **Coordenar com a migration não commitada `20260921220001_handle_new_user_login_social.sql`**, que altera a mesma função.
- Aceite de um acesso pago quando a assinatura não está `ativa` → bloqueado com mensagem ao convidado e aviso ao proprietário.

### 4.4. Conta e perfil

- `/conta`:
  - resumo: obras × R$ 129,90 + e-mails × R$ 29,90, próxima cobrança em dd/mm;
  - estado da assinatura (ativa, pagamento pendente com prazo, cancelamento agendado até dd/mm, cancelada);
  - **histórico financeiro** (tabela `eventos_cobranca`);
  - cancelar assinatura com o texto "Você mantém tudo até dd/mm".
- `/planos`: vira a página de assinatura/conversão, sem cartões de plano.
- `gating.ts`: remover `limiteObras`; `cancelamento_agendado` tem os mesmos direitos de `ativa` até `acesso_ate`.

### 4.5. Textos públicos

- Landing (`(marketing)/page.tsx`) e `/precos`: R$ 129,90 por obra ativa, sem faixas; e-mail adicional R$ 29,90 a cada 30 dias a partir do segundo confirmado; trial.
- FAQ: "mais obras" (sem upgrade), "cancelar" (mantém até o fim do período), "e-mail adicional" (cobrado quando o convidado aceita).
- Termos (`termos/page.tsx`, seção 3): trocar upgrade/downgrade pela cobrança por quantidade, arquivamento, vagas pagas, inadimplência de 14 dias e cancelamento no fim do período.

### 4.6. Admin

- MRR = Σ obras cobradas × 12990 + vagas de e-mail ativas × 2990.
- Listas de contas inadimplentes e com cancelamento agendado.

---

## Fase 5 — Liberação

1. Rodar `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` e os testes do banco.
2. Playwright: conversão do trial, criar obra com e sem vaga, arquivar, convite → aceite gratuito e pago, remover o gratuito, cancelar.
3. Roteiro manual no sandbox da AbacatePay: renovação, falha de pagamento até o cancelamento, cancelamento voluntário.
4. **Antes do deploy em produção**, resolver as pendências existentes:
   - migrations de segurança ainda não aplicadas em produção ([`supabase/PENDENCIAS.md`](../webapp/supabase/PENDENCIAS.md));
   - cron da outbox a cada 5 minutos ([`pendencia-cron-outbox.md`](pendencia-cron-outbox.md)).
5. Criar os produtos v2 em produção, atualizar as variáveis na Vercel e desativar os produtos antigos.

---

## Riscos

| Risco | Mitigação |
|---|---|
| `change-plan` não aceitar mudar só a quantidade | Spike da fase 0 antes da fase 3; alternativa: produtos por quantidade (`obra-ativa-x1`, `x2`…) criados sob demanda |
| Inadimplência inferida por data pode marcar uma conta cedo demais | Tolerância de 1 dia, volta automática a `ativa` no `renewed`, alerta no admin |
| Usos avulsos perdidos no cancelamento | Limitação registrada; valor baixo |
| Mudança em `handle_new_user` conflitar com o login social em andamento | Fazer a fase 4.3 depois de commitar o trabalho de login social |
