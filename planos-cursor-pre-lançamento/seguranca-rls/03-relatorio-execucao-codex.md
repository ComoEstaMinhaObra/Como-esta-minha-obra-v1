# Relatório de execução do runbook Codex

**Atualizado em:** 07/09/2026  
**Branch:** `codex/security-rls`  
**HEAD:** `6702140`  
**Estado:** C1 local concluído; C0 remoto continua incompleto; nenhuma escrita remota executada

## Resumo executivo

A entrega U1 foi revisada, corrigida e validada de forma independente em uma instalação local limpa. Foram acrescentadas correções para fechamento de privilégios, integridade entre obras, publicação de PDF em duas fases, retificação por deltas, outbox de cobrança, reprocessamento de webhooks, portal do proprietário baseado em snapshot, CSP e estabilidade dos testes.

As migrations originais `0001`–`0003` permanecem intactas. Não houve commit, push, `supabase link`, `db push`, deploy, criação de staging, alteração no Supabase remoto nem acesso a dados de produção.

## Correções adicionais do C1

- bloqueio de leitura de `dados_aplicacao` das versões por clientes convidados;
- validação de objeto PDF real no Storage, MIME, tamanho, caminho e SHA-256 antes da publicação;
- reuso idempotente de versão que falhou, sem criar versões duplicadas em retry;
- retificação do último relatório por deltas, preservando a versão e os dados publicados anteriores;
- cancelamento e compensação de outbox quando acesso ou obra deixam de ser elegíveis;
- separação entre falha terminal, `429`, falha transitória e resultado incerto do provedor;
- lease e reprocessamento explícito de webhook, inclusive reconciliação administrativa;
- remoção da server action que aceitava `userId` para registrar customer externo;
- portal convidado sem leitura da linha viva da obra e sem acesso à capa privada;
- nonce propagado pelo Next.js e CSP inicialmente em Report-Only;
- cron de outbox, sanitização de logs e testes que falham quando o ambiente Supabase está ausente;
- neutralização da RPC monolítica legada `fn_enviar_relatorio`, inclusive para `service_role`.

## Verificação final local

| Gate | Resultado |
|---|---|
| Reconstrução Supabase desde zero | 9 migrations + seed aplicados |
| Migrations local × banco reconstruído | alinhadas |
| `supabase db lint` | sem erro; apenas aviso esperado de parâmetro não usado na RPC legada desativada |
| pgTAP | 37 testes aprovados |
| JWT/PostgREST/Storage | 16 testes aprovados |
| Playwright | 8 testes aprovados |
| Unitários | 35 testes aprovados |
| TypeScript | aprovado |
| ESLint | aprovado |
| Build de produção | aprovado com Next.js 15.5.25 |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades |
| `git diff --check` | limpo |

Auditoria direta do catálogo reconstruído:

- zero policies `FOR ALL` em `public`/`storage`;
- zero funções `SECURITY DEFINER` de `public`/`private` com `search_path` diferente de vazio;
- zero DML de tabelas do produto concedido a `anon`;
- RPC legada de envio sem `EXECUTE` para `anon`, `authenticated` ou `service_role`.

## Estado dos gates

| Gate | Estado | Observação |
|---|---|---|
| C0 | **Incompleto** | O último inventário encontrou a produção pausada; catálogo, Auth, Storage, drift, dados incompatíveis por contagem e backup recuperável ainda precisam ser confirmados remotamente. |
| U1 | **Concluído localmente** | Implementação e correções presentes no working tree, ainda sem commit. |
| C1 | **Concluído** | Revisão, reconstrução limpa, catálogo e suítes locais aprovados. |
| C2–C3 | **Não iniciados** | Dependem da conclusão de C0; a opção planejada é um segundo projeto Free com seed exclusivamente sintético. |
| U2 | **Incorporado localmente** | Falhas encontradas no C1 foram corrigidas no mesmo working tree. |
| C4 | **Não iniciado** | Exige validação no ambiente remoto isolado. |
| H1 | **Não solicitado** | Produção não pode ser autorizada antes de C4. |
| C5–C7 | **Não iniciados** | Nenhuma alteração de produção foi feita. |

## Bloqueios antes de produção

1. Obter autorização específica para reativar o projeto de produção, caso continue pausado, e concluir o inventário C0 somente leitura.
2. Confirmar backup recuperável, migrations remotas e drift.
3. Medir somente por contagem os legados incompatíveis. Relatórios enviados antigos sem hash real do PDF precisam de correção operacional antes do lockdown; a migration falha de forma fechada enquanto houver pendências.
4. Criar o staging gratuito isolado, aplicar migrations, configurar Auth/Storage/Turnstile de teste e executar C3.
5. Emitir C4 e obter autorização humana explícita H1 antes de qualquer rollout.

## Riscos residuais registrados

- URLs assinadas já emitidas não são revogadas neste ciclo; o backlog permanece sendo um proxy autenticado com cache privado.
- CSP permanece em Report-Only até validação no preview e ativação controlada com `CSP_ENFORCE=true`.
- Proteção contra senhas vazadas depende da disponibilidade no plano remoto.
- Purga de webhooks e rate limits possui RPC, mas o agendamento remoto ainda depende do rollout operacional.

## Preservação e higiene

- landing, preços e `logo-CEMO.png` preexistentes não foram alterados por esta revisão;
- nenhum segredo, connection string, URL assinada ou payload real foi registrado;
- nenhum tenant real foi consultado;
- nenhum dado remoto foi criado, alterado, sanitizado ou apagado.
