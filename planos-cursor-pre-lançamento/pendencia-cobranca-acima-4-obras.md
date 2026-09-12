# Pendência — cobrança “Acima de 4 obras”

**Status:** copy pública publicada; fluxo de cobrança **não** alinhado  
**Data da landing:** set/2026  
**Referência:** `plano-landing-pre-lancamento.md` (ponto de decisão comercial)

---

## O que já está no ar (páginas públicas)

Landing (`/`) e preços (`/precos`) exibem um terceiro cartão comercial:

| Elemento | Conteúdo exibido |
| --- | --- |
| Título | Acima de 4 obras |
| Preço | R$ 319,90/mês + R$ 99,90/mês/obra |
| Capacidade | A partir de 4 obras (ativas em `/precos`) |
| E-mail adicional | R$ 29,90/mês por destinatário extra (via `EMAIL_EXTRA`) |

Isso é **copy de pré-lançamento**. Não reflete o checkout atual.

---

## O que o produto cobra hoje

| Item | Estado atual no código |
| --- | --- |
| Planos fixos | `obra_1`, `obra_3`, `obra_5` em `webapp/src/config/pricing.ts` |
| Terceiro plano | “5 obras” — R$ 499,90/mês (env `NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS`) |
| Adicional por obra | **Não existe** — só há cobrança de e-mail extra |
| Checkout / AbacatePay | Produtos fixos 1, 3 e 5 obras |
| Página autenticada `/planos` | Ainda usa `PLANOS` completo (inclui `obra_5`) |

**Risco:** prometer “R$ 319,90 + R$ 99,90/obra” sem fluxo de contratação correspondente.

---

## Decisão necessária antes do deploy em produção

Escolher **uma** das opções:

### Opção A — Só páginas públicas (curto prazo)

- Manter checkout com planos 1 / 3 / 5 obras.
- Tratar “Acima de 4 obras” como **venda assistida** (contato, proposta manual, contrato fora do self-service).
- Garantir que nenhum CTA prometa contratação automática desse tier.
- Revisar resposta da FAQ “E se eu precisar de mais obras?” se o fluxo real for atendimento.

### Opção B — Nova regra comercial (produto de fato)

Abrir tarefa própria e implementar de ponta a ponta:

- [ ] Substituir ou complementar `obra_5` por plano escalável (base + por obra)
- [ ] Atualizar `webapp/src/config/pricing.ts` e `webapp/.env.example`
- [ ] Atualizar `webapp/src/config/pricing.test.ts`
- [ ] Configurar produto(s) no AbacatePay (base R$ 319,90 + uso R$ 99,90/obra, se aplicável)
- [ ] Ajustar webhook, limites de obras e gating na aplicação
- [ ] Alinhar `/precos`, `/planos` (autenticado) e fluxo de upgrade/downgrade
- [ ] Testes e2e / smoke de checkout
- [ ] Documentar regra de pró-rata, downgrade e arquivamento de obras excedentes

---

## Checklist rápido no dia de implementar a Opção B

1. Definir fórmula exata: a partir de qual obra começa o +R$ 99,90? (5ª obra? 4ª ativa?)
2. Confirmar se R$ 319,90 é sempre o piso (equivale ao plano 3 obras hoje) ou se muda com volume.
3. Mapear migração de assinantes atuais no plano “5 obras” (R$ 499,90).
4. Validar copy da landing e `/precos` contra a regra final (evitar drift texto × cobrança).
5. Rodar `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` em `webapp/`.

---

## Arquivos que provavelmente entrarão na tarefa (Opção B)

| Área | Arquivos |
| --- | --- |
| Preços | `webapp/src/config/pricing.ts`, `.env.example`, `pricing.test.ts` |
| UI pública | `webapp/src/app/(marketing)/page.tsx`, `precos/page.tsx` |
| UI autenticada | `webapp/src/app/(app)/planos/**` |
| Pagamento | scripts/bootstrap AbacatePay, webhook, rotas de checkout |
| Limites | lógica de `limite_obras`, assinaturas, arquivamento |

---

## Lembrete

> Não publicar em produção a oferta “Acima de 4 obras” com CTA de self-service até o checkout conseguir cobrar essa regra — ou até deixar explícito que a contratação é via atendimento.
