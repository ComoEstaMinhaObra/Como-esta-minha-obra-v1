# Decisões financeiras para a próxima implementação

**Data da consolidação:** 28/09/2026

**Status:** decisões comerciais e operacionais fechadas em 28/09/2026 (P1 a P7 e rodada complementar resolvidas)

**Documento-base:** [`BRIEFING.md`](../BRIEFING.md)

**Substitui nos pontos conflitantes:** [`adendo-briefing-precos-2026-09-07.md`](adendo-briefing-precos-2026-09-07.md)

## Finalidade e precedência

Este documento registra as decisões que devem orientar o próximo plano de implementação do financeiro. Ele separa as regras do acompanhamento financeiro da obra das regras de cobrança da assinatura do aplicativo.

Quando houver conflito, as decisões deste documento prevalecem sobre os modelos anteriores de planos de 1, 3 e 5 obras, sobre o modelo de R$ 319,90 mais R$ 99,90 por obra adicional e sobre a retificação de relatórios enviados.

---

## 1. Relatórios e acompanhamento financeiro da obra

### 1.1. Valor do contrato

- Uma obra deve possuir valor de contrato estritamente maior que zero.
- Não existe contrato de R$ 0,00.
- O valor deve ser armazenado em centavos inteiros.
- O valor do contrato original e o sinal são definidos apenas na criação da obra.
- Permanece válida a regra:

```text
valor contratado vigente
= contrato original
+ aditivos contratuais de acréscimo
- supressões contratuais
```

- O valor contratado vigente deve permanecer estritamente maior que zero; uma supressão que o zere ou o torne negativo é bloqueada.
- O total pago líquido (sinal + medições + materiais - estornos) nunca pode ser negativo nem superar o valor contratado vigente.
- Materiais pagos integram o total pago e contam para esse teto.
- Medições, materiais, aditivos, supressões e estornos com valor de R$ 0,00 são bloqueados.

### 1.2. Supressão contratual

- A supressão é um lançamento próprio do relatório, numerado de forma sequencial por obra: **Supressão NN — descrição**.
- A supressão reduz o escopo do contrato e pode reduzir o valor abaixo do contrato original, não apenas o valor de aditivos.
- Uma supressão que faria o contratado vigente ficar abaixo do total já pago é bloqueada até que a devolução ou o estorno da diferença seja registrado.
- A devolução ou o estorno pode ser lançado no mesmo relatório da supressão; a validação considera o estado final do relatório.

### 1.3. Sinal contratual

- O sinal integra o total pago da obra.
- O sinal é informado somente na criação da obra. Um valor pago antecipadamente depois da criação é lançado como medição comum.
- O sinal deve aparecer no primeiro relatório, dentro da parte financeira de medição, com o nome **Sinal**.
- O sinal não deve ser apresentado ao cliente como uma medição numerada comum; o rótulo visível é **Sinal**.

### 1.4. Estornos e devoluções

- Todo estorno ou devolução — de sinal, medição, material ou aditivo — preserva o lançamento original e fica vinculado a ele.
- O estorno pode ser parcial ou total.
- A soma dos estornos de um lançamento não pode superar o valor desse lançamento de origem nem tornar o total pago da obra negativo.

### 1.5. Histórico dos relatórios

- Relatório enviado e PDF permanecem imutáveis.
- **A retificação de relatório enviado deixa de existir.** Toda correção posterior aparece de forma transparente no relatório seguinte.
- Consequência aceita: um percentual físico enviado acima do real não pode ser reduzido, porque a monotonicidade das etapas continua valendo. A etapa permanece no mesmo percentual nos relatórios seguintes até a obra alcançá-lo, e o empreiteiro pode explicar a situação na nota da etapa.
- Como não existem relatórios financeiros reais a migrar (o banco contém apenas dados de testes internos), os dados podem ser reiniciados ou regenerados com as regras corrigidas.

---

## 2. Cobrança e assinatura do aplicativo

### 2.1. Precificação simplificada

O sistema deixa de classificar o cliente por um plano contratado de 1, 3, 5 ou mais obras.

A cobrança passa a ser formada por quantidades contratadas:

| Componente | Valor | Unidade |
|---|---:|---|
| Obra ativa | R$ 129,90 | por mês, por obra ativa |
| E-mail adicional | R$ 29,90 | por acesso adicional, renovado a cada 30 dias enquanto permanecer cadastrado |

Fórmula comercial base:

```text
mensalidade das obras = R$ 129,90 x quantidade de obras ativas
```

Exemplos decorrentes da nova regra:

| Obras ativas | Valor mensal das obras |
|---:|---:|
| 1 | R$ 129,90 |
| 2 | R$ 259,80 |
| 3 | R$ 389,70 |
| 4 | R$ 519,60 |
| 5 | R$ 649,50 |

Consequências confirmadas:

