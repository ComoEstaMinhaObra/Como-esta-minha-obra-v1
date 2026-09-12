-- Corrige 20260905215435_backfill_pdf_hash_fn.sql: as funções auxiliares do
-- backfill foram criadas em private.*, mas o PostgREST (usado por
-- admin.rpc(...) em scripts/backfill-pdf-hash.ts) só expõe o schema public
-- (ver supabase/config.toml [api].schemas). Recria as mesmas funções em
-- public, com os mesmos revokes/grants restritos a service_role.

drop function if exists private.fn_listar_versoes_sem_pdf_hash();
drop function if exists private.fn_backfill_pdf_versao(uuid, text, text);

create or replace function public.fn_listar_versoes_sem_pdf_hash()
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

revoke all on function public.fn_listar_versoes_sem_pdf_hash() from public, anon, authenticated;
grant execute on function public.fn_listar_versoes_sem_pdf_hash() to service_role;

create or replace function public.fn_backfill_pdf_versao(
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

revoke all on function public.fn_backfill_pdf_versao(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_backfill_pdf_versao(uuid, text, text) to service_role;
