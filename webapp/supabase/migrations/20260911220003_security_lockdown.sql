-- Lockdown: policies mínimas, grants, triggers de imutabilidade e validação de constraints.

revoke all on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role, postgres;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;

grant all on all tables in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all tables in schema private to postgres, service_role;
grant all on all functions in schema private to postgres, service_role;
grant usage on schema private to postgres, service_role, authenticated;

drop policy if exists profiles_own_select on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
drop policy if exists assinaturas_own_select on public.assinaturas;
drop policy if exists assinatura_usos_own_select on public.assinatura_usos;
drop policy if exists obras_owner_all on public.obras;
drop policy if exists obras_proprietario_select on public.obras;
drop policy if exists obras_admin_select on public.obras;
drop policy if exists etapas_owner_all on public.etapas;
drop policy if exists etapas_proprietario_select on public.etapas;
drop policy if exists obra_acessos_owner_all on public.obra_acessos;
drop policy if exists obra_acessos_convidado_select on public.obra_acessos;
drop policy if exists relatorios_owner_all on public.relatorios;
drop policy if exists relatorios_proprietario_select on public.relatorios;
drop policy if exists relatorio_etapas_owner_all on public.relatorio_etapas;
drop policy if exists relatorio_etapas_proprietario_select on public.relatorio_etapas;
drop policy if exists lancamentos_owner_all on public.lancamentos;
drop policy if exists lancamentos_proprietario_select on public.lancamentos;
drop policy if exists atividades_owner_all on public.atividades;
drop policy if exists atividades_proprietario_select on public.atividades;
drop policy if exists fotos_owner_all on public.fotos;
drop policy if exists fotos_proprietario_select on public.fotos;
drop policy if exists dias_aditivados_owner_all on public.dias_aditivados;
drop policy if exists dias_aditivados_proprietario_select on public.dias_aditivados;
drop policy if exists clima_owner_all on public.clima_snapshots;
drop policy if exists clima_proprietario_select on public.clima_snapshots;
drop policy if exists webhooks_admin_select on public.webhooks_log;
drop policy if exists admins_admin_select on public.admins;
drop policy if exists storage_capas_owner on storage.objects;
drop policy if exists storage_capas_proprietario on storage.objects;
drop policy if exists storage_fotos_owner on storage.objects;
drop policy if exists storage_fotos_proprietario on storage.objects;
drop policy if exists storage_pdfs_owner on storage.objects;
drop policy if exists storage_pdfs_proprietario on storage.objects;
drop policy if exists security_expand_versoes_empreiteiro_select on public.relatorio_versoes;
drop policy if exists security_expand_versoes_proprietario_select on public.relatorio_versoes;

alter table public.relatorio_versoes enable row level security;
alter table public.avanco_ajustes enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());
create policy profiles_update_nome on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy assinaturas_select on public.assinaturas
  for select to authenticated
  using (user_id = auth.uid());

create policy assinatura_usos_select on public.assinatura_usos
  for select to authenticated
  using (
    exists (
      select 1 from public.assinaturas s
      where s.id = assinatura_usos.assinatura_id and s.user_id = auth.uid()
    )
  );

create policy obras_empreiteiro_select on public.obras
  for select to authenticated
  using (owner_id = auth.uid() and arquivada_em is null);

create policy etapas_empreiteiro_select on public.etapas
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy acessos_empreiteiro_select on public.obra_acessos
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy acessos_proprio_select on public.obra_acessos
  for select to authenticated
  using (user_id = auth.uid() and status = 'ativo');

create policy relatorios_empreiteiro_select on public.relatorios
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy relatorios_proprietario_select on public.relatorios
  for select to authenticated
  using (private.tem_acesso_obra_ativa(obra_id) and status = 'enviado');

create policy versoes_empreiteiro_select on public.relatorio_versoes
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy versoes_proprietario_select on public.relatorio_versoes
  for select to authenticated
  using (private.tem_acesso_obra_ativa(obra_id) and status = 'publicada');

create policy relatorio_etapas_empreiteiro_select on public.relatorio_etapas
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy lancamentos_empreiteiro_select on public.lancamentos
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy atividades_empreiteiro_select on public.atividades
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy fotos_empreiteiro_select on public.fotos
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy fotos_proprietario_select on public.fotos
  for select to authenticated
  using (
    private.tem_acesso_obra_ativa(obra_id)
    and estado = 'publicada'
    and exists (
      select 1 from public.relatorio_versoes v
      where v.id = fotos.versao_id and v.status = 'publicada'
    )
  );

create policy dias_empreiteiro_select on public.dias_aditivados
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy clima_empreiteiro_select on public.clima_snapshots
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy avanco_ajustes_empreiteiro_select on public.avanco_ajustes
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