- Não existirá mais escolha de plano por faixa de quantidade.
- **Não existe limite de obras.** Criar uma obra é uma compra confirmada pelo usuário.
- O sistema deve registrar a quantidade atual de obras contratadas e a quantidade atual de e-mails adicionais contratados pelo usuário.
- Todas as cobranças do usuário são unificadas em um único ciclo e uma única cobrança da conta.
- Uma nova obra ou um novo acesso adicional entra no ciclo unificado existente; não cria uma assinatura separada.
- A comunicação, o checkout, o banco, os webhooks, a AbacatePay, os limites de uso e os testes devem abandonar a dependência dos identificadores de plano antigos.
- Não há assinantes reais nos planos antigos; não é necessária migração de clientes.

### 2.2. Nova obra e arquivamento

- Uma obra criada no meio do ciclo fica ativa imediatamente e passa a ser cobrada a partir da próxima fatura do ciclo unificado, pelo mês integral, sem pró-rata. Os dias restantes do ciclo em que ela foi criada não geram cobrança adicional.
  - Exemplo: ciclo de 01 a 30, obra criada no dia 20. A fatura do dia 01 cobra 2 obras (R$ 259,80); não há cobrança pelos dias 20 a 30.
- Ao arquivar uma obra durante um período já pago, não existe devolução proporcional.
- A obra arquivada deixa de compor a quantidade cobrada somente na próxima cobrança do ciclo unificado.
- **A vaga paga continua disponível até o fim do período:** se o usuário arquivar uma obra e criar outra dentro do mesmo período já pago, a nova obra aproveita a vaga paga da arquivada e não gera cobrança adicional nesse período.
- O arquivamento de uma obra também encerra, no próximo ciclo, a renovação dos e-mails adicionais daquela obra.
- O arquivamento e seu impacto financeiro devem aparecer no toast e no histórico financeiro do perfil.

### 2.3. Compra de acesso adicional

- Cada obra ativa inclui um e-mail sem custo adicional.
- **O e-mail gratuito é sempre o mais antigo confirmado**, contado pela data de confirmação do convite, e não pela data de envio.
  - Exemplo: A é convidado no dia 1 e não confirma; B é convidado no dia 2 e confirma no dia 3 — B é o gratuito. A confirma no dia 5 e passa a ser cobrado.
  - O gratuito nunca troca sozinho enquanto continuar cadastrado.
- A cobrança de R$ 29,90 incide sobre cada e-mail confirmado além do gratuito.
- **Confirmação do convite:** o destinatário abre o link, faz login e clica em "aceitar acesso". Apenas abrir o e-mail não gera cobrança. A regra vale também para destinatários que já possuem conta.
- Quando a confirmação exigir a compra de outro acesso, o proprietário deve ter confirmado previamente a compra em um popup que informa o item, o valor e o período.
- Convites pendentes não expiram. O proprietário pode substituir um convite pendente por outro e-mail, o que cancela o pendente sem cobrança.
- O acesso adicional comprado vale por 30 dias; o valor entra na próxima fatura do ciclo unificado. Os 30 dias controlam o direito ao acesso, não geram uma cobrança separada.
- Depois dos primeiros 30 dias, o acesso adicional é renovado automaticamente enquanto permanecer cadastrado na obra.
- Não existe pró-rata nem devolução por uso parcial: se o acesso for comprado e utilizado por apenas 29 dias, os R$ 29,90 continuam devidos integralmente.
- "Não ser mais utilizado" significa que o acesso foi removido, e não que o destinatário deixou de fazer login ou de abrir relatórios.
- Ao remover o acesso, o direito de acesso da pessoa removida à obra é revogado imediatamente e a renovação dos R$ 29,90 é encerrada para o próximo ciclo.
- **A vaga paga continua do proprietário até o fim do período já pago:** até o vencimento, ele pode cadastrar outro e-mail no lugar sem nova cobrança.
- Quando o e-mail gratuito é removido, o e-mail pago confirmado mais antigo passa a ser o gratuito a partir da próxima renovação. O valor já cobrado dele não é estornado, e a vaga paga correspondente permanece disponível até o fim do período já pago.

### 2.4. Avisos sobre impacto na cobrança

- Toda ação do usuário que impactar o valor cobrado deve produzir um aviso visível.
- Antes de uma compra que exija confirmação, deve existir popup com o item, o valor e o período de cobrança.
- Depois de uma ação que altere a cobrança, deve aparecer um toast informando que a alteração aparecerá na cobrança.
- O texto deve informar claramente se houve aumento, redução, compra, renovação, remoção ou cancelamento de um componente cobrado.

### 2.5. Histórico financeiro no perfil

- Toda ação que impactar a cobrança deve ser registrada em um histórico na página de perfil do usuário.
- O histórico deve ser auditável e não deve depender apenas do log do provedor.
- Como requisitos técnicos mínimos para o futuro plano, cada evento deve guardar:
  - data e hora;
  - usuário responsável;
  - tipo da ação;
  - obra ou acesso afetado;
  - quantidade anterior e nova;
  - valor unitário e impacto financeiro;
  - data de início e, quando houver, expiração;
  - estado da operação;
  - referência da operação no provedor.

### 2.6. Inadimplência

