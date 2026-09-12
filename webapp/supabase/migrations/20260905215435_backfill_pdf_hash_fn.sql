-- CORRIGIDO por 20260911220001_backfill_pdf_hash_fn_public.sql: estas
-- funções em private.* são inacessíveis via PostgREST (só public é exposto),
-- então admin.rpc(...) nunca as encontra. Arquivo mantido como está porque
-- já foi aplicado em produção; não edite o efeito aqui, use a migration
-- corretiva.
--
-- Funções auxiliares temporárias para o backfill de pdf_sha256
-- (scripts/backfill-pdf-hash.ts). relatorio_versoes não concede acesso
-- direto de tabela nem para service_role (só via RPCs security definer),
-- então o script precisa dessas duas funções para ler e gravar.
--
-- Podem ser removidas depois que o backfill for concluído em todos os
-- ambientes (não são usadas pelo app).

create or replace function private.fn_listar_versoes_sem_pdf_hash()
returns table (
  id uuid,
  relatorio_id uuid,
  obra_id uuid,
  numero int,
  pdf_path text
)
language sql
security definer
set search_path = ''
as $$
  select id, relatorio_id, obra_id, numero, pdf_path
  from public.relatorio_versoes
  where pdf_sha256 is null
    and pdf_path is not null;
$$;

revoke all on function private.fn_listar_versoes_sem_pdf_hash() from public, anon, authenticated;
grant execute on function private.fn_listar_versoes_sem_pdf_hash() to service_role;

create or replace function private.fn_backfill_pdf_versao(
  p_versao_id uuid,
  p_pdf_path text,
  p_sha256 text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.relatorio_versoes
  set pdf_path = p_pdf_path,
      pdf_sha256 = p_sha256
  where id = p_versao_id
    and pdf_sha256 is null;
$$;

revoke all on function private.fn_backfill_pdf_versao(uuid, text, text) from public, anon, authenticated;
grant execute on function private.fn_backfill_pdf_versao(uuid, text, text) to service_role;
