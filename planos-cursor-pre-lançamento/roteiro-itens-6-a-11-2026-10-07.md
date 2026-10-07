# Roteiro dos itens 6 a 11 do pré-lançamento

**Data:** 07/10/2026. Tudo abaixo está no código e testado no banco local; **nada foi aplicado na produção** (`hxlrskcnsbmmotjmxxfd`).

## O que mudou

| Item | O quê | Onde |
|---|---|---|
| 6 | E-mail adicional passa a ser lançado (`record-usage`) na assinatura **da obra**, e não na da conta. Cobre convite, revogação, arquivamento e **renovação mensal** (a cada `subscription.renewed`). Aviso de custo no modal Compartilhar a partir do 2º e-mail. | `migrations/20261007120001_email_adicional_por_obra.sql`, `src/lib/abacatepay-webhook.ts`, `ModalCompartilhar.tsx` |
| 7 | Geocoder tenta o endereço normalizado (`Av.` vira `Avenida`, `Cidade - UF` vira `Cidade, UF, Brasil`), depois o original e por fim só a cidade. Obras sem coordenadas ganham nova tentativa no cron diário (3 por execução). Aviso ao criar a obra quando o endereço não é achado. | `src/lib/clima/geocode.ts`, `src/app/api/cron/clima/route.ts`, `FormNovaObra.tsx` |
| 8 | Botão **Regularizar pagamento** na obra inadimplente: encerra a assinatura que falhou (intenção gravada antes de chamar o provedor) e abre novo checkout. Se o provedor falhar, nada muda; se o checkout for abandonado, a obra fica somente leitura e aparece "Reativar". | `migrations/20261007120002_cobranca_regularizar.sql`, `cobranca/actions.ts`, `CobrancaCliente.tsx` |
| 9 | E5: remove `assinaturas.plano`, `limite_obras`, o enum `plano_tipo`, `private.assinatura_permite_escrita` e os ramos "conta ativa do legado". Admin sem a coluna "plano" (agora obras pagas e com pagamento pendente). | `migrations/20261007120003_remover_plano_legado.sql`, `gating.ts`, `estado.ts`, páginas de admin |

Verificação feita: `tsc`, `eslint`, `next build`, 115 testes Vitest, 20 testes de segurança diretos contra o Supabase local e os pgTAP (`email-adicional` 23, `cobranca-regularizar` 16, `remocao-plano` 7, mais os existentes). Verificado no dev mode do AbacatePay: `record-usage` do produto de e-mail numa assinatura de obra devolve `unitPrice` 2990 e `installmentNumber` 2.

## Ordem para aplicar

1. **Antes de tudo, conferir contas do modelo antigo** (a E5 as deixa somente leitura até contratarem a obra). No SQL Editor:

   ```sql
   select status, plano, limite_obras, count(*)
   from public.assinaturas
   group by 1, 2, 3
   order by 4 desc;
   ```

   Esperado: só `trial`/`trial`/`1`, mais as suas contas de teste. Qualquer outra linha é conta do modelo antigo.
2. `supabase db push` com **`20261007120001`** e **`20261007120002`** (só criam/substituem funções; compatíveis com o código atual).
3. Deploy do código na Vercel (push para `main`).
4. Depois de conferir `/cobranca`, `/admin/contas` e criar uma obra no ar: `supabase db push` com **`20261007120003`** (a que remove colunas; não tem volta sem restaurar backup). Antes, vale um backup/PITR do projeto.

Rodar sempre com `env -u CLAUDECODE -u AI_AGENT` (ver memória do projeto). A `config.toml` tem a chave `local_smtp`, que o CLI 2.84 não reconhece; atualizar o CLI (`brew upgrade supabase`) resolve.

## Item 10: promover o admin

Depois do primeiro login do responsável, no SQL Editor:

```sql
select id from auth.users where email = 'SEU_EMAIL';

insert into public.admins (user_id)
values ('UUID_DO_SELECT_ACIMA')
on conflict do nothing;
```

Conferir em `/admin`: MRR por obra, inadimplentes, alerta de cancelamento sem pedido, e em `/admin/contas` as colunas novas (Obras, Pagas, Pgto. pendente).

## Item 11: observação de 15/10/2026

A assinatura de teste com `trialDays` (obra "Em trial até 15/10/2026") faz a primeira cobrança nessa data. Conferir no dia (ou no dia seguinte):

1. `webhooks_log`: chegou `subscription.renewed` (ou `completed`) para essa assinatura? Guardar o payload sanitizado.
2. `cobrancas_obra`: `status = 'ativa'`, `periodo_inicio` e `periodo_fim` coerentes com a data (fim = início + 1 mês) e `primeira_cobranca_em` já no passado.
3. Painel do AbacatePay (dev mode): a parcela 1 foi cobrada em R$ 129,90.
4. Se o payload trouxer algo diferente do assumido (por exemplo `renewed` sem `completed`), ajustar `processarCobrancaObra` e registrar em `plano-tela-assinatura-2026-10-01.md`.

Com ele também dá para observar, de graça, o efeito do adicional: um e-mail extra liberado antes da renovação deve aparecer como `renew:<evento>:<acesso>` em `private.billing_outbox` e como uso na parcela seguinte.

## Ainda aberto (não faz parte dos itens 6 a 11)

- Quem cancelou todas as obras e está fora do trial não consegue **criar obra nova** (`TRIAL_EXPIRADO`), só reativar as existentes. Decidir se isso é a regra desejada.
- Aceite de convite, histórico financeiro completo no perfil, popup de compra ao criar obra.
- Efeito do `record-usage` pendente quando a assinatura da obra é cancelada (pergunta aberta desde o plano de 28/09).