- Quando uma fatura não for paga, inicia-se um período de 14 dias para recuperação do pagamento.
- Se a fatura continuar sem pagamento ao final dos 14 dias, a assinatura é cancelada.
- Durante os 14 dias de recuperação, a conta permanece somente leitura.
- Depois do cancelamento, a conta continua somente leitura para consulta do histórico, sem criar obras, editar rascunhos ou enviar relatórios.
- O cancelamento encerra cobranças futuras; não apaga as obras e os relatórios existentes.

### 2.7. Cancelamento pelo usuário

- O usuário pode cancelar a assinatura a qualquer momento.
- A conta permanece com todos os recursos até o fim do período já pago; depois disso passa a somente leitura.
- Não existe devolução proporcional.

### 2.8. Trial

- O trial de 14 dias e um relatório permanece: sem cartão, uma obra.
- Na conversão, a assinatura nasce com quantidade de uma obra, que é a quantidade permitida no trial.
- O trial não deve ser confundido com os 14 dias de recuperação de uma fatura inadimplente.

---

## 3. Decisões anteriores expressamente substituídas

Deixam de ser vigentes:

- plano de uma obra por R$ 129,90, três obras por R$ 319,90 e cinco obras por R$ 499,90;
- preço-base de R$ 319,90 com R$ 99,90 por obra a partir da quarta;
- enumeração do cliente exclusivamente como `obra_1`, `obra_3` ou `obra_5`;
- fluxo de upgrade ou downgrade entre faixas de plano e limite de obras por plano;
- liberação imediata de vaga ao arquivar uma obra, com efeito imediato na cobrança;
- cobrança de e-mail adicional lançada no envio do convite e na próxima fatura, sem a nova confirmação de compra e sem o período próprio de 30 dias;
- promoção de um e-mail pago a gratuito com estorno da cobrança já feita;
- retificação de relatório enviado com nova versão e novo PDF;
- estorno genérico por grupo, sem vínculo com o lançamento de origem.

---

## 4. Estado das perguntas de negócio

Todas resolvidas em 28/09/2026.

| Pergunta | Decisão |
|---|---|
| P1. Franquia de e-mail por obra | Um e-mail gratuito por obra ativa: o mais antigo confirmado. |
| P2. Evento de confirmação do convite | Abrir o link, fazer login e aceitar o acesso. Abrir o e-mail não cobra. |
| P3. Renovação do acesso adicional | Automática a cada 30 dias enquanto cadastrado. |
| P4. Definição de "não utilizado" | Somente a remoção do acesso. |
| P5. Início da cobrança de nova obra | Ativa imediatamente; cobrada a partir da próxima fatura, sem cobrança pelos dias restantes do ciclo de criação (D1, 29/09/2026). |
| P6. Arquivamento durante período pago | Sem devolução; a vaga paga pode ser reaproveitada até o fim do período. |
| P7. Acesso durante e depois da inadimplência | Somente leitura durante os 14 dias e depois do cancelamento. |
| Supressão | Lançamento próprio; reduz o escopo; contratado vigente sempre > 0. |
| Estornos | Todos vinculados à origem, parciais ou totais, limitados ao valor de origem. |
| Retificação | Removida; correções no relatório seguinte. |
| Limite de obras | Não existe. |
| Convite pendente | Não expira; pode ser substituído sem cobrança. |
| Cancelamento voluntário | Recursos até o fim do período pago; depois somente leitura. |

---

## 5. Inconsistências que a próxima implementação precisará resolver

- O código e o banco atuais ainda classificam assinaturas como `trial`, `obra_1`, `obra_3` e `obra_5` e limitam obras por plano.
- A landing, a página de preços, o FAQ e os termos ainda apresentam o modelo de uma, três e mais de quatro obras, upgrade/downgrade e cobrança do e-mail "na próxima parcela".
- Os produtos e o mapeamento atual da AbacatePay ainda refletem planos por faixa.
- O fluxo existente de e-mail adicional cobra no envio do convite, e não na confirmação; quem já tem conta recebe acesso sem aceitar.
- A remoção do e-mail gratuito promove um pago e estorna a cobrança dele.
- O modelo atual não possui o histórico financeiro de ações exigido para a página de perfil.
- O webhook não trata falha de pagamento; nenhuma conta chega ao estado `inadimplente`.
- O cancelamento voluntário deixa a conta cancelada imediatamente, e não no fim do período pago.
- A criação da obra aceita contrato igual a zero no banco e na interface.
- Não existe supressão; o "estorno de aditivos" reduz o contratado sem limite.
- Não há validação de total pago entre zero e o contratado vigente.
- Estornos não são vinculados ao lançamento de origem.
- O sinal soma no total pago, mas não aparece como linha "Sinal" no primeiro relatório, no PDF e na tela do cliente.
- A retificação de relatório enviado ainda está ativa.

## 6. Limite deste documento

Este arquivo registra regras. Ele não é o plano de implementação; o plano está em [`plano-implementacao-financeiro-2026-09-28.md`](plano-implementacao-financeiro-2026-09-28.md). Detalhes técnicos que dependam da AbacatePay devem ser validados na documentação oficial e no sandbox antes de implementados.
