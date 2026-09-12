# Matriz de acesso e contrato de segurança

Este documento deve permanecer alinhado ao schema. Alterações de policy, RPC ou grant exigem atualização aqui.

## Papéis

| Recurso | Empreiteiro | Proprietário | Admin | Mutação permitida |
|---|---|---|---|---|
| Perfil | Próprio | Próprio | RPC operacional | Somente `nome` próprio |
| Assinatura/uso | Própria | Própria se também cliente pagante | RPC operacional | Backend/webhook |
| Obra ativa | Própria | Não lê a linha viva; usa a obra contida no snapshot | RPC operacional | RPC |
| Obra arquivada | Resumo mínimo via RPC | Nada | RPC operacional | Nada, salvo rotina futura de purga |
| Rascunho | Próprio | Nada | Nada | RPC de rascunho |
| Versão publicada | Própria; dados de edição via RPC owner-only | Compartilhada e ativa, sem `dados_aplicacao` | Metadados operacionais | Nada |
| Ledgers/etapas | Próprios | Nada direto | Nada direto | RPC de envio/retificação |
| Acessos | Da própria obra | Própria associação mínima | Metadados operacionais | RPC/outbox |
| Clima | Próprio | Somente snapshot publicado | Nada | Cron/backend |
| Webhooks/outbox | Nada | Nada | RPC operacional sanitizada | Backend |
| Fotos | Próprias, conforme estado | Apenas versão publicada | Nada | Reserva + Storage policy |
| PDF | Versão publicada própria | Versão publicada compartilhada | Nada | Backend, create-only |

## Regras

- Autorização vive no Postgres (RLS + RPC). Filtro de UI não autoriza.
- `anon` não lê tabelas do produto nem executa RPCs comerciais.
- `authenticated` não faz DML comercial; mutações passam por RPCs allowlisted.
- Relatórios publicados, versões, lançamentos, fotos e PDFs são imutáveis.
- Acesso extra nasce `pendente_cobranca` e só vira convite após confirmação inequívoca do AbacatePay.
- Outbox em `429` usa backoff; `4xx` terminal não é repetido; timeout/`5xx` fica `incerto` e exige reconciliação. Operação travada nunca chama o provedor outra vez às cegas.
- Revogação/arquivamento cancela `add` ainda não iniciado. Se o provedor já tiver confirmado, uma operação `subtract` compensatória é criada.
- O cron `/api/cron/outbox`, autenticado por `CRON_SECRET`, processa retries a cada cinco minutos.
- Rate limit autenticado é persistido em `private.rate_limits`.
- CSP em desenvolvimento/staging é Report-Only. Produção só recebe policy enforced após C3/C4 (`CSP_ENFORCE=true`).
- HSTS em produção: `max-age=31536000`, sem `preload` e sem `includeSubDomains`.
- Auth local: senha mínima 10, `lower_upper_letters_digits_symbols`, confirmação de e-mail e `secure_password_change`. Turnstile e proteção contra senha vazada no remoto ficam a cargo do Codex.
- URLs assinadas já emitidas não são revogadas neste ciclo. Backlog: proxy autenticado.

## RPCs públicas (`authenticated`)

`fn_criar_obra`, `fn_salvar_rascunho`, `fn_preparar_envio_relatorio`, `fn_preparar_retificacao`, `fn_dados_versao_atual`, `fn_atualizar_capa_obra`, `fn_reservar_foto`, `fn_remover_foto_rascunho`, `fn_solicitar_acesso_obra`, `fn_revogar_acesso_obra`, `fn_arquivar_obra`, `fn_consumir_rate_limit`, `fn_registrar_customer_id`, `fn_listar_obras_empreiteiro`, `fn_sou_admin`, `fn_admin_*`, `fn_proximos_rotulos`, `fn_avanco_geral`, `etapas_padrao`.

## RPCs somente backend

`fn_finalizar_envio_relatorio`, `fn_finalizar_retificacao`, `fn_marcar_versao_falhou`, `fn_claim_outbox`, `fn_confirmar_outbox`, `fn_falhar_outbox`, `fn_reagendar_outbox`, `fn_claim_webhook_evento`, `fn_enfileirar_renovacao_emails`, `fn_listar_outbox_pendente`, `fn_purgar_*`.
