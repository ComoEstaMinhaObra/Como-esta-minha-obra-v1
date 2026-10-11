# Plano: migrar o billing do AbacatePay para o Mercado Pago

**Data:** 10/10/2026
**Escopo inicial:** branch `Staging`, com credenciais de teste. A `main` e a produção continuam no AbacatePay até a Staging ser aprovada.
**Decisões do Estevão (10/10/2026):** cartão em **formulário no app** (opção B); primeira cobrança pode ocorrer com pequena defasagem, e **se a cobrança não for efetuada a obra fica somente leitura**; janela de inadimplência **mantida em 14 dias** (o app cancela no provedor no 14º dia); a Staging terá um **deploy novo** feito pelo Estevão e um **projeto Supabase novo**.
**Pré-requisito das regras de negócio:** [`decisoes-financeiras-2026-09-28.md`](decisoes-financeiras-2026-09-28.md) (seções 2.1 a 2.9). A migração troca o provedor e **não muda as regras de negócio**, salvo onde a seção 4 abaixo pede decisão.

> **Credenciais:** a public key e o access token de teste **não entram neste arquivo nem em nenhum arquivo versionado**. Ficam em `.env.local` (local) e nas variáveis de ambiente do Vercel para o ambiente da Staging. O token foi colado em conversa; como é de teste, o risco é baixo, mas ele deve ser regenerado se ficar exposto. As credenciais de produção são outras e só o responsável as cadastra.

---

## 1. Situação encontrada

### 1.1 Git

- `Staging` existe **só localmente** (não está no `origin`) e está **22 commits atrás da `main`**, sem nenhum commit próprio. Dá para avançá-la com fast-forward, sem conflito.
- Não há ambiente de staging documentado no repositório (nem no CI nem no `vercel.json`).

### 1.2 Credencial recebida

Consulta somente leitura em `GET /users/me` com o token:

- É um **usuário de teste** (`tags: test_user`, `TESTUSER…`), `site_id: MLB` (Brasil). Ou seja, é a conta **vendedora** de teste.
- Para testar uma assinatura é preciso um **segundo usuário de teste, o comprador**. O vendedor não consegue pagar a si mesmo, e o `payer_email` da assinatura deve ser o do comprador de teste.

### 1.3 Onde o AbacatePay está acoplado hoje

| Camada | Arquivos | O que faz |
|---|---|---|
| Client da API | `src/lib/abacatepay.ts` | produtos, cliente, assinatura (checkout hospedado), `record-usage`, cancelar, consultar |
| Webhook | `src/app/api/webhooks/abacatepay/route.ts`, `src/lib/abacatepay-signature.ts`, `src/lib/abacatepay-webhook.ts` | `?webhookSecret=` + HMAC base64 com chave pública fixa; eventos `subscription.completed / trial_started / renewed / cancelled` |
| Ações | `src/app/(app)/cobranca/actions.ts` (`contratarObra`, `cancelarCobrancas`, `regularizarPagamento`), `obras/[obraId]/arquivar-actions.ts`, `conta/actions.ts` | criam cliente e checkout, cancelam |
| E-mail adicional | `src/lib/outbox.ts` + `src/app/api/cron/outbox/route.ts` | lança `record-usage` (add/subtract) na assinatura da obra |
| Env | `src/config/env.ts`, `.env.example`, `.github/workflows/ci.yml` | `ABACATEPAY_API_KEY`, `_WEBHOOK_SECRET`, `_PROD_OBRA_ATIVA`, `_PROD_EMAIL_EXTRA` |
| Scripts | `scripts/abacatepay-bootstrap.ts`, `scripts/spike-abacatepay.ts` | criam produtos (o Mercado Pago não tem produtos) |
| Banco | colunas `abacatepay_*` em `cobrancas_obra`, `assinaturas`, `assinatura_usos`; `webhooks_log.provedor`; `fn_claim_webhook_evento` com `'abacatepay'` fixo | ver seção 3.2 |
| UI e texto legal | `CobrancaCliente.tsx` (texto de pagamento pendente), `termos/page.tsx`, `politica-de-privacidade/page.tsx` | citam o AbacatePay como operador |
| Testes | `abacatepay-webhook*.test.ts`, `cobranca/actions.test.ts`, `job.test.ts`, pgTAP `cobranca*.test.sql` | |

