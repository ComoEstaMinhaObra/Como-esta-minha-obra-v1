-- Limpa os marcadores de dados legados registrados por security_expand.sql
-- depois que o backfill de pdf_sha256 (scripts/backfill-pdf-hash.ts) resolveu
-- as pendências. Só rode este arquivo depois de confirmar, pela saída do
-- script, que "falhas: 0" e "outras pendências: 0".
--
-- Não é um TRUNCATE cego: cada delete corresponde a uma categoria que o
-- backfill efetivamente corrige. Se restar alguma categoria pendente na
-- próxima tentativa de push do security_lockdown, ela vai continuar
-- bloqueando (propositalmente).

delete from private.legado_incompativel
where tipo = 'relatorio_enviado_sem_pdf_hash';

-- As funções auxiliares do backfill não são usadas pelo app; removidas
-- depois de cumprirem seu papel.
drop function if exists public.fn_listar_versoes_sem_pdf_hash();
drop function if exists public.fn_backfill_pdf_versao(uuid, text, text);
