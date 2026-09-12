# Adendo ao briefing — preços e plano variável

**Data da decisão:** 07/09/2026  
**Status:** decisão comercial confirmada  
**Documento-base:** [`BRIEFING.md`](../BRIEFING.md)

## Finalidade

Este adendo substitui, nos pontos em que houver conflito, o modelo anterior de planos fixos de 1, 3 e 5 obras descrito nas seções 3, 6, 7 e 12 do briefing.

O modelo de 5 obras por R$ 499,90 deixa de representar a decisão comercial vigente. A implementação técnica será especificada em um plano posterior, depois do fechamento das regras financeiras ainda em discussão.

## Decisões confirmadas

| Oferta | Preço mensal | Regra confirmada |
|---|---:|---|
| 1 obra | R$ 129,90 | Plano fechado para uma obra ativa. |
| 3 obras | R$ 319,90 | Plano fechado para até três obras ativas. |
| A partir de 4 obras | R$ 319,90 + R$ 99,90 por obra adicional desde a 4ª | Plano variável, sem teto de quantidade de obras e sem encaminhamento obrigatório para venda assistida. |

- O plano variável é o mesmo para qualquer volume acima do limiar; não existe um plano separado para mais de cinco obras.
- O preço-base de R$ 319,90 cobre até três obras ativas. Cada obra ativa a partir da quarta acrescenta R$ 99,90 por mês.
- A fórmula mensal do plano variável é `R$ 319,90 + R$ 99,90 × (obras ativas − 3)`.
- Obras arquivadas não compõem a cobrança a partir do próximo ciclo, sem pró-rata.
- Upgrade e downgrade entram no próximo ciclo de cobrança, sem pró-rata.
- Os preços devem continuar centralizados na configuração do produto e expressos em centavos inteiros no código e no banco.
- Produtos, checkout, limites, webhooks, termos, FAQ e telas autenticadas deverão ser alinhados a este adendo no futuro plano de implementação.

## Exemplos confirmados

| Obras ativas | Mensalidade |
|---:|---:|
| 1 | R$ 129,90 |
| 2 ou 3 | R$ 319,90 |
| 4 | R$ 419,80 |
| 5 | R$ 519,70 |
| 6 | R$ 619,60 |

## Relação com a implementação

Este documento registra a decisão comercial, mas não autoriza isoladamente alterações no checkout ou no banco. O plano de implementação deverá prever migrações, produto recorrente base, cobrança variável por uso, transições de plano, arquivamento, reconciliação e testes financeiros antes de liberar a oferta em produção.