A lógica de negócio (`fn_cobranca_registrar / renovar / cancelada_webhook / job_diario`, status por obra, `acesso_ate`, gating) **não depende do provedor** e deve ser reaproveitada.

---

## 2. Diferenças entre os provedores que moldam o plano

| Tema | AbacatePay (hoje) | Mercado Pago (alvo) | Impacto |
|---|---|---|---|
| Modelo | produto recorrente + checkout hospedado | `POST /preapproval` (assinatura **sem plano**, valor definido na hora); não existe "produto" | cai o bootstrap de produtos e o `garantirProdutoObraComTrial` |
| Valor | centavos (inteiro) | **reais decimais** (`transaction_amount: 129.90`) | helper de conversão, com teste, para evitar erro de 100x |
| Identificação da obra | `externalId` do checkout | `external_reference` da assinatura | mesmo papel: o id da obra |
| Cartão | só no checkout hospedado | **duas opções**: (A) `init_point` hospedado com status `pending`; (B) cartão tokenizado no app (Card Payment Brick) + `card_token_id` com status `authorized` | decisão da seção 4.1 |
| Trial / 1ª cobrança adiada | produto com `trialDays` | `auto_recurring.free_trial` ou `start_date` futuro | a confirmar no spike |
| E-mail adicional | `record-usage`: lançamento avulso que entra na próxima parcela, sem pró-rata | **não existe**. Alternativa: `PUT /preapproval/{id}` alterando `transaction_amount` (base + n × adicional) | muda o `outbox` (seção 3.4) |
| Webhook | evento com payload rico | notificação **só com o id** do recurso (`type`, `data.id`); é preciso fazer `GET` para saber o estado | webhook vira "notificar, consultar, aplicar" |
| Assinatura do webhook | HMAC base64 com chave pública fixa + secret na query | `x-signature` (`ts` + `v1`) com **HMAC-SHA256 hex**, manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` e a chave secreta do painel | novo módulo de assinatura |
| Falha de pagamento | **não avisa**; o app infere pelo período vencido | notifica por parcela (`subscription_authorized_payment`) | dá para marcar inadimplência mais cedo; manter o job como retaguarda |
| Retentativas | configurável (`7 × 2 dias` = 14 dias) | **fixo**: até 4 tentativas em 10 dias; após 3 parcelas recusadas cancela | ver decisão 4.3 |
| Trocar cartão | não tem; o app cancela e abre outro checkout | `PUT /preapproval/{id}` aceita `card_token_id` (a confirmar) | possível simplificação futura (fase 4) |
| Cancelar | `POST /subscriptions/cancel` | `PUT /preapproval/{id}` com `status: "cancelled"` (a confirmar) | troca direta |

> Os itens marcados "a confirmar" **não estão confirmados na documentação que consegui ler**. A fase 0 existe para validá-los com as credenciais de teste antes de escrever código de produção.

---

## 3. Plano de implementação

### Fase 0: preparação e spike (meio dia a 1 dia)

**0.1 Git.** Avançar a `Staging` para a `main` (`git checkout Staging && git merge --ff-only main`) e publicá-la no `origin` (precisa de OK do Estevão para o push). O trabalho sai de `feat/billing-mercadopago`, criada a partir da `Staging`, com PR para a `Staging`. A `main` não é tocada.

**0.2 Ambiente da Staging (humano).** Confirmar que existe um projeto Supabase de staging (ou autorizar usar um novo; a produção `hxlrskcnsbmmotjmxxfd` **não** serve) e um deploy da Staging no Vercel com URL estável. Atenção: a proteção de deploy do Vercel bloqueia o webhook do Mercado Pago em previews; é preciso um domínio de staging ou exceção para a rota do webhook.

**0.3 Painel do Mercado Pago (humano).**
- Criar o **usuário de teste comprador** (Suas integrações → Contas de teste).
- Em Webhooks, cadastrar a URL da Staging (modo teste) e marcar os tópicos `subscription_preapproval` e `subscription_authorized_payment` (e `payment` se for útil).
- Copiar a **chave secreta do webhook** para `MERCADOPAGO_WEBHOOK_SECRET`.

**0.4 Variáveis (Staging e `.env.local`):**

```
MERCADOPAGO_ACCESS_TOKEN=...            # servidor; nunca no client
MERCADOPAGO_WEBHOOK_SECRET=...          # servidor
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=...  # só se a opção B (Brick) for escolhida
```

**0.5 Spike** (`scripts/spike-mercadopago.ts`, no mesmo formato do `spike-abacatepay.ts`, só roda com token de teste). Responder, com chamadas reais:

1. A opção A (`pending` + `init_point`) exige login no Mercado Pago e `payer_email` igual ao da conta do comprador? Aceita pagar só com cartão?
2. A opção B (Card Payment Brick, token, `authorized`) funciona com o comprador de teste?
3. `free_trial` ou `start_date` adia a primeira cobrança em `POST /preapproval` sem plano? O que a consulta devolve (`next_payment_date`)?
4. Quando ocorre a primeira cobrança com `authorized` imediato (a documentação fala em "cerca de uma hora") e há cobrança de validação do cartão?
5. `PUT status: "cancelled"` cancela na hora? E `PUT auto_recurring.transaction_amount` entra **só na próxima parcela** ou também altera a parcela em aberto?
6. Quais notificações chegam em cada passo e em que ordem (criação, 1ª cobrança aprovada, renovação, recusa, cancelamento)? Guardar os payloads reais como fixtures dos testes.
7. `PUT card_token_id` troca o cartão e reprocessa a parcela recusada?
8. Valor mínimo aceito e limites de `external_reference`.

**Saída da fase 0:** seção "Resultado do spike" neste arquivo, com a decisão A/B e os ajustes do plano.

### Fase 1: camada do provedor (sem mexer no banco)

1. **`src/lib/mercadopago.ts`** (server-only, mesmo estilo de `abacatepay.ts`): `request()` com `Authorization: Bearer`, `X-Idempotency-Key` nas criações, erro tipado `MercadoPagoError`. Funções:
   - `criarAssinatura({ obraId, email, valorCentavos, trialDias?, cardTokenId? })`
   - `consultarAssinatura(id)` → `{ id, status, externalReference, nextPaymentDate, amount }`
   - `consultarParcela(id)` (authorized_payment)
   - `cancelarAssinatura(id)`
   - `atualizarValorAssinatura(id, centavos)`
   - `centavosParaReais()` / `reaisParaCentavos()` com testes de arredondamento.
2. **`src/lib/mercadopago-signature.ts`**: valida `x-signature` (extrai `ts` e `v1`, monta o manifest com `data.id` da query em minúsculas quando alfanumérico, HMAC-SHA256 hex, comparação `timingSafeEqual`, tolerância de `ts`). Teste com vetores gerados no próprio teste e com uma notificação real do painel ("Enviar teste").
3. **`src/config/env.ts`**: trocar `cobrancaSchema` pelas variáveis do Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`) e `publicSchema` pela public key, se a opção B for adotada. Atualizar `.env.example` e o `ci.yml` (valores falsos).

