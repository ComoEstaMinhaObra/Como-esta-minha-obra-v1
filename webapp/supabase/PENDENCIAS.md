# Pendência: finalizar o security_lockdown em produção

Status em 2026-09-11: o banco de produção (`hxlrskcnsbmmotjmxxfd`) está com as
migrations aplicadas **até `20260911220001_backfill_pdf_hash_fn_public.sql`**.
O schema novo (tabelas, colunas, RPCs do branch `codex/security-rls`) já está
no ar, mas as **RLS antigas (mais permissivas) ainda estão ativas** — o
`security_lockdown` e tudo depois dele ainda não foi aplicado.

## Por que parou aqui

`20260911220003_security_lockdown.sql` só aplica se a tabela de auditoria
`private.legado_incompativel` estiver vazia. Ela fica populada por
`security_expand.sql` com um marcador incondicional: todo `relatorio` com
`status = 'enviado'` precisa ter o SHA-256 do PDF já existente calculado e
gravado em `relatorio_versoes.pdf_sha256` (coluna nova, não existia antes).
Sem isso, o `security_lockdown` recusa aplicar de propósito (guard-rail,
não é bug).

## Como concluir

1. Preencher `SUPABASE_SECRET_KEY` real em `webapp/.env.local` (pegar em
   Project Settings → API Keys, ou `supabase projects api-keys --project-ref
   hxlrskcnsbmmotjmxxfd`).
2. Rodar:
   ```bash
   cd webapp
   npm run backfill:pdf-hash
   ```
   Isso baixa o PDF de cada relatório enviado, calcula o hash real, copia
   para o path canônico (`obraId/relatorioId/vN-hash.pdf`) e atualiza
   `relatorio_versoes`. Também reporta a contagem de outras 3 categorias de
   dados legados que o lockdown audita (acessos órfãos, atividades órfãs,
   relatórios sem snapshot, fotos com path fora do padrão) — em
   2026-09-11 todas estavam em 0.
3. Confirmar que a saída termina com `falhas: 0` e `outras pendências: 0`.
4. Aplicar o resto das migrations pendentes, nesta ordem (o `db push` normal
   já respeita a ordem, só listando aqui pra referência):
   - `20260911220002_backfill_legado_limpar.sql` (limpa os marcadores e
     remove as funções auxiliares do backfill, que não são usadas pelo app)
   - `20260911220003_security_lockdown.sql`
   - `20260911220004_security_core_fixes.sql`
   - `20260911220005_security_report_fixes.sql`
   - `20260911220006_security_billing_webhook_fixes.sql`
   ```bash
   supabase link --project-ref hxlrskcnsbmmotjmxxfd
   supabase db push --linked
   ```
5. Depois de aplicar tudo, rodar `supabase migration list --linked` e
   conferir que `Local` e `Remote` batem em todas as linhas.

## Nota sobre o config.toml local

A CLI instalada localmente (2.84.2) não reconhece a seção `[local_smtp]` do
`supabase/config.toml` atual (foi renomeada de `[inbucket]` numa versão mais
nova da CLI) — isso quebra `supabase start`/`migration list`/`db push`
rodados diretamente da raiz do projeto. Ou atualiza a CLI
(`v2.117.0`+), ou roda os comandos remotos (`--linked`) a partir de uma cópia
do `config.toml` sem essa seção.