-- ===== grants de tabela =====
grant select on public.profiles to authenticated;
grant update (nome) on public.profiles to authenticated;
grant select on public.assinaturas to authenticated;
grant select on public.assinatura_usos to authenticated;
grant select on public.obras to authenticated;
grant select on public.etapas to authenticated;
grant select on public.obra_acessos to authenticated;
grant select on public.relatorios to authenticated;
grant select (
  id, relatorio_id, obra_id, numero, tipo, status, snapshot, motivo,
  criado_por, criado_em, publicado_em, pdf_path, pdf_sha256
) on public.relatorio_versoes to authenticated;
grant select on public.relatorio_etapas to authenticated;
grant select on public.lancamentos to authenticated;
grant select on public.atividades to authenticated;
grant select on public.fotos to authenticated;
grant select on public.dias_aditivados to authenticated;
grant select on public.clima_snapshots to authenticated;
grant select on public.avanco_ajustes to authenticated;

-- ===== RPCs allowlisted =====
grant execute on function public.fn_criar_obra to authenticated;
grant execute on function public.fn_salvar_rascunho to authenticated;
grant execute on function public.fn_preparar_envio_relatorio to authenticated;
grant execute on function public.fn_preparar_retificacao to authenticated;
grant execute on function public.fn_atualizar_capa_obra to authenticated;
grant execute on function public.fn_reservar_foto to authenticated;
grant execute on function public.fn_remover_foto_rascunho to authenticated;
grant execute on function public.fn_solicitar_acesso_obra to authenticated;
grant execute on function public.fn_revogar_acesso_obra to authenticated;
grant execute on function public.fn_arquivar_obra to authenticated;
grant execute on function public.fn_consumir_rate_limit to authenticated;
grant execute on function public.fn_listar_obras_empreiteiro to authenticated;
grant execute on function public.fn_sou_admin to authenticated;
grant execute on function public.fn_admin_kpis to authenticated;
grant execute on function public.fn_admin_contas to authenticated;
grant execute on function public.fn_admin_obras to authenticated;
grant execute on function public.fn_admin_webhooks to authenticated;
grant execute on function public.fn_admin_reprocessar_webhook to authenticated;
grant execute on function public.fn_proximos_rotulos to authenticated;
grant execute on function public.fn_avanco_geral to authenticated;
grant execute on function public.etapas_padrao to authenticated;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.eh_dono_obra_ativa(uuid) to authenticated;
grant execute on function private.eh_dono_obra(uuid) to authenticated;
grant execute on function private.tem_acesso_obra_ativa(uuid) to authenticated;

-- ===== storage =====
create policy storage_capas_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'capas'
    and name = ((storage.foldername(name))[1] || '/capa.webp')
    and private.eh_dono_obra_ativa(((storage.foldername(name))[1])::uuid)
  );

create policy storage_capas_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'capas'
    and name = ((storage.foldername(name))[1] || '/capa.webp')
    and private.eh_dono_obra_ativa(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'capas'
    and name = ((storage.foldername(name))[1] || '/capa.webp')
    and private.eh_dono_obra_ativa(((storage.foldername(name))[1])::uuid)
  );

create policy storage_capas_select_empreiteiro on storage.objects
  for select to authenticated
  using (
    bucket_id = 'capas'
    and private.eh_dono_obra_ativa(((storage.foldername(name))[1])::uuid)
  );

create policy storage_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.fotos f
      join public.relatorios r on r.id = f.relatorio_id
      where f.storage_path = name
        and f.estado = 'reservada'
        and r.status in ('rascunho', 'processando')
        and private.eh_dono_obra_ativa(f.obra_id)
    )
  );

create policy storage_fotos_select_empreiteiro on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.fotos f
      where f.storage_path = name
        and private.eh_dono_obra_ativa(f.obra_id)
    )
  );

create policy storage_fotos_select_proprietario on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.fotos f
      join public.relatorio_versoes v on v.id = f.versao_id
      where f.storage_path = name
        and f.estado = 'publicada'
        and v.status = 'publicada'
        and private.tem_acesso_obra_ativa(f.obra_id)
    )
  );

create policy storage_fotos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.fotos f
      where f.storage_path = name
        and f.estado = 'reservada'
        and f.versao_id is null
        and private.eh_dono_obra_ativa(f.obra_id)
    )
  );

create policy storage_pdfs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (
      select 1 from public.relatorio_versoes v
      where v.pdf_path = name
        and v.status = 'publicada'
        and (
          private.eh_dono_obra_ativa(v.obra_id)
          or private.tem_acesso_obra_ativa(v.obra_id)
        )
    )
  );

-- ===== triggers de imutabilidade =====
create or replace function private.impedir_mutacao_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.versao_id is not null and exists (
      select 1 from public.relatorio_versoes v
      where v.id = old.versao_id and v.status = 'publicada'
    ) then
      raise exception 'IMUTAVEL';
    end if;
    return old;
  end if;
  if old.versao_id is not null and exists (
    select 1 from public.relatorio_versoes v
    where v.id = old.versao_id and v.status = 'publicada'
  ) then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create trigger trg_lancamentos_imutavel
  before update or delete on public.lancamentos
  for each row execute function private.impedir_mutacao_publicada();

create trigger trg_atividades_imutavel
  before update or delete on public.atividades
  for each row execute function private.impedir_mutacao_publicada();

create trigger trg_dias_imutavel
  before update or delete on public.dias_aditivados
  for each row execute function private.impedir_mutacao_publicada();