### Fase 2: webhook e ações

1. **`POST /api/webhooks/mercadopago/route.ts`**: valida a assinatura, lê `type` e `data.id`, **consulta o recurso na API** (não confia no corpo), converte para um evento interno neutro e chama o processador. Responde 200 também para eventos ignorados e erros permanentes; 5xx só para falha transitória (o Mercado Pago reenvia).
2. **Processador neutro** (refatorar `abacatepay-webhook.ts` em `cobranca-webhook.ts`): `processarCobrancaObra` já recebe `subscriptionId`, `obraId` e datas; passa a receber um evento `{ tipo, subscriptionId, obraId, periodoFim, primeiraCobrancaEm }`. Mapeamento:

   | Mercado Pago | Evento interno | RPC existente |
   |---|---|---|
   | `preapproval` `authorized` (e primeira parcela aprovada, ver spike) | `ativada` (`trial_iniciada` quando há 1ª cobrança adiada) | `fn_cobranca_registrar` |
   | `authorized_payment` aprovada (parcela 2 em diante) | `renovada` | `fn_cobranca_renovar` |
   | `authorized_payment` recusada / `recycling` | `pagamento_falhou` (novo, opcional: marca inadimplente antes do job) | nova RPC ou `fn_cobranca_job_diario` como retaguarda |
   | `preapproval` `cancelled` | `cancelada` | `fn_cobranca_cancelada_webhook` |

   O `periodo_fim` passa a vir de `next_payment_date` da consulta, o que elimina o truque do AbacatePay de "listar assinaturas e procurar o id".
