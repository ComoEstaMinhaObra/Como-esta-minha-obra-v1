-- Correções do gate U1: autorização, integridade e máquinas de estado.

create unique index if not exists assinatura_usos_usage_id_uidx
  on public.assinatura_usos (abacatepay_usage_id)
  where abacatepay_usage_id is not null;

alter table public.webhooks_log
  add column if not exists claim_em timestamptz,
  add column if not exists tentativas int not null default 0;

alter table public.atividades
  alter column obra_id set not null,
  alter column versao_id set not null;

alter table public.fotos
  add constraint fotos_estado_versao_chk check (
    (estado = 'reservada' and versao_id is null and atividade_id is null)
    or (estado = 'publicada' and versao_id is not null and atividade_id is not null)
  ) not valid;

alter table public.fotos validate constraint fotos_estado_versao_chk;

create or replace function public.fn_avanco_geral(p_obra uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultado int;
begin
  if not private.eh_dono_obra_ativa(p_obra) and not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  select coalesce(
    round(sum(e.peso * e.pct_atual) / nullif(sum(e.peso), 0))::int,
    0
  )
  into v_resultado
  from public.etapas e
  where e.obra_id = p_obra;

  return v_resultado;
end;
$$;

create or replace function private.validar_objeto_pdf(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obj storage.objects%rowtype;
  v_mime text;
  v_size bigint;
begin
  select * into v_obj
  from storage.objects o
  where o.bucket_id = 'pdfs' and o.name = p_path;

  if not found then
    raise exception 'PDF_AUSENTE';
  end if;

  v_mime := lower(coalesce(v_obj.metadata->>'mimetype', ''));
  v_size := coalesce(
    nullif(v_obj.metadata->>'size', '')::bigint,
    nullif(v_obj.metadata->>'contentLength', '')::bigint,
    0
  );

  if v_mime <> 'application/pdf' then
    raise exception 'PDF_MIME_INVALIDO';
  end if;
  if v_size <= 0 or v_size > 10485760 then
    raise exception 'PDF_TAMANHO_INVALIDO';
  end if;
end;
$$;

create or replace function private.validar_rascunho(
  p_obra uuid,
  p_relatorio uuid,
  p_rascunho jsonb,
  p_exigir_reservas boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_path text;
  v_count int;
  v_fotos int;
  v_rel public.relatorios%rowtype;
begin
  if p_rascunho is null
     or coalesce((p_rascunho->>'versao')::int, 0) <> 1
     or jsonb_typeof(p_rascunho->'etapas') is distinct from 'array'
     or jsonb_typeof(p_rascunho->'financeiro') is distinct from 'object'
     or jsonb_typeof(p_rascunho->'atividades') is distinct from 'array'
     or jsonb_typeof(p_rascunho->'prazo') is distinct from 'array' then
    raise exception 'RASCUNHO_INVALIDO';
  end if;

  select * into v_rel
  from public.relatorios r
  where r.id = p_relatorio and r.obra_id = p_obra;

  select count(*) into v_count
  from jsonb_array_elements(p_rascunho->'etapas') x;
  if v_count <> (select count(*) from public.etapas e where e.obra_id = p_obra)
     or v_count <> (
       select count(distinct (x.item->>'etapaId'))
       from jsonb_array_elements(p_rascunho->'etapas') x(item)
     ) then
    raise exception 'ETAPAS_INCOMPLETAS';
  end if;

  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    perform 1 from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;
    if (v_item->>'pct')::int not between 0 and 100 then
      raise exception 'PCT_INVALIDO';
    end if;
  end loop;

  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)
    )
  loop
    if coalesce((v_item->>'valorCentavos')::bigint, -1) < 0 then
      raise exception 'VALOR_INVALIDO';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_rascunho->'prazo') loop
    if coalesce((v_item->>'dias')::int, 0) <= 0 then
      raise exception 'DIAS_INVALIDOS';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_rascunho->'atividades') loop
    perform 1 from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;

    v_fotos := jsonb_array_length(coalesce(v_item->'fotosPaths', '[]'::jsonb));
    if v_fotos > 12 then
      raise exception 'LIMITE_FOTOS';
    end if;

    if p_exigir_reservas then
      for v_path in
        select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb))
      loop
        select count(*) into v_count
        from public.fotos f
        where f.storage_path = v_path
          and f.obra_id = p_obra
          and f.relatorio_id = p_relatorio
          and f.etapa_id = (v_item->>'etapaId')::uuid
          and (
            (f.estado = 'reservada' and f.versao_id is null)
            or (
              v_rel.versao_atual_id is not null
              and f.estado = 'publicada'
              and exists (
                select 1
                from public.relatorio_versoes fv
                where fv.id = f.versao_id
                  and fv.relatorio_id = p_relatorio
                  and fv.status = 'publicada'
              )
            )
          )
          and exists (
            select 1 from storage.objects so
            where so.bucket_id = 'fotos'
              and so.name = f.storage_path
              and lower(coalesce(so.metadata->>'mimetype', '')) = 'image/webp'
          );
        if v_count <> 1 then
          raise exception 'FOTO_SEM_RESERVA';
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