create trigger trg_relatorio_etapas_imutavel
  before update or delete on public.relatorio_etapas
  for each row execute function private.impedir_mutacao_publicada();

create trigger trg_avanco_ajustes_imutavel
  before update or delete on public.avanco_ajustes
  for each row execute function private.impedir_mutacao_publicada();

create or replace function private.impedir_foto_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'publicada' then
      raise exception 'IMUTAVEL';
    end if;
    return old;
  end if;
  if old.estado = 'publicada' then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create trigger trg_fotos_imutavel
  before update or delete on public.fotos
  for each row execute function private.impedir_foto_publicada();

create or replace function private.impedir_versao_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMUTAVEL';
  end if;
  if old.status = 'publicada' then
    raise exception 'IMUTAVEL';
  end if;
  if old.status = 'processando' and new.status = 'publicada' then
    if new.pdf_path is null or new.pdf_sha256 is null then
      raise exception 'PDF_OBRIGATORIO';
    end if;
    return new;
  end if;
  if old.status = 'processando' and new.status = 'falhou' then
    return new;
  end if;
  if old.status = 'processando' then
    return new;
  end if;
  raise exception 'IMUTAVEL';
end;
$$;

create trigger trg_versoes_imutavel
  before update or delete on public.relatorio_versoes
  for each row execute function private.impedir_versao_publicada();

create or replace function private.proteger_relatorio_publicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('enviado', 'processando') then
      raise exception 'IMUTAVEL';
    end if;
    return old;
  end if;
  if old.status = 'enviado' then
    if new.versao_atual_id is distinct from old.versao_atual_id
       or new.versao_pendente_id is distinct from old.versao_pendente_id
       or new.snapshot is distinct from old.snapshot
       or new.pdf_path is distinct from old.pdf_path
       or new.geral_antes is distinct from old.geral_antes
       or new.geral_depois is distinct from old.geral_depois
       or new.erro_operacional is distinct from old.erro_operacional then
      if exists (
        select 1 from public.relatorio_versoes v
        where v.relatorio_id = old.id
          and v.status = 'processando'
          and v.tipo = 'retificacao'
      ) or new.versao_pendente_id is null then
        return new;
      end if;
    end if;
    if new.status is distinct from old.status
       or new.dados_rascunho is distinct from old.dados_rascunho
       or new.numero is distinct from old.numero
       or new.obra_id is distinct from old.obra_id then
      raise exception 'IMUTAVEL';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_relatorios_protegido
  before update or delete on public.relatorios
  for each row execute function private.proteger_relatorio_publicado();

create or replace function private.proteger_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMUTAVEL';
  end if;
  if old.status = 'confirmado' and new.status is distinct from old.status then
    raise exception 'IMUTAVEL';
  end if;
  if old.status = 'incerto' and new.status not in ('incerto', 'confirmado') then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create trigger trg_outbox_protegido
  before update or delete on private.billing_outbox
  for each row execute function private.proteger_outbox();

-- ===== validar constraints se o backfill não encontrou legado =====
do $$
begin
  if exists (select 1 from private.legado_incompativel) then
    raise exception 'LEGADO_INCOMPATIVEL_LOCKDOWN';
  end if;

  alter table public.relatorio_versoes validate constraint relatorio_versoes_relatorio_obra_fk;
  alter table public.relatorios validate constraint relatorios_versao_atual_fk;
  alter table public.relatorios validate constraint relatorios_versao_pendente_fk;
  alter table public.obra_acessos validate constraint obra_acessos_obra_owner_fk;
  alter table public.lancamentos validate constraint lancamentos_relatorio_obra_fk;
  alter table public.lancamentos validate constraint lancamentos_versao_obra_fk;
  alter table public.atividades validate constraint atividades_relatorio_obra_fk;
  alter table public.atividades validate constraint atividades_etapa_obra_fk;
  alter table public.atividades validate constraint atividades_versao_obra_fk;
  alter table public.fotos validate constraint fotos_relatorio_obra_fk;
  alter table public.fotos validate constraint fotos_etapa_obra_fk;
  alter table public.fotos validate constraint fotos_versao_obra_fk;
  alter table public.fotos validate constraint fotos_atividade_obra_fk;
  alter table public.fotos validate constraint fotos_storage_path_ids_chk;
  alter table public.dias_aditivados validate constraint dias_aditivados_relatorio_obra_fk;
  alter table public.dias_aditivados validate constraint dias_aditivados_versao_obra_fk;
  alter table public.relatorio_etapas validate constraint relatorio_etapas_relatorio_obra_fk;
  alter table public.relatorio_etapas validate constraint relatorio_etapas_etapa_obra_fk;
  alter table public.relatorio_etapas validate constraint relatorio_etapas_versao_obra_fk;
  alter table public.avanco_ajustes validate constraint avanco_ajustes_relatorio_obra_fk;
  alter table public.avanco_ajustes validate constraint avanco_ajustes_versao_obra_fk;
  alter table public.avanco_ajustes validate constraint avanco_ajustes_etapa_obra_fk;
end $$;