3. **Idempotência:** a chave do evento deve incluir o estado (`{topic}:{data.id}:{status}:{date_last_updated}`), porque o Mercado Pago reenvia o mesmo `data.id` com ações diferentes.
4. **`contratarObra`**: remove `criarCliente` e `garantirProdutoObraComTrial`; calcula o valor (`OBRA_ATIVA.precoCentavos`) e `trialDias` a partir de `fn_vaga_paga_disponivel`; cria a assinatura com `external_reference = obraId`; redireciona ao `init_point` (A) **ou** devolve ao client o necessário para o Brick (B). Mantém a ordem das verificações, o rate limit e os códigos de erro (`ErroContratar`).
5. **`cancelarCobrancas`, `regularizarPagamento`, `arquivar-actions`, `conta/actions`**: trocam só a função chamada (`cancelarAssinatura` do novo módulo) e o tipo de erro. A ordem "gravar a intenção, chamar o provedor, desfazer se falhar" permanece.
6. **Retaguarda de 14 dias** (ver decisão 4.3): `executarJobCobranca` (`src/lib/cobranca/job.ts`) hoje só atualiza o banco. Com o Mercado Pago, quando uma obra passar de inadimplente para cancelada por prazo, o job precisa **cancelar a assinatura no provedor**, senão ela continua autorizada lá.

### Fase 3: banco e e-mail adicional

#### 3.2 Banco (migration nova, `supabase/migrations/2026101x…`)

- **Opção recomendada:** renomear as colunas para nomes neutros (`abacatepay_subscription_id` → `provedor_assinatura_id`, `abacatepay_checkout_id` → `provedor_checkout_id`, `assinaturas.abacatepay_customer_id` → `provedor_cliente_id`, `assinatura_usos.abacatepay_usage_id` → `provedor_uso_id`) e **recriar todas as funções que as referenciam**. O `RENAME COLUMN` não corrige o corpo das funções plpgsql. Pontos a recriar (últimas definições): `cobranca_por_obra_gating`, `cobranca_vaga_paga`, `cobranca_regularizar`, `email_adicional_por_obra`, `security_billing_webhook_fixes`, `security_core_fixes` (`fn_registrar_customer_id`). Rodar `grep -n abacatepay` nas migrations e pegar a definição mais recente de cada função.
- **Alternativa de menor risco:** manter os nomes `abacatepay_*` na Staging e renomear numa migration separada depois da aprovação. Evita mexer em dezenas de funções agora, ao custo de código com nome enganoso por algumas semanas. Prefiro a recomendada se os testes pgTAP já cobrem essas funções (`cobranca*.test.sql`).
- `fn_claim_webhook_evento`: receber `p_provedor` (padrão `'mercadopago'`) em vez de `'abacatepay'` fixo; ajustar a unicidade `(provedor, event_id)`.
- `fn_registrar_customer_id` e a coluna de cliente perdem a função se não usarmos clientes do Mercado Pago (o `preapproval` só precisa do `payer_email`). Decidir remover ou deixar nula.
- Regenerar `src/lib/database.types.ts` (`supabase gen types`). Seguir o memorando de testes locais: pgTAP via `docker exec`, produção só pelo responsável.

#### 3.4 E-mail adicional (`outbox`)

O `record-usage` lançava um avanço avulso (`add`/`subtract`) que valia só para a próxima parcela, por isso a renovação **relançava** os e-mails pagos a cada ciclo (`fn_enfileirar_renovacao_emails_obra`). No Mercado Pago o valor da assinatura é **persistente**:

