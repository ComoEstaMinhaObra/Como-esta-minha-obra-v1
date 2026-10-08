-- Lista mínima do perfil do proprietário. A linha viva da obra continua protegida:
-- somente o nome é usado como fallback antes do primeiro relatório; os demais
-- dados exibidos vêm da versão publicada apontada pelo relatório vigente.

create or replace function public.fn_listar_obras_proprietario()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'nome', coalesce(nullif(pub.snapshot #>> '{obra,nome}', ''), o.nome),
        'endereco', nullif(pub.snapshot #>> '{obra,endereco}', ''),
        'avanco', case
          when pg_catalog.jsonb_typeof(pub.snapshot #> '{avancoFisico,geralDepois}') = 'number'
            then least(
              100,
              greatest(
                0,
                pg_catalog.round((pub.snapshot #>> '{avancoFisico,geralDepois}')::numeric)::int
              )
            )
          else null
        end,
        'inicioContratual', nullif(pub.snapshot #>> '{obra,inicioContratual}', ''),
        'entregaPrevista', nullif(pub.snapshot #>> '{prazo,novaDataTermino}', ''),
        'ultimoRelatorioNumero', pub.numero,
        'ultimoRelatorioEm', pub.enviado_em,
        'temRelatorioPublicado', pub.versao_id is not null
      )
      order by coalesce(pub.publicado_em, a.criado_em) desc, o.id
    )
    from public.obra_acessos a
    join public.obras o
      on o.id = a.obra_id
     and o.owner_id = a.owner_id
    left join lateral (
      select
        r.numero,
        r.enviado_em,
        v.id as versao_id,
        v.publicado_em,
        v.snapshot
      from public.relatorios r
      join public.relatorio_versoes v
        on v.id = r.versao_atual_id
       and v.relatorio_id = r.id
       and v.obra_id = r.obra_id
      where r.obra_id = o.id
        and r.status = 'enviado'
        and v.status = 'publicada'
        and v.snapshot is not null
      order by r.numero desc
      limit 1
    ) pub on true
    where a.user_id = v_user
      and a.status = 'ativo'
      and o.arquivada_em is null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_listar_obras_proprietario() from public, anon, authenticated;
grant execute on function public.fn_listar_obras_proprietario() to authenticated;