create or replace function public.fn_atualizar_capa_obra(p_obra uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if p_path is distinct from (p_obra::text || '/capa.webp') then
    raise exception 'PATH_INVALIDO';
  end if;
  if not private.eh_dono_obra_ativa(p_obra) then
    raise exception 'SEM_PERMISSAO';
  end if;
  update public.obras set foto_capa_path = p_path where id = p_obra;
end;
$$;

create or replace function public.fn_reservar_foto(
  p_obra uuid,
  p_relatorio uuid,
  p_etapa uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_count int;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if not private.eh_dono_obra_ativa(p_obra) then
    raise exception 'SEM_PERMISSAO';
  end if;

  select * into v_rel
  from public.relatorios r
  where r.id = p_relatorio
  for update;
  if not found or v_rel.obra_id <> p_obra
     or v_rel.status not in ('rascunho', 'enviado') then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if v_rel.status = 'enviado' and exists (
    select 1 from public.relatorios r
    where r.obra_id = p_obra and r.status = 'enviado' and r.numero > v_rel.numero
  ) then
    raise exception 'NAO_E_ULTIMO';
  end if;
  if not exists (
    select 1 from public.etapas e where e.id = p_etapa and e.obra_id = p_obra
  ) then
    raise exception 'ETAPA_INVALIDA';
  end if;

  select count(*) into v_count
  from public.fotos f
  where f.relatorio_id = p_relatorio
    and f.etapa_id = p_etapa
    and f.estado = 'reservada'
    and f.versao_id is null;
  if v_count >= 12 then
    raise exception 'LIMITE_FOTOS';
  end if;

  v_path := p_obra::text || '/' || p_relatorio::text || '/rascunho/'
    || p_etapa::text || '/' || v_id::text || '.webp';
  insert into public.fotos (
    obra_id, relatorio_id, etapa_id, storage_path, ordem, estado
  ) values (
    p_obra, p_relatorio, p_etapa, v_path, v_count + 1, 'reservada'
  );

  return jsonb_build_object('storagePath', v_path);
end;
$$;

create or replace function public.fn_registrar_customer_id(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if p_customer_id is null or length(btrim(p_customer_id)) = 0 then
    raise exception 'CUSTOMER_INVALIDO';
  end if;

  update public.assinaturas s
  set abacatepay_customer_id = btrim(p_customer_id),
      atualizado_em = pg_catalog.now()
  where s.user_id = v_user
    and (
      s.abacatepay_customer_id is null
      or s.abacatepay_customer_id = btrim(p_customer_id)
    );

  if not found then
    raise exception 'CUSTOMER_CONFLITANTE';
  end if;
end;
$$;

create or replace function private.impedir_versao_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status = 'publicada' then
    raise exception 'IMUTAVEL';
  end if;

  if old.status = 'processando' and new.status = 'publicada' then
    if new.pdf_path is null or new.pdf_sha256 is null
       or new.publicado_em is null then
      raise exception 'PDF_OBRIGATORIO';
    end if;
    if row(
      new.id, new.relatorio_id, new.obra_id, new.numero, new.tipo,
      new.snapshot, new.dados_aplicacao, new.motivo, new.criado_por,
      new.criado_em
    ) is distinct from row(
      old.id, old.relatorio_id, old.obra_id, old.numero, old.tipo,
      old.snapshot, old.dados_aplicacao, old.motivo, old.criado_por,
      old.criado_em
    ) then
      raise exception 'IMUTAVEL';
    end if;
    return new;
  end if;

  if old.status = 'processando' and new.status = 'falhou' then
    if row(
      new.id, new.relatorio_id, new.obra_id, new.numero, new.tipo,
      new.snapshot, new.dados_aplicacao, new.motivo, new.criado_por,
      new.criado_em, new.publicado_em, new.pdf_path, new.pdf_sha256
    ) is distinct from row(
      old.id, old.relatorio_id, old.obra_id, old.numero, old.tipo,
      old.snapshot, old.dados_aplicacao, old.motivo, old.criado_por,
      old.criado_em, old.publicado_em, old.pdf_path, old.pdf_sha256
    ) then
      raise exception 'IMUTAVEL';
    end if;
    return new;
  end if;

  if old.status = 'falhou' and new.status = 'processando' then
    if row(new.id, new.relatorio_id, new.obra_id, new.numero, new.tipo)
       is distinct from
       row(old.id, old.relatorio_id, old.obra_id, old.numero, old.tipo)
       or new.publicado_em is not null
       or new.pdf_path is not null
       or new.pdf_sha256 is not null then
      raise exception 'IMUTAVEL';
    end if;
    return new;
  end if;

  raise exception 'IMUTAVEL';
end;
$$;

create or replace function private.proteger_relatorio_publicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.status in ('enviado', 'processando') then
      raise exception 'IMUTAVEL';
    end if;
    return old;
  end if;

  if old.status = 'rascunho' then
    if new.status = 'rascunho' then
      return new;
    end if;
    if new.status = 'processando'
       and new.versao_pendente_id is not null
       and row(new.id, new.obra_id, new.numero) = row(old.id, old.obra_id, old.numero)
       and new.dados_rascunho is not distinct from old.dados_rascunho
       and new.criado_em is not distinct from old.criado_em
       and new.enviado_em is not distinct from old.enviado_em
       and new.versao_atual_id is not distinct from old.versao_atual_id
       and new.snapshot is not distinct from old.snapshot
       and new.pdf_path is not distinct from old.pdf_path then
      select * into v_versao from public.relatorio_versoes v
      where v.id = new.versao_pendente_id
        and v.relatorio_id = old.id
        and v.obra_id = old.obra_id
        and v.tipo = 'original'
        and v.status = 'processando';
      if found then return new; end if;
    end if;
    raise exception 'TRANSICAO_RELATORIO_INVALIDA';
  end if;

  if old.status = 'processando' then
    if row(new.id, new.obra_id, new.numero, new.criado_em)
       is distinct from row(old.id, old.obra_id, old.numero, old.criado_em) then
      raise exception 'IMUTAVEL';
    end if;
    if new.status = 'enviado'
       and old.versao_pendente_id is not null
       and new.versao_atual_id = old.versao_pendente_id
       and new.versao_pendente_id is null then
      select * into v_versao from public.relatorio_versoes v
      where v.id = new.versao_atual_id
        and v.relatorio_id = old.id
        and v.obra_id = old.obra_id
        and v.tipo = 'original'
        and v.status = 'publicada';
      if found
         and new.snapshot = v_versao.snapshot
         and new.pdf_path = v_versao.pdf_path
         and new.geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int
         and new.geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int
         and new.dados_rascunho is null then
        return new;
      end if;
    end if;

    if new.status = 'rascunho'
       and old.versao_pendente_id is not null
       and new.versao_pendente_id is null
       and new.versao_atual_id is not distinct from old.versao_atual_id
       and new.snapshot is not distinct from old.snapshot
       and new.pdf_path is not distinct from old.pdf_path
       and exists (
         select 1 from public.relatorio_versoes v
         where v.id = old.versao_pendente_id and v.status = 'falhou'
       ) then
      return new;
    end if;
    raise exception 'TRANSICAO_RELATORIO_INVALIDA';
  end if;

  if old.status = 'enviado' then
    if new.status is distinct from old.status
       or new.id is distinct from old.id
       or new.obra_id is distinct from old.obra_id
       or new.numero is distinct from old.numero
       or new.criado_em is distinct from old.criado_em
       or new.dados_rascunho is distinct from old.dados_rascunho
       or new.enviado_em is distinct from old.enviado_em then
      raise exception 'IMUTAVEL';
    end if;

    -- Preparação de uma retificação.
    if old.versao_pendente_id is null
       and new.versao_pendente_id is not null
       and new.versao_atual_id = old.versao_atual_id
       and new.snapshot is not distinct from old.snapshot
       and new.pdf_path is not distinct from old.pdf_path
       and new.geral_antes is not distinct from old.geral_antes
       and new.geral_depois is not distinct from old.geral_depois then
      if exists (
        select 1 from public.relatorio_versoes v
        where v.id = new.versao_pendente_id
          and v.relatorio_id = old.id
          and v.obra_id = old.obra_id
          and v.tipo = 'retificacao'
          and v.status = 'processando'
      ) then return new; end if;
    end if;

    -- Falha da retificação: volta exatamente à versão vigente.
    if old.versao_pendente_id is not null
       and new.versao_pendente_id is null
       and new.versao_atual_id = old.versao_atual_id
       and new.snapshot is not distinct from old.snapshot
       and new.pdf_path is not distinct from old.pdf_path
       and new.geral_antes is not distinct from old.geral_antes
       and new.geral_depois is not distinct from old.geral_depois
       and exists (
         select 1 from public.relatorio_versoes v
         where v.id = old.versao_pendente_id and v.status = 'falhou'
       ) then return new;
    end if;

    -- Publicação da retificação, espelhando somente a versão publicada.
    if old.versao_pendente_id is not null
       and new.versao_atual_id = old.versao_pendente_id
       and new.versao_pendente_id is null then
      select * into v_versao from public.relatorio_versoes v
      where v.id = new.versao_atual_id
        and v.relatorio_id = old.id
        and v.obra_id = old.obra_id
        and v.tipo = 'retificacao'
        and v.status = 'publicada';
      if found
         and new.snapshot = v_versao.snapshot
         and new.pdf_path = v_versao.pdf_path
         and new.geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int
         and new.geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int then
        return new;
      end if;
    end if;

    -- UPDATE sem mudança é permitido, qualquer outra mutação é bloqueada.
    if new is not distinct from old then
      return new;
    end if;
    raise exception 'IMUTAVEL';
  end if;

  raise exception 'TRANSICAO_RELATORIO_INVALIDA';
end;
$$;

drop policy if exists storage_fotos_insert on storage.objects;
create policy storage_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and exists (
      select 1
      from public.fotos f
      join public.relatorios r on r.id = f.relatorio_id
      where f.storage_path = name
        and f.estado = 'reservada'
        and f.versao_id is null
        and r.status in ('rascunho', 'enviado')
        and private.eh_dono_obra_ativa(f.obra_id)
        and private.assinatura_permite_escrita(auth.uid())
    )
  );

-- Proprietários convidados recebem somente snapshots. Dados de aplicação da
-- versão ficam disponíveis ao empreiteiro por RPC, não por SELECT de coluna.
revoke select on public.relatorio_versoes from authenticated;
grant select (
  id, relatorio_id, obra_id, numero, tipo, status, snapshot, motivo,
  criado_por, criado_em, publicado_em, pdf_path, pdf_sha256
) on public.relatorio_versoes to authenticated;

drop policy if exists storage_capas_select_proprietario on storage.objects;

-- Fechamento e allowlist desta migration (inclui trigger functions recém-criadas).
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

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
grant execute on function public.fn_registrar_customer_id(text) to authenticated;
grant execute on function public.etapas_padrao to authenticated;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.eh_dono_obra_ativa(uuid) to authenticated;
grant execute on function private.eh_dono_obra(uuid) to authenticated;
grant execute on function private.tem_acesso_obra_ativa(uuid) to authenticated;