- `processarOutbox` passa a chamar `atualizarValorAssinatura(subscriptionId, base + n × adicional)`, onde `n` é calculado no banco (e-mails pagos vigentes da obra), **absoluto e idempotente**, no lugar de `add`/`subtract` com `units`.
- Consequência: a renovação **não precisa mais relançar** nada. Pode virar uma conferência (comparar o valor no provedor com o esperado e corrigir).
- Ajustar `fn_claim_outbox` / `fn_confirmar_outbox` (hoje devolvem `operacao`, `usageId`, `installment_number`) para o novo contrato. Ler essas funções antes de mexer (`20261007120001_email_adicional_por_obra.sql`).
- Os códigos de erro do `outbox` (`COBRANCA_INCERTA`, `RATE_LIMITED`, `COBRANCA_RECUSADA`) mapeiam bem para HTTP 5xx/429/4xx do Mercado Pago.
- **Verificar no spike (item 5)** se o `PUT` de valor afeta a parcela já em aberto; se afetar, a regra "o adicional entra só na próxima fatura" (decisões 2.3) exige agendar a alteração para depois da cobrança do ciclo.

### Fase 4: interface, texto legal e limpeza

1. `CobrancaCliente.tsx`: trocar "AbacatePay" no texto de pagamento pendente e ajustar `DIAS_RECUPERACAO` conforme a decisão 4.3. Se a opção B for adotada, criar o componente do **Card Payment Brick** (client component, SDK `@mercadopago/sdk-react` ou `https://sdk.mercadopago.com/js/v2`) e o fluxo de "regularizar" com troca de cartão.
2. `termos/page.tsx` e `politica-de-privacidade/page.tsx`: trocar o operador de pagamento para o Mercado Pago (com a marcação `REVISAR` do Estevão/Geraldino já usada nesses textos, por ser texto jurídico/LGPD).
3. Painel admin (`admin/webhooks`, `admin/page.tsx`): ajustar rótulos e o texto "conferir no painel do AbacatePay".
4. Remover (só depois da aprovação da Staging e da promoção): `abacatepay.ts`, `abacatepay-signature.ts`, `abacatepay-webhook*.ts`, a rota do webhook antigo, os scripts `abacatepay-bootstrap` / `spike-abacatepay`, as entradas `abacatepay:*` do `package.json` e as variáveis antigas.
5. **Opcional (melhoria):** substituir "cancelar + novo checkout" em `regularizarPagamento` por troca de cartão via `PUT`, o que também elimina a espera de reativação até `acesso_ate` nesse caso. Só depois do spike (item 7).

### Fase 5: testes e validação na Staging

- **Unitários (Vitest):** conversão centavos/reais; assinatura do webhook (válida, `ts` antigo, manifest errado); mapeamento de eventos com fixtures do spike; idempotência por estado; `contratarObra` / `cancelarCobrancas` / `regularizarPagamento` com o client mockado (adaptar `cobranca/actions.test.ts`); `job.test.ts` com cancelamento no provedor.
- **pgTAP:** reexecutar `cobranca*.test.sql` e `email-adicional.test.sql` após a migration; adicionar o caso do `p_provedor`.
- **`npm run test:security`** (JWTs mintados, conforme o memorando) e `tsc`, `lint`, `build`.
- **Roteiro manual na Staging** (comprador de teste, cartões de teste do Mercado Pago, titular `APRO` para aprovado e `OTHE` para recusa genérica; conferir os números na documentação oficial de cartões de teste):
  1. contratar obra → assinatura ativa, `cobrancas_obra` criada, obra libera recursos;
  2. contratar obra com 1ª cobrança adiada (caso Q1) → `primeira_cobranca_em` correto;
  3. adicionar e remover e-mail pago → valor da assinatura no Mercado Pago confere;
  4. cancelar → `cancelamento_agendado`, acesso até o fim do período;
  5. recusa de cartão → obra somente leitura, aviso com data limite; depois regularizar;
  6. inadimplência além do prazo → job cancela no banco **e** no provedor;
  7. reenvio do mesmo webhook → sem efeito duplicado; webhook com assinatura inválida → 401;
  8. renovação (usar o simulador/`PUT` de data de cobrança do Mercado Pago, se existir, ou aguardar o ciclo de teste).

---

## 4. Decisões (resolvidas em 10/10/2026)

| # | Tema | Decisão | Efeito no plano |
|---|---|---|---|
| 4.1 | Cartão | **Formulário no app** (Card Payment Brick + `card_token_id`, assinatura `authorized`) | Fase 4 inclui o componente do formulário; o `init_point` hospedado não é usado |
| 4.2 | Primeira cobrança | Aceita a defasagem; sem cobrança efetuada, a obra fica **somente leitura** | O app só libera a obra ao confirmar a primeira parcela; sem confirmação, vale a regra de inadimplência |
| 4.3 | Janela de inadimplência | **14 dias** mantidos | O job diário cancela no Mercado Pago ao cancelar por prazo (fase 2, item 6) |
| 4.4 | Ambiente | Projeto Supabase novo e deploy novo da Staging | Projeto `cemo-staging` criado (ver seção 8) |

---

## 5. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| `free_trial`/`start_date` não funciona em assinatura sem plano | média | alto (quebra a regra Q1) | spike item 3; plano B: criar um **plano** (`preapproval_plan`) com `free_trial` por quantidade de dias, ou adiar a criação da assinatura até a data |
| `PUT` de valor altera a parcela em aberto | média | médio (cobra e-mail antes da hora) | spike item 5; agendar o ajuste após a cobrança do ciclo |
| Webhook sem ordem garantida e com repetição | alta | médio | sempre consultar o recurso; idempotência por estado; RPCs já toleram repetição |
| Erro de 100x na conversão de valor | baixa | alto | helper único com testes; conferir o valor no painel do Mercado Pago na Staging |
| Renomear colunas quebra função esquecida | média | alto | grep exaustivo; pgTAP; aplicar primeiro no banco de staging |
| Proteção de deploy do Vercel bloqueia o webhook | alta | baixo (só atrasa o teste) | domínio de staging ou exceção para a rota |
| Aprovação de conta de produção do Mercado Pago (assinaturas exigem conta homologada) | média | alto para o go-live | iniciar o processo no painel cedo; é ação do responsável |

---

## 6. Ordem de entrega sugerida

1. Fase 0 (inclui spike e preenchimento do "Resultado do spike") → **revisão do Estevão** (decisões 4.1 a 4.4).
2. Fases 1 e 2 em um PR para a `Staging` (provedor + webhook + ações), com testes.
3. Fase 3 (migration + outbox) em PR separado, aplicada primeiro no Supabase de staging.
4. Fase 4 (UI e texto legal) e roteiro manual da fase 5.
5. Promoção da `Staging` para a `main` e para a produção: **só pelo responsável**, com credenciais de produção do Mercado Pago, URL de webhook de produção e migration aplicada por ele.

## 7. O que NÃO está neste plano

- Cobrança por Pix/boleto (AbacatePay já era só cartão; manter).
- Mudança de preço, de regra de trial ou de regra de reativação.
- Migração de assinantes (não há assinantes reais nos planos antigos, segundo as decisões de 28/09; confirmar antes de produção).

---

## 8. Andamento

### 8.1 Feito em 10/10/2026

- `Staging` avançada para a `main` (fast-forward, só local; **ainda não publicada no `origin`**). Branch de trabalho: `feat/billing-mercadopago`.
- **Supabase de staging criado:** `cemo-staging`, ref `qrpucyycddpkfehooyzq`, região São Paulo, na organização do contato@. As 24 migrations foram aplicadas com `db push --db-url` (a produção `hxlrskcnsbmmotjmxxfd` não foi tocada e o CLI **não** foi relinkado). Senha do banco e chaves ficam só em `webapp/.env.staging.local` (ignorado pelo git).
- Código da Fase 1 (sem alterar o fluxo atual do AbacatePay): `src/lib/mercadopago.ts` (client + conversão centavos/reais), `src/lib/mercadopago-signature.ts` (validação do `x-signature`), `getMercadoPagoEnv()` em `src/config/env.ts`, `.env.example`, 13 testes unitários passando e `tsc` limpo.
- `scripts/spike-mercadopago.ts` (`npm run spike:mercadopago`), pronto para o restante do spike.

### 8.1b Fases 2 e 3 executadas (11/10/2026)

**Banco** (`supabase/migrations/20261011120001_provedor_neutro_mercadopago.sql`, aplicada no Supabase local e no `cemo-staging`):
- Colunas renomeadas para nomes neutros: `provedor_assinatura_id`, `provedor_checkout_id`, `provedor_cliente_id`, `provedor_uso_id`. As 7 funções que as citavam foram recriadas.
- `fn_claim_webhook_evento` ganhou `p_provedor` (padrão `mercadopago`); `fn_cobranca_renovar` ganhou `p_periodo_fim` (o `next_payment_date` do provedor); nova `fn_cobranca_marcar_inadimplente`; o job diário devolve as assinaturas canceladas por inadimplência para o app cancelar no Mercado Pago.
- Removidas `fn_enfileirar_renovacao_emails_obra` (o valor da assinatura é persistente) e `fn_registrar_customer_id` (o Mercado Pago não usa cliente).
- Testes pgTAP: 10 suítes, todas verdes (inclui `cobranca-mercadopago.test.sql`, novo, com 17 asserções). Testes de segurança diretos (`test:security`): 21 verdes.

**Código:**
- `src/lib/cobranca/mercadopago-webhook.ts`: consulta o recurso na API, gera o id do evento com o estado, e aplica: assinatura autorizada com a 1ª parcela paga (ou `free_trial` futuro) registra; parcela paga renova com o próximo vencimento; parcela recusada marca inadimplente e avisa o dono por e-mail; assinatura cancelada encerra a cobrança.
- `POST /api/webhooks/mercadopago`: valida `x-signature`, responde 401 para assinatura inválida, 200 para tipos ignorados e 5xx só em falha transitória.
- `contratarObra(obraId, cardTokenId)`, `regularizarPagamento(obraId, cardTokenId)` e `cancelarCobrancas`: criam a assinatura com o cartão tokenizado, registram a cobrança na hora (o webhook é a segunda via) e tratam cartão recusado sem criar nada. Na regularização a assinatura nova é criada **antes** de encerrar a antiga, então um cartão recusado não deixa a obra pior do que estava.
- Job diário: cancela no Mercado Pago, com 3 tentativas, as assinaturas canceladas por 14 dias de inadimplência.
- `outbox`: o e-mail adicional passa a somar ou subtrair R$ 29,90 no valor da assinatura da obra (`PUT`); não relança nada na renovação.
- Removidos: todo o código do AbacatePay (client, assinatura, webhook, rota, scripts, variáveis de ambiente e CI).
- Verificação: `tsc` limpo, `eslint` limpo, 169 testes unitários verdes, `next build` ok.

**Limitações conhecidas (para decidir ou tratar na fase 4/5):**
1. **Formulário de cartão ainda não existe.** As ações exigem `cardTokenId`; a tela chama sem ele e mostra "Informe os dados do cartão". Contratar e regularizar só funcionam de ponta a ponta depois da fase 4.
2. **Cancelamento no provedor após 14 dias não é refeito.** Se as 3 tentativas falharem, a cobrança já está cancelada no banco e o job não volta a ela; o erro vai para o log e a assinatura segue autorizada no Mercado Pago. Falta uma conferência diária que compare as obras canceladas com o provedor.
3. **Regularização com falha ao encerrar a antiga:** a nova assinatura é cancelada, mas a primeira cobrança dela já aconteceu e o estorno é manual.
4. **Valor do e-mail adicional:** falta conferir, após 12/10/2026 09:45 (UTC-4), que a próxima parcela sai com o valor novo (assinatura `1df70fbd…`). Não há reconciliação periódica do valor da assinatura com os e-mails pagos vigentes.
5. **Texto legal e telas ainda citam o AbacatePay** (termos, política de privacidade): fase 4.

### 8.2 Resultado do spike (11/10/2026, API real com contas de teste)

Comprador de teste: `Buyer Test User` (ID 3754974214). Cartão de teste que funciona em recorrência: **Visa 4235 6477 2802 5682** (o Mastercard 5031… dá `Unsupported_credit_card_for_recurring_payment`). A assinatura exige pagador de teste e `payer_email` no formato `test_user_<números>@testuser.com`; vendedor e comprador não podem ser o mesmo usuário.

| # | Pergunta | Resultado |
|---|---|---|
| 1 | Primeira cobrança com `authorized` + `card_token_id` | **Imediata**, na mesma chamada: a resposta já traz `status: authorized`, `summarized.charged_quantity: 1`, `last_charged_amount: 129.9` e `next_payment_date` um mês depois. A parcela aparece em `authorized_payments` como `processed` / pagamento `approved` (`accredited`). Não há a espera de cerca de uma hora que a documentação sugeria |
| 2 | Cartão recusado na contratação | A criação **falha na hora** com HTTP 400 (`CC_VAL_433 Credit card validation has failed`, `code: rejected`) e **nenhuma assinatura é criada**. O formulário no app pode mostrar o erro na hora |
| 3 | `free_trial` em assinatura sem plano | **Funciona** (`auto_recurring.free_trial: {frequency, frequency_type: "days"}`). A assinatura nasce `authorized`, **sem cobrança** (`summarized` zerado), com `next_payment_date` = hoje + N dias e `first_invoice_offset: N`. Serve para a regra Q1 (primeira cobrança adiada) |
| 4 | Cancelar | `PUT status: "cancelled"` cancela **na hora** (HTTP 200). Cancelar de novo devolve 400 (`You can not modify a cancelled preapproval`) e reativar devolve 400 (`Invalid transition from cancelled to authorized`): **cancelado é definitivo**. O cancelamento deve ser tratado como idempotente (consultar antes ou aceitar esse 400) |
| 5 | Alterar valor | `PUT auto_recurring.transaction_amount` devolve 200; não altera a cobrança já feita nem o `next_payment_date`. **Pendente:** confirmar que a **próxima parcela** sai com o valor novo. Teste em andamento: assinatura `1df70fbd…` com 1 dia de trial (cobra em 12/10/2026 às 09:45, horário do Mercado Pago, UTC-4) e valor alterado para R$ 189,70; conferir `charged_amount` depois dessa data |
| 6 | Trocar cartão | `PUT card_token_id` funciona (200) numa assinatura ativa. Com cartão recusado devolve **402** (`Subscription payment required`) e mantém o cartão antigo. Isso viabiliza a regularização **sem cancelar** (fase 4, item 5). Falta ver se reprocessa uma parcela recusada, o que só aparece com falha real de renovação |
| 7 | Notificações (ordem e payloads) | **Pendente:** exige URL pública (deploy da Staging) |
| 8 | Falha de renovação | **Pendente:** não dá para simular uma recusa na renovação com o cartão de teste; observar com o webhook na Staging, se o Mercado Pago permitir simular |

**Efeitos no plano**
- **Registro imediato:** como a criação já devolve a cobrança aprovada e `next_payment_date`, `contratarObra` pode chamar `fn_cobranca_registrar` direto, com `periodo_fim = next_payment_date`. O webhook continua como segunda via e precisa ser idempotente.
- **Estado inicial:** a obra só é liberada com `authorized` e (`charged_quantity >= 1` ou `free_trial` com `next_payment_date` futuro). Cartão recusado nunca cria cobrança: nada para marcar como somente leitura nesse caso.
- **Q1 (primeira cobrança adiada):** passa a usar `free_trial` em dias; some o `garantirProdutoObraComTrial`.
- **Cancelamento idempotente** no módulo `mercadopago.ts` (tratar o 400 de "já cancelada").
- **Regularizar pagamento:** pode virar "informar novo cartão" via `PUT card_token_id`, sem cancelar nem esperar reativação. Confirmar o comportamento com falha real antes de remover o fluxo atual.

### 8.3 Pendências humanas

1. Publicar a `Staging` no `origin` (autorizar o push) e fazer o deploy novo no Vercel com as variáveis do `.env.staging.local`.
2. No painel do Mercado Pago, cadastrar o webhook da URL do deploy (tópicos `subscription_preapproval` e `subscription_authorized_payment`) e copiar a chave secreta para `MERCADOPAGO_WEBHOOK_SECRET`.
3. No Supabase `cemo-staging`: Auth → URL Configuration com a URL do deploy; revisar provedores de login (e-mail/senha, Google, Microsoft) conforme o checklist de deploy do projeto.
