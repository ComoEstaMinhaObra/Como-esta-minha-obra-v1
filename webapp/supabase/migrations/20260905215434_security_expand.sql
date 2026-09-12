-- Expansão: schema privado, tabelas, colunas, índices, backfill, constraints NOT VALID e RPCs novas.
-- Policies antigas permanecem até a migration de lockdown.

-- ===== schema privado =====
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role, authenticated;
revoke create on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

create table private.legado_incompativel (
  id bigserial primary key,
  tipo text not null,
  registro_id uuid,
  detalhe text not null,
  detectado_em timestamptz not null default now()
);

create table private.rate_limits (
  chave uuid not null,
  acao text not null,
  janela_inicio timestamptz not null,
  contador int not null check (contador >= 0),
  primary key (chave, acao, janela_inicio)
);

create table private.billing_outbox (
  id uuid primary key default gen_random_uuid(),
  chave_interna text not null unique,
  assinatura_id uuid not null references public.assinaturas(id),
  obra_acesso_id uuid references public.obra_acessos(id),
  obra_id uuid not null references public.obras(id),
  operacao public.outbox_operacao not null,
  status public.outbox_status not null default 'pendente',
  tentativas int not null default 0 check (tentativas >= 0),
  proximo_retry timestamptz,
  abacatepay_usage_id text,
  installment_number int,
  erro_sanitizado text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index billing_outbox_status_idx on private.billing_outbox (status, criado_em);

revoke all on private.legado_incompativel from public, anon, authenticated;
revoke all on private.rate_limits from public, anon, authenticated;
revoke all on private.billing_outbox from public, anon, authenticated;

-- ===== helpers privados =====
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

create or replace function private.eh_dono_obra_ativa(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = p_obra
      and o.owner_id = auth.uid()
      and o.arquivada_em is null
  );
$$;

create or replace function private.eh_dono_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = p_obra
      and o.owner_id = auth.uid()
  );
$$;

create or replace function private.tem_acesso_obra_ativa(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = p_obra
      and o.arquivada_em is null
      and (
        o.owner_id = auth.uid()
        or exists (
          select 1
          from public.obra_acessos a
          where a.obra_id = p_obra
            and a.user_id = auth.uid()
            and a.status = 'ativo'
        )
      )
  );
$$;

create or replace function private.assinatura_permite_escrita(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ass public.assinaturas%rowtype;
begin
  select * into v_ass from public.assinaturas s where s.user_id = p_user;
  if not found then
    return false;
  end if;
  if v_ass.status = 'ativa' then
    return true;
  end if;
  if v_ass.status = 'trial' then
    return v_ass.trial_fim is not null and pg_catalog.now() <= v_ass.trial_fim;
  end if;
  return false;
end;
$$;

create or replace function private.consumir_rate_limit(
  p_usuario uuid,
  p_acao text,
  p_max int,
  p_janela interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_count int;
begin
  if p_usuario is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if p_janela = interval '15 minutes' then
    v_inicio := date_trunc('hour', pg_catalog.now())
      + (floor(extract(minute from pg_catalog.now()) / 15.0) * interval '15 minutes');
  else
    v_inicio := date_trunc('hour', pg_catalog.now());
  end if;

  insert into private.rate_limits as rl (chave, acao, janela_inicio, contador)
  values (p_usuario, p_acao, v_inicio, 1)
  on conflict (chave, acao, janela_inicio)
  do update set contador = rl.contador + 1
  returning rl.contador into v_count;

  if v_count > p_max then
    raise exception 'RATE_LIMITED';
  end if;
end;
$$;

create or replace function private.user_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email::text)
  limit 1;
$$;

create or replace function private.email_do_usuario(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text from auth.users u where u.id = p_user;
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.eh_dono_obra_ativa(uuid) to authenticated;
grant execute on function private.eh_dono_obra(uuid) to authenticated;
grant execute on function private.tem_acesso_obra_ativa(uuid) to authenticated;
revoke all on function private.assinatura_permite_escrita(uuid) from public, anon, authenticated;
revoke all on function private.consumir_rate_limit(uuid, text, int, interval) from public, anon, authenticated;
revoke all on function private.user_id_por_email(text) from public, anon, authenticated;
revoke all on function private.email_do_usuario(uuid) from public, anon, authenticated;

-- ===== colunas e unicidade para FKs compostas =====
alter table public.obras add constraint obras_id_owner_key unique (id, owner_id);
alter table public.etapas add constraint etapas_id_obra_key unique (id, obra_id);
alter table public.relatorios add constraint relatorios_id_obra_key unique (id, obra_id);

alter table public.relatorios
  add column if not exists versao_atual_id uuid,
  add column if not exists versao_pendente_id uuid,
  add column if not exists erro_operacional text;

alter table public.obra_acessos
  add column if not exists owner_id uuid,
  add column if not exists revogado_em timestamptz,
  add column if not exists revogado_por uuid references public.profiles(id);

update public.obra_acessos a
set owner_id = o.owner_id
from public.obras o
where o.id = a.obra_id
  and a.owner_id is null;

insert into private.legado_incompativel (tipo, registro_id, detalhe)
select 'obra_acesso_sem_obra', a.id, 'acesso sem obra correspondente'
from public.obra_acessos a
where a.owner_id is null;

alter table public.obra_acessos
  drop constraint if exists obra_acessos_obra_id_email_key;

create unique index if not exists obra_acessos_obra_email_efetivo_uidx
  on public.obra_acessos (obra_id, email)
  where status in ('convidado', 'ativo', 'pendente_cobranca');

create unique index if not exists obra_acessos_obra_user_efetivo_uidx
  on public.obra_acessos (obra_id, user_id)
  where user_id is not null
    and status in ('convidado', 'ativo', 'pendente_cobranca');

-- ===== versões =====
create table public.relatorio_versoes (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null,
  obra_id uuid not null,
  numero int not null check (numero > 0),
  tipo public.versao_tipo not null,
  status public.versao_status not null,
  snapshot jsonb not null,
  dados_aplicacao jsonb,
  motivo text,
  criado_por uuid not null references public.profiles(id),
  criado_em timestamptz not null default now(),
  publicado_em timestamptz,
  pdf_path text,
  pdf_sha256 text,
  unique (relatorio_id, numero),
  unique (id, relatorio_id),
  unique (id, obra_id),
  unique (id, relatorio_id, obra_id),
  check (
    (tipo = 'original' and motivo is null)
    or (tipo = 'retificacao' and length(btrim(motivo)) > 0)
  ),
  check (
    pdf_sha256 is null
    or pdf_sha256 ~ '^[a-f0-9]{64}$'
  ),
  check (
    pdf_path is null
    or pdf_sha256 is null
    or pdf_path = (
      obra_id::text || '/' || relatorio_id::text || '/v' || numero::text || '-' || pdf_sha256 || '.pdf'
    )
  )
);

-- Esta tabela nasce fechada. A migration de expansão pode ser aplicada antes
-- do lockdown e não deve abrir uma janela de leitura sem RLS nesse intervalo.
alter table public.relatorio_versoes enable row level security;
revoke all on public.relatorio_versoes from public, anon, authenticated;

create policy security_expand_versoes_empreiteiro_select
  on public.relatorio_versoes
  for select to authenticated
  using (private.eh_dono_obra_ativa(obra_id));

create policy security_expand_versoes_proprietario_select
  on public.relatorio_versoes
  for select to authenticated
  using (
    private.tem_acesso_obra_ativa(obra_id)
    and status = 'publicada'
  );

grant select (
  id, relatorio_id, obra_id, numero, tipo, status, snapshot, motivo,
  criado_por, criado_em, publicado_em, pdf_path, pdf_sha256
) on public.relatorio_versoes to authenticated;

create unique index relatorio_versoes_pdf_path_uidx
  on public.relatorio_versoes (pdf_path)
  where pdf_path is not null;

alter table public.relatorio_versoes
  add constraint relatorio_versoes_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.relatorios
  add constraint relatorios_versao_atual_fk
  foreign key (versao_atual_id, id, obra_id)
  references public.relatorio_versoes (id, relatorio_id, obra_id)
  not valid;

alter table public.relatorios
  add constraint relatorios_versao_pendente_fk
  foreign key (versao_pendente_id, id, obra_id)
  references public.relatorio_versoes (id, relatorio_id, obra_id)
  not valid;

-- ===== efeitos ligados à versão =====
alter table public.lancamentos
  add column if not exists versao_id uuid;

alter table public.atividades
  add column if not exists obra_id uuid,
  add column if not exists versao_id uuid;

alter table public.fotos
  add column if not exists versao_id uuid,
  add column if not exists estado public.foto_estado not null default 'reservada';

alter table public.dias_aditivados
  add column if not exists versao_id uuid;

alter table public.relatorio_etapas
  add column if not exists obra_id uuid,
  add column if not exists versao_id uuid;

alter table public.webhooks_log
  add column if not exists event_id text,
  add column if not exists processado_em timestamptz;

create table public.avanco_ajustes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id),
  relatorio_id uuid not null,
  versao_id uuid not null,
  etapa_id uuid not null,
  pct_antes int not null check (pct_antes between 0 and 100),
  pct_depois int not null check (pct_depois between 0 and 100),
  criado_em timestamptz not null default now()
);

alter table public.avanco_ajustes enable row level security;

-- ===== backfill =====
update public.atividades a
set obra_id = r.obra_id
from public.relatorios r
where r.id = a.relatorio_id
  and a.obra_id is null;

update public.relatorio_etapas re
set obra_id = r.obra_id
from public.relatorios r
where r.id = re.relatorio_id
  and re.obra_id is null;

insert into private.legado_incompativel (tipo, registro_id, detalhe)
select 'atividade_sem_relatorio', a.id, 'atividade sem relatório da mesma obra'
from public.atividades a
where a.obra_id is null;

insert into private.legado_incompativel (tipo, registro_id, detalhe)
select 'foto_path_cruzado', f.id,
  'storage_path não começa pelos IDs da obra/relatório/etapa'
from public.fotos f
where f.storage_path not like (f.obra_id::text || '/' || f.relatorio_id::text || '/%')
   or f.storage_path not like ('%/' || f.etapa_id::text || '/%');

insert into public.relatorio_versoes (
  relatorio_id, obra_id, numero, tipo, status, snapshot,
  criado_por, criado_em, publicado_em, pdf_path
)
select
  r.id,
  r.obra_id,
  1,
  'original',
  'publicada',
  coalesce(r.snapshot, '{}'::jsonb),
  o.owner_id,
  coalesce(r.enviado_em, r.criado_em),
  r.enviado_em,
  r.pdf_path
from public.relatorios r
join public.obras o on o.id = r.obra_id
where r.status = 'enviado'
  and not exists (
    select 1 from public.relatorio_versoes v where v.relatorio_id = r.id
  );

insert into private.legado_incompativel (tipo, registro_id, detalhe)
select 'relatorio_enviado_sem_snapshot', r.id, 'relatório enviado sem snapshot'
from public.relatorios r
where r.status = 'enviado'
  and (r.snapshot is null or r.snapshot = '{}'::jsonb);

insert into private.legado_incompativel (tipo, registro_id, detalhe)
select 'relatorio_enviado_sem_pdf_hash', r.id,
  'calcular SHA-256 do PDF existente antes do lockdown'
from public.relatorios r
where r.status = 'enviado';

update public.relatorios r
set versao_atual_id = v.id
from public.relatorio_versoes v
where v.relatorio_id = r.id
  and v.numero = 1
  and r.status = 'enviado'
  and r.versao_atual_id is null;

update public.lancamentos l
set versao_id = r.versao_atual_id
from public.relatorios r
where r.id = l.relatorio_id
  and l.versao_id is null
  and r.versao_atual_id is not null;

update public.atividades a
set versao_id = r.versao_atual_id
from public.relatorios r
where r.id = a.relatorio_id
  and a.versao_id is null
  and r.versao_atual_id is not null;

update public.fotos f
set versao_id = r.versao_atual_id,
    estado = 'publicada'
from public.relatorios r
where r.id = f.relatorio_id
  and r.status = 'enviado'
  and r.versao_atual_id is not null;

update public.dias_aditivados d
set versao_id = r.versao_atual_id
from public.relatorios r
where r.id = d.relatorio_id
  and d.versao_id is null
  and r.versao_atual_id is not null;

update public.relatorio_etapas re
set versao_id = r.versao_atual_id
from public.relatorios r
where r.id = re.relatorio_id
  and re.versao_id is null
  and r.versao_atual_id is not null;

update public.webhooks_log w
set event_id = coalesce(w.payload->>'id', w.id::text)
where w.event_id is null;

update public.webhooks_log w
set payload = jsonb_strip_nulls(jsonb_build_object(
  'id', w.payload->>'id',
  'event', w.evento,
  'data', jsonb_build_object(
    'subscription', jsonb_build_object(
      'id', w.payload #>> '{data,subscription,id}',
      'status', w.payload #>> '{data,subscription,status}',
      'externalId', w.payload #>> '{data,subscription,externalId}'
    ),
    'checkout', jsonb_build_object(
      'externalId', w.payload #>> '{data,checkout,externalId}'
    ),
    'payment', jsonb_build_object(
      'externalId', w.payload #>> '{data,payment,externalId}'
    )
  )
));

alter table public.webhooks_log
  alter column event_id set not null;

create unique index if not exists webhooks_log_provedor_event_uidx
  on public.webhooks_log (provedor, event_id);

-- ===== constraints (NOT VALID) =====
alter table public.obra_acessos
  add constraint obra_acessos_obra_owner_fk
  foreign key (obra_id, owner_id)
  references public.obras (id, owner_id)
  not valid;

alter table public.lancamentos
  add constraint lancamentos_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.lancamentos
  add constraint lancamentos_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.atividades
  add constraint atividades_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.atividades
  add constraint atividades_etapa_obra_fk
  foreign key (etapa_id, obra_id)
  references public.etapas (id, obra_id)
  not valid;

alter table public.atividades
  add constraint atividades_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.atividades
  add constraint atividades_id_composto_key unique (id, obra_id, relatorio_id, etapa_id);

alter table public.fotos
  add constraint fotos_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.fotos
  add constraint fotos_etapa_obra_fk
  foreign key (etapa_id, obra_id)
  references public.etapas (id, obra_id)
  not valid;

alter table public.fotos
  add constraint fotos_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.fotos
  add constraint fotos_atividade_obra_fk
  foreign key (atividade_id, obra_id, relatorio_id, etapa_id)
  references public.atividades (id, obra_id, relatorio_id, etapa_id)
  not valid;

alter table public.fotos
  add constraint fotos_storage_path_unique unique (storage_path);

alter table public.fotos
  add constraint fotos_storage_path_ids_chk
  check (
    storage_path like (obra_id::text || '/' || relatorio_id::text || '/%')
    and storage_path like ('%/' || etapa_id::text || '/%')
  ) not valid;

alter table public.dias_aditivados
  drop constraint if exists dias_aditivados_dias_check;

alter table public.lancamentos
  drop constraint if exists lancamentos_check;

alter table public.dias_aditivados
  add constraint dias_aditivados_dias_check check (dias <> 0);

alter table public.dias_aditivados
  add constraint dias_aditivados_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.dias_aditivados
  add constraint dias_aditivados_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.relatorio_etapas
  add constraint relatorio_etapas_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.relatorio_etapas
  add constraint relatorio_etapas_etapa_obra_fk
  foreign key (etapa_id, obra_id)
  references public.etapas (id, obra_id)
  not valid;

alter table public.relatorio_etapas
  add constraint relatorio_etapas_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.relatorio_etapas drop constraint if exists relatorio_etapas_pkey;
alter table public.relatorio_etapas
  alter column versao_id set not null;
alter table public.relatorio_etapas
  add primary key (relatorio_id, etapa_id, versao_id);

alter table public.avanco_ajustes
  add constraint avanco_ajustes_relatorio_obra_fk
  foreign key (relatorio_id, obra_id)
  references public.relatorios (id, obra_id)
  not valid;

alter table public.avanco_ajustes
  add constraint avanco_ajustes_versao_obra_fk
  foreign key (versao_id, obra_id)
  references public.relatorio_versoes (id, obra_id)
  not valid;

alter table public.avanco_ajustes
  add constraint avanco_ajustes_etapa_obra_fk
  foreign key (etapa_id, obra_id)
  references public.etapas (id, obra_id)
  not valid;

-- ===== storage limits =====
update storage.buckets
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/webp']
where id in ('capas', 'fotos');

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'pdfs';

-- ===== handle_new_user: só ativa convite já liberado =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));

  insert into public.assinaturas (user_id, status, plano, limite_obras, trial_fim)
  values (new.id, 'trial', 'trial', 1, pg_catalog.now() + interval '14 days');

  update public.obra_acessos
  set user_id = new.id,
      status = 'ativo'
  where lower(email::text) = lower(new.email)
    and user_id is null
    and status = 'convidado';

  return new;
end;
$$;

create or replace function public.check_pct_monotonico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pct_atual >= old.pct_atual then
    return new;
  end if;

  if exists (
    select 1
    from public.relatorio_versoes v
    join public.avanco_ajustes aj
      on aj.versao_id = v.id
     and aj.etapa_id = new.id
    where v.obra_id = new.obra_id
      and v.status = 'processando'
      and aj.pct_antes = old.pct_atual
      and aj.pct_depois = new.pct_atual
  ) then
    return new;
  end if;

  raise exception 'pct_atual nao pode regredir (etapa %)', old.id;
end;
$$;

-- ===== wrappers públicos temporários (policies antigas) =====
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

create or replace function public.eh_dono_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.eh_dono_obra(p_obra);
$$;

create or replace function public.tem_acesso_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tem_acesso_obra_ativa(p_obra)
    or private.eh_dono_obra(p_obra);
$$;

create or replace function public.fn_avanco_geral(p_obra uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(round(sum(e.peso * e.pct_atual) / nullif(sum(e.peso), 0))::int, 0)
  from public.etapas e
  where e.obra_id = p_obra;
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
  v_etapa public.etapas%rowtype;
  v_fotos int;
  v_path text;
  v_count int;
begin
  if p_rascunho is null or coalesce((p_rascunho->>'versao')::int, 0) <> 1 then
    raise exception 'RASCUNHO_INVALIDO';
  end if;

  if jsonb_typeof(p_rascunho->'etapas') is distinct from 'array'
     or jsonb_array_length(p_rascunho->'etapas') = 0 then
    raise exception 'RASCUNHO_INVALIDO';
  end if;

  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    select * into v_etapa
    from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;
    if (v_item->>'pct')::int < 0 or (v_item->>'pct')::int > 100 then
      raise exception 'PCT_INVALIDO';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'atividades', '[]'::jsonb)) loop
    select * into v_etapa
    from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;
    v_fotos := jsonb_array_length(coalesce(v_item->'fotosPaths', '[]'::jsonb));
    if v_fotos > 12 then
      raise exception 'LIMITE_FOTOS';
    end if;
    if p_exigir_reservas then
      for v_path in select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb)) loop
        select count(*) into v_count
        from public.fotos f
        where f.storage_path = v_path
          and f.obra_id = p_obra
          and f.relatorio_id = p_relatorio
          and f.etapa_id = (v_item->>'etapaId')::uuid;
        if v_count <> 1 then
          raise exception 'FOTO_SEM_RESERVA';
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

create or replace function private.montar_snapshot(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_rascunho jsonb,
  p_geral_antes int,
  p_enviado_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_etapas_snap jsonb := '[]'::jsonb;
  v_lanc_novos jsonb := '[]'::jsonb;
  v_atividades_snap jsonb := '[]'::jsonb;
  v_prazo_novos jsonb := '[]'::jsonb;
  v_clima jsonb := '[]'::jsonb;
  v_pct_ant int;
  v_etapa_nome text;
  v_etapa_peso numeric;
  v_max_medicao int;
  v_max_aditivo int;
  v_idx int;
  v_num int;
  v_rotulo text;
  v_grupo public.lancamento_grupo;
  v_aditivos_acum bigint;
  v_pago_acum bigint;
  v_contratado_total bigint;
  v_pct_pago int;
  v_saldo bigint;
  v_dias_total int;
  v_nova_data date;
  v_geral_depois int;
  v_peso_sum numeric := 0;
  v_peso_pct numeric := 0;
  v_map_pct jsonb := '{}'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    select e.pct_atual, e.nome, e.peso
      into v_pct_ant, v_etapa_nome, v_etapa_peso
    from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra.id;

    v_map_pct := v_map_pct || jsonb_build_object((v_item->>'etapaId'), (v_item->>'pct')::int);
    v_etapas_snap := v_etapas_snap || jsonb_build_array(jsonb_build_object(
      'etapaId', v_item->>'etapaId',
      'nome', v_etapa_nome,
      'peso', v_etapa_peso,
      'pctAnterior', v_pct_ant,
      'pctNovo', (v_item->>'pct')::int
    ));
  end loop;

  for v_item in
    select jsonb_build_object('id', e.id, 'peso', e.peso, 'pct', e.pct_atual)
    from public.etapas e where e.obra_id = p_obra.id
  loop
    v_peso_sum := v_peso_sum + (v_item->>'peso')::numeric;
    v_peso_pct := v_peso_pct + (v_item->>'peso')::numeric
      * coalesce((v_map_pct->>(v_item->>'id'))::int, (v_item->>'pct')::int);
  end loop;
  v_geral_depois := coalesce(round(v_peso_pct / nullif(v_peso_sum, 0))::int, 0);

  select coalesce(max(l.numero), 0) into v_max_medicao
  from public.lancamentos l where l.obra_id = p_obra.id and l.tipo = 'medicao';
  select coalesce(max(l.numero), 0) into v_max_aditivo
  from public.lancamentos l where l.obra_id = p_obra.id and l.tipo = 'aditivo';

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_medicao + v_idx;
    v_rotulo := 'Medição ' || lpad(v_num::text, 2, '0');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'medicao', 'grupo', 'medicoes', 'numero', v_num, 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)) loop
    v_rotulo := v_item->>'rotulo';
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'material', 'grupo', 'materiais', 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_aditivo + v_idx;
    v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'aditivo', 'grupo', 'aditivos', 'numero', v_num, 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)) loop
    v_grupo := (v_item->>'grupo')::public.lancamento_grupo;
    v_rotulo := 'Estorno — ' || (v_item->>'descricao');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'estorno', 'grupo', v_grupo, 'rotulo', v_rotulo,
      'valorCentavos', -abs((v_item->>'valorCentavos')::bigint)
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'atividades', '[]'::jsonb)) loop
    select e.nome into v_etapa_nome from public.etapas e where e.id = (v_item->>'etapaId')::uuid;
    v_atividades_snap := v_atividades_snap || jsonb_build_array(jsonb_build_object(
      'etapaId', v_item->>'etapaId',
      'etapaNome', v_etapa_nome,
      'nota', coalesce(v_item->>'nota', ''),
      'fotosPaths', coalesce(v_item->'fotosPaths', '[]'::jsonb)
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'prazo', '[]'::jsonb)) loop
    v_prazo_novos := v_prazo_novos || jsonb_build_array(jsonb_build_object(
      'motivo', v_item->>'motivo',
      'descricao', v_item->>'descricao',
      'dias', (v_item->>'dias')::int
    ));
  end loop;

  select coalesce(sum(l.valor_centavos), 0) into v_pago_acum
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and l.tipo in ('sinal', 'medicao', 'material', 'estorno')
    and not (l.tipo = 'estorno' and l.grupo = 'aditivos');

  select coalesce(sum(l.valor_centavos), 0) into v_aditivos_acum
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and (l.tipo = 'aditivo' or (l.tipo = 'estorno' and l.grupo = 'aditivos'));

  -- incluir novos no acumulado projetado
  select v_pago_acum + coalesce(sum((x.elem->>'valorCentavos')::bigint), 0)
    into v_pago_acum
  from jsonb_array_elements(v_lanc_novos) as x(elem)
  where (x.elem->>'tipo') in ('medicao', 'material', 'estorno')
    and not ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  select v_aditivos_acum + coalesce(sum((x.elem->>'valorCentavos')::bigint), 0)
    into v_aditivos_acum
  from jsonb_array_elements(v_lanc_novos) as x(elem)
  where (x.elem->>'tipo') = 'aditivo'
     or ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  v_contratado_total := p_obra.valor_contratado_centavos + v_aditivos_acum;
  if v_contratado_total > 0 then
    v_pct_pago := round((v_pago_acum::numeric / v_contratado_total::numeric) * 100)::int;
  else
    v_pct_pago := 0;
  end if;
  v_saldo := v_contratado_total - v_pago_acum;

  select coalesce(sum(d.dias), 0) into v_dias_total
  from public.dias_aditivados d where d.obra_id = p_obra.id;
  select v_dias_total + coalesce(sum((x.elem->>'dias')::int), 0)
    into v_dias_total
  from jsonb_array_elements(v_prazo_novos) as x(elem);
  v_nova_data := p_obra.termino_contratual + v_dias_total;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'data', cs.data,
      'condicao', cs.condicao,
      'probChuva', cs.prob_chuva
    ) order by cs.data
  ), '[]'::jsonb)
  into v_clima
  from public.clima_snapshots cs
  where cs.obra_id = p_obra.id
    and cs.data >= (current_date - 7)
    and cs.data <= current_date;

  return jsonb_build_object(
    'versao', 1,
    'numero', p_relatorio.numero,
    'enviadoEm', to_jsonb(p_enviado_em),
    'obra', jsonb_build_object(
      'nome', p_obra.nome,
      'endereco', p_obra.endereco,
      'clienteNome', p_obra.cliente_nome,
      'construtora', p_obra.construtora,
      'engenheiro', p_obra.engenheiro,
      'escritorioArquitetura', p_obra.escritorio_arquitetura,
      'arquiteto', p_obra.arquiteto,
      'projetistaEstruturas', p_obra.projetista_estruturas,
      'projetistaInstalacoes', p_obra.projetista_instalacoes,
      'inicioContratual', p_obra.inicio_contratual,
      'terminoContratual', p_obra.termino_contratual
    ),
    'avancoFisico', jsonb_build_object(
      'geralAntes', p_geral_antes,
      'geralDepois', v_geral_depois,
      'etapas', v_etapas_snap
    ),
    'financeiro', jsonb_build_object(
      'valorContratadoCentavos', p_obra.valor_contratado_centavos,
      'aditivosAcumuladoCentavos', v_aditivos_acum,
      'contratadoTotalCentavos', v_contratado_total,
      'pagoAcumuladoCentavos', v_pago_acum,
      'pctPago', v_pct_pago,
      'saldoCentavos', v_saldo,
      'lancamentosNovos', v_lanc_novos
    ),
    'prazo', jsonb_build_object(
      'novosDias', v_prazo_novos,
      'totalDiasAditivados', v_dias_total,
      'novaDataTermino', v_nova_data
    ),
    'atividades', v_atividades_snap,
    'clima', jsonb_build_object('dias', v_clima)
  );
end;
$$;

create or replace function private.aplicar_efeitos_envio(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_versao public.relatorio_versoes,
  p_rascunho jsonb,
  p_permitir_regressao boolean,
  p_piso_etapas jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_pct int;
  v_pct_ant int;
  v_piso int;
  v_max_medicao int;
  v_max_aditivo int;
  v_idx int;
  v_num int;
  v_rotulo text;
  v_grupo public.lancamento_grupo;
  v_atividade_id uuid;
  v_foto_path text;
  v_foto_ordem int;
  v_etapa_id uuid;
begin
  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    v_etapa_id := (v_item->>'etapaId')::uuid;
    v_pct := (v_item->>'pct')::int;
    select e.pct_atual into v_pct_ant
    from public.etapas e where e.id = v_etapa_id and e.obra_id = p_obra.id;

    v_piso := coalesce((p_piso_etapas->>v_etapa_id::text)::int, 0);
    if v_pct < v_piso then
      raise exception 'PCT_ABAIXO_PISO';
    end if;

    if v_pct < v_pct_ant then
      if not p_permitir_regressao then
        raise exception 'PCT_REGREDIU';
      end if;
      insert into public.avanco_ajustes (
        obra_id, relatorio_id, versao_id, etapa_id, pct_antes, pct_depois
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id, v_etapa_id, v_pct_ant, v_pct
      );
    end if;

    update public.etapas set pct_atual = v_pct where id = v_etapa_id;

    insert into public.relatorio_etapas (relatorio_id, etapa_id, pct, obra_id, versao_id)
    values (p_relatorio.id, v_etapa_id, v_pct, p_obra.id, p_versao.id);
  end loop;

  select coalesce(max(l.numero), 0) into v_max_medicao
  from public.lancamentos l where l.obra_id = p_obra.id and l.tipo = 'medicao';
  select coalesce(max(l.numero), 0) into v_max_aditivo
  from public.lancamentos l where l.obra_id = p_obra.id and l.tipo = 'aditivo';

  if not p_permitir_regressao then
    v_idx := 0;
    for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)) loop
      v_idx := v_idx + 1;
      v_num := v_max_medicao + v_idx;
      v_rotulo := 'Medição ' || lpad(v_num::text, 2, '0');
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id, 'medicao', 'medicoes', v_num, v_rotulo,
        (v_item->>'valorCentavos')::bigint
      );
    end loop;

    for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)) loop
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id, 'material', 'materiais',
        v_item->>'rotulo', (v_item->>'valorCentavos')::bigint
      );
    end loop;

    v_idx := 0;
    for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)) loop
      v_idx := v_idx + 1;
      v_num := v_max_aditivo + v_idx;
      v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id, 'aditivo', 'aditivos', v_num, v_rotulo,
        (v_item->>'valorCentavos')::bigint
      );
    end loop;

    for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)) loop
      v_grupo := (v_item->>'grupo')::public.lancamento_grupo;
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id, 'estorno', v_grupo,
        'Estorno — ' || (v_item->>'descricao'),
        -abs((v_item->>'valorCentavos')::bigint)
      );
    end loop;

    for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'prazo', '[]'::jsonb)) loop
      insert into public.dias_aditivados (
        obra_id, relatorio_id, versao_id, motivo, descricao, dias
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id,
        (v_item->>'motivo')::public.motivo_aditivo,
        v_item->>'descricao',
        (v_item->>'dias')::int
      );
    end loop;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'atividades', '[]'::jsonb)) loop
    insert into public.atividades (relatorio_id, etapa_id, nota, obra_id, versao_id)
    values (
      p_relatorio.id, (v_item->>'etapaId')::uuid, coalesce(v_item->>'nota', ''),
      p_obra.id, p_versao.id
    )
    returning id into v_atividade_id;

    v_foto_ordem := 0;
    for v_foto_path in select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb)) loop
      v_foto_ordem := v_foto_ordem + 1;
      update public.fotos
      set atividade_id = v_atividade_id,
          versao_id = p_versao.id,
          estado = 'publicada',
          ordem = v_foto_ordem
      where storage_path = v_foto_path
        and obra_id = p_obra.id
        and relatorio_id = p_relatorio.id
        and estado = 'reservada'
        and versao_id is null;
    end loop;
  end loop;
end;
$$;

create or replace function private.aplicar_deltas_retificacao(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_versao public.relatorio_versoes,
  p_anterior public.relatorio_versoes,
  p_rascunho jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novos jsonb;
  v_antigos jsonb;
  v_item jsonb;
  v_old jsonb;
  v_delta bigint;
  v_dias int;
  v_key text;
begin
  v_novos := coalesce(p_versao.snapshot#>'{financeiro,lancamentosNovos}', '[]'::jsonb);
  v_antigos := coalesce(p_anterior.snapshot#>'{financeiro,lancamentosNovos}', '[]'::jsonb);

  for v_item in select * from jsonb_array_elements(v_novos) loop
    v_key := coalesce(v_item->>'rotulo', '');
    select x.elem into v_old
    from jsonb_array_elements(v_antigos) as x(elem)
    where coalesce(x.elem->>'rotulo', '') = v_key
      and coalesce(x.elem->>'tipo', '') = coalesce(v_item->>'tipo', '')
    limit 1;
    v_delta := (v_item->>'valorCentavos')::bigint - coalesce((v_old->>'valorCentavos')::bigint, 0);
    if v_delta <> 0 then
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id,
        (v_item->>'tipo')::public.lancamento_tipo,
        (v_item->>'grupo')::public.lancamento_grupo,
        null,
        'Ajuste v' || p_versao.numero::text || ' — ' || coalesce(v_item->>'rotulo', ''),
        v_delta
      );
    end if;
  end loop;

  for v_old in select * from jsonb_array_elements(v_antigos) loop
    v_key := coalesce(v_old->>'rotulo', '');
    if not exists (
      select 1 from jsonb_array_elements(v_novos) as x(elem)
      where coalesce(x.elem->>'rotulo', '') = v_key
        and coalesce(x.elem->>'tipo', '') = coalesce(v_old->>'tipo', '')
    ) then
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos
      ) values (
        p_obra.id, p_relatorio.id, p_versao.id,
        (v_old->>'tipo')::public.lancamento_tipo,
        (v_old->>'grupo')::public.lancamento_grupo,
        'Ajuste v' || p_versao.numero::text || ' — estorno ' || coalesce(v_old->>'rotulo', ''),
        - (v_old->>'valorCentavos')::bigint
      );
    end if;
  end loop;

  v_novos := coalesce(p_versao.snapshot#>'{prazo,novosDias}', '[]'::jsonb);
  v_antigos := coalesce(p_anterior.snapshot#>'{prazo,novosDias}', '[]'::jsonb);
  v_dias := coalesce((
    select sum((x.elem->>'dias')::int) from jsonb_array_elements(v_novos) as x(elem)
  ), 0) - coalesce((
    select sum((x.elem->>'dias')::int) from jsonb_array_elements(v_antigos) as x(elem)
  ), 0);
  if v_dias <> 0 then
    insert into public.dias_aditivados (
      obra_id, relatorio_id, versao_id, motivo, descricao, dias
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'outro',
      'Ajuste de prazo da retificação v' || p_versao.numero::text,
      v_dias
    );
  end if;
end;
$$;

create or replace function public.fn_criar_obra(
  p_nome text,
  p_endereco text,
  p_cliente_nome text,
  p_inicio date,
  p_termino date,
  p_valor_centavos bigint,
  p_sinal_centavos bigint default 0,
  p_lat double precision default null,
  p_lng double precision default null,
  p_construtora text default null,
  p_engenheiro text default null,
  p_escritorio_arquitetura text default null,
  p_arquiteto text default null,
  p_projetista_estruturas text default null,
  p_projetista_instalacoes text default null,
  p_foto_capa_path text default null,
  p_etapas jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_assinatura public.assinaturas%rowtype;
  v_ativas int;
  v_obra_id uuid;
  v_etapa jsonb;
  v_ordem int := 0;
  v_ep record;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0
     or length(btrim(coalesce(p_endereco, ''))) = 0
     or length(btrim(coalesce(p_cliente_nome, ''))) = 0 then
    raise exception 'DADOS_INVALIDOS';
  end if;
  if p_inicio is null or p_termino is null or p_termino < p_inicio then
    raise exception 'DATAS_INVALIDAS';
  end if;
  if p_valor_centavos is null or p_valor_centavos < 0
     or coalesce(p_sinal_centavos, 0) < 0
     or coalesce(p_sinal_centavos, 0) > p_valor_centavos then
    raise exception 'DADOS_INVALIDOS';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'DADOS_INVALIDOS';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select * into v_assinatura
  from public.assinaturas s
  where s.user_id = v_user
  for update;
  if not found then
    raise exception 'ASSINATURA_AUSENTE';
  end if;
  if v_assinatura.status not in ('trial', 'ativa') then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if v_assinatura.status = 'trial'
     and (v_assinatura.trial_fim is null or pg_catalog.now() > v_assinatura.trial_fim) then
    raise exception 'TRIAL_EXPIRADO';
  end if;

  select count(*) into v_ativas
  from public.obras o
  where o.owner_id = v_user and o.arquivada_em is null;
  if v_ativas >= v_assinatura.limite_obras then
    raise exception 'LIMITE_OBRAS';
  end if;

  insert into public.obras (
    owner_id, nome, endereco, lat, lng, cliente_nome,
    construtora, engenheiro, escritorio_arquitetura, arquiteto,
    projetista_estruturas, projetista_instalacoes, foto_capa_path,
    inicio_contratual, termino_contratual,
    valor_contratado_centavos, sinal_centavos
  ) values (
    v_user, btrim(p_nome), btrim(p_endereco), p_lat, p_lng, btrim(p_cliente_nome),
    p_construtora, p_engenheiro, p_escritorio_arquitetura, p_arquiteto,
    p_projetista_estruturas, p_projetista_instalacoes, p_foto_capa_path,
    p_inicio, p_termino,
    p_valor_centavos, coalesce(p_sinal_centavos, 0)
  ) returning id into v_obra_id;

  if p_etapas is null or jsonb_array_length(p_etapas) = 0 then
    for v_ep in select * from public.etapas_padrao() loop
      insert into public.etapas (obra_id, nome, ordem, peso, pct_atual)
      values (v_obra_id, v_ep.nome, v_ep.ordem, 1, 0);
    end loop;
  else
    if jsonb_array_length(p_etapas) > 60 then
      raise exception 'DADOS_INVALIDOS';
    end if;
    for v_etapa in select * from jsonb_array_elements(p_etapas) loop
      if length(btrim(coalesce(v_etapa->>'nome', ''))) = 0
         or coalesce((v_etapa->>'peso')::numeric, 0) <= 0 then
        raise exception 'DADOS_INVALIDOS';
      end if;
      v_ordem := v_ordem + 1;
      insert into public.etapas (obra_id, nome, ordem, peso, pct_atual)
      values (
        v_obra_id,
        btrim(v_etapa->>'nome'),
        v_ordem,
        coalesce((v_etapa->>'peso')::numeric, 1),
        0
      );
    end loop;
  end if;

  if coalesce(p_sinal_centavos, 0) > 0 then
    insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos)
    values (v_obra_id, 'sinal', 'medicoes', 'Sinal contratual', p_sinal_centavos);
  end if;

  return v_obra_id;
end;
$$;

create or replace function public.fn_salvar_rascunho(
  p_obra uuid,
  p_relatorio uuid,
  p_dados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_rel public.relatorios%rowtype;
  v_num int;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  perform private.consumir_rate_limit(v_user, 'salvar_rascunho', 120, interval '1 hour');

  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;

  perform private.validar_rascunho(p_obra, coalesce(p_relatorio, '00000000-0000-0000-0000-000000000000'::uuid), p_dados, p_relatorio is not null);

  if p_relatorio is not null then
    select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
    if not found or v_rel.obra_id <> p_obra or v_rel.status <> 'rascunho' then
      raise exception 'RELATORIO_INVALIDO';
    end if;
    update public.relatorios
    set dados_rascunho = p_dados
    where id = p_relatorio;
    return jsonb_build_object('relatorioId', p_relatorio, 'numero', v_rel.numero);
  end if;

  select coalesce(max(r.numero), 0) + 1 into v_num
  from public.relatorios r where r.obra_id = p_obra;

  if exists (
    select 1 from public.relatorios r
    where r.obra_id = p_obra and r.numero = v_num and r.status = 'rascunho'
  ) then
    raise exception 'RASCUNHO_DUPLICADO';
  end if;

  insert into public.relatorios (obra_id, numero, status, dados_rascunho)
  values (p_obra, v_num, 'rascunho', p_dados)
  returning * into v_rel;

  return jsonb_build_object('relatorioId', v_rel.id, 'numero', v_rel.numero);
end;
$$;

create or replace function public.fn_preparar_envio_relatorio(p_relatorio uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_item jsonb;
  v_pct_ant int;
  v_versao_id uuid;
  v_snapshot jsonb;
  v_geral_antes int;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  perform private.consumir_rate_limit(v_user, 'preparar_envio', 10, interval '1 hour');

  select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
  if not found then
    raise exception 'RELATORIO_AUSENTE';
  end if;
  select * into v_obra from public.obras o where o.id = v_rel.obra_id for update;
  select * into v_ass from public.assinaturas s where s.user_id = v_obra.owner_id for update;

  if v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_rel.status <> 'rascunho' then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if v_ass.status not in ('trial', 'ativa') then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if v_ass.status = 'trial' and (v_ass.trial_fim is null or pg_catalog.now() > v_ass.trial_fim) then
    raise exception 'TRIAL_EXPIRADO';
  end if;
  if v_ass.status = 'trial' and v_ass.relatorios_enviados_trial >= 1 then
    raise exception 'TRIAL_LIMITE';
  end if;
  if exists (
    select 1 from public.relatorios r
    where r.obra_id = v_obra.id and r.status = 'processando'
  ) or exists (
    select 1 from public.relatorio_versoes v
    where v.obra_id = v_obra.id and v.status = 'processando'
  ) then
    raise exception 'ENVIO_PENDENTE';
  end if;

  perform private.validar_rascunho(v_obra.id, v_rel.id, v_rel.dados_rascunho, true);

  for v_item in select * from jsonb_array_elements(v_rel.dados_rascunho->'etapas') loop
    select e.pct_atual into v_pct_ant
    from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = v_obra.id;
    if (v_item->>'pct')::int < v_pct_ant then
      raise exception 'PCT_REGREDIU';
    end if;
  end loop;

  v_geral_antes := public.fn_avanco_geral(v_obra.id);
  v_snapshot := private.montar_snapshot(v_obra, v_rel, v_rel.dados_rascunho, v_geral_antes, pg_catalog.now());

  insert into public.relatorio_versoes (
    relatorio_id, obra_id, numero, tipo, status, snapshot, dados_aplicacao, criado_por
  ) values (
    v_rel.id, v_obra.id, 1, 'original', 'processando', v_snapshot, v_rel.dados_rascunho, v_user
  ) returning id into v_versao_id;

  update public.relatorios
  set status = 'processando',
      versao_pendente_id = v_versao_id,
      erro_operacional = null
  where id = v_rel.id;

  return jsonb_build_object(
    'versaoId', v_versao_id,
    'relatorioId', v_rel.id,
    'obraId', v_obra.id,
    'numero', v_rel.numero,
    'versaoNumero', 1,
    'snapshot', v_snapshot
  );
end;
$$;

create or replace function public.fn_finalizar_envio_relatorio(
  p_versao uuid,
  p_pdf_path text,
  p_pdf_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_esperado text;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found then
    raise exception 'VERSAO_AUSENTE';
  end if;
  select * into v_rel from public.relatorios r where r.id = v_versao.relatorio_id for update;
  select * into v_obra from public.obras o where o.id = v_versao.obra_id for update;
  select * into v_ass from public.assinaturas s where s.user_id = v_obra.owner_id for update;

  if v_versao.status = 'publicada'
     and v_versao.pdf_path = p_pdf_path
     and v_versao.pdf_sha256 = p_pdf_sha256 then
    return jsonb_build_object(
      'versaoId', v_versao.id,
      'relatorioId', v_rel.id,
      'status', 'enviado',
      'idempotente', true
    );
  end if;

  if v_versao.status <> 'processando' or v_versao.tipo <> 'original' then
    raise exception 'VERSAO_INVALIDA';
  end if;
  if v_rel.status <> 'processando' then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if v_obra.arquivada_em is not null then
    raise exception 'OBRA_ARQUIVADA';
  end if;
  if p_pdf_sha256 is null or p_pdf_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'PDF_HASH_INVALIDO';
  end if;
  v_esperado := v_obra.id::text || '/' || v_rel.id::text || '/v1-' || p_pdf_sha256 || '.pdf';
  if p_pdf_path is distinct from v_esperado then
    raise exception 'PDF_PATH_INVALIDO';
  end if;

  perform private.aplicar_efeitos_envio(
    v_obra, v_rel, v_versao, v_versao.dados_aplicacao, false, '{}'::jsonb
  );

  update public.relatorio_versoes
  set status = 'publicada',
      publicado_em = pg_catalog.now(),
      pdf_path = p_pdf_path,
      pdf_sha256 = p_pdf_sha256,
      dados_aplicacao = null
  where id = v_versao.id;

  update public.relatorios
  set status = 'enviado',
      snapshot = v_versao.snapshot,
      pdf_path = p_pdf_path,
      dados_rascunho = null,
      versao_atual_id = v_versao.id,
      versao_pendente_id = null,
      geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int,
      geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int,
      enviado_em = pg_catalog.now(),
      erro_operacional = null
  where id = v_rel.id;

  if v_ass.status = 'trial' then
    update public.assinaturas
    set relatorios_enviados_trial = least(relatorios_enviados_trial + 1, 1),
        atualizado_em = pg_catalog.now()
    where id = v_ass.id
      and relatorios_enviados_trial = 0;
  end if;

  return jsonb_build_object(
    'versaoId', v_versao.id,
    'relatorioId', v_rel.id,
    'status', 'enviado',
    'idempotente', false
  );
end;
$$;

create or replace function public.fn_marcar_versao_falhou(p_versao uuid, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found or v_versao.status <> 'processando' then
    return;
  end if;
  update public.relatorio_versoes
  set status = 'falhou'::public.versao_status
  where id = p_versao;
  update public.relatorios
  set status = case when v_versao.tipo = 'original' then 'rascunho'::public.relatorio_status else 'enviado'::public.relatorio_status end,
      versao_pendente_id = null,
      erro_operacional = left(regexp_replace(coalesce(p_erro, 'FALHA_PDF'), '(email|token|key|sqlstate).*', 'erro operacional', 'i'), 180)
  where id = v_versao.relatorio_id;
end;
$$;

create or replace function public.fn_preparar_retificacao(
  p_relatorio uuid,
  p_motivo text,
  p_dados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_atual public.relatorio_versoes%rowtype;
  v_max_num int;
  v_piso jsonb := '{}'::jsonb;
  v_item jsonb;
  v_piso_pct int;
  v_versao_id uuid;
  v_snapshot jsonb;
  v_geral_antes int;
  v_prev_rel public.relatorios%rowtype;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  perform private.consumir_rate_limit(v_user, 'preparar_envio', 10, interval '1 hour');
  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;

  select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
  if not found then
    raise exception 'RELATORIO_AUSENTE';
  end if;
  select * into v_obra from public.obras o where o.id = v_rel.obra_id for update;
  select * into v_ass from public.assinaturas s where s.user_id = v_obra.owner_id for update;

  if v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_rel.status <> 'enviado' or v_rel.versao_atual_id is null then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  select coalesce(max(r.numero), 0) into v_max_num
  from public.relatorios r
  where r.obra_id = v_obra.id and r.status = 'enviado';
  if v_rel.numero <> v_max_num then
    raise exception 'NAO_E_ULTIMO';
  end if;
  if exists (
    select 1 from public.relatorio_versoes v
    where v.obra_id = v_obra.id and v.status = 'processando'
  ) then
    raise exception 'VERSAO_PENDENTE';
  end if;

  select * into v_atual from public.relatorio_versoes v where v.id = v_rel.versao_atual_id;
  perform private.validar_rascunho(v_obra.id, v_rel.id, p_dados, true);

  select * into v_prev_rel
  from public.relatorios r
  where r.obra_id = v_obra.id
    and r.status = 'enviado'
    and r.numero < v_rel.numero
  order by r.numero desc
  limit 1;

  if found then
    for v_item in select * from jsonb_array_elements(coalesce(
      (select snapshot#>'{avancoFisico,etapas}' from public.relatorio_versoes where id = v_prev_rel.versao_atual_id),
      '[]'::jsonb
    )) loop
      v_piso := v_piso || jsonb_build_object(v_item->>'etapaId', (v_item->>'pctNovo')::int);
    end loop;
  end if;

  for v_item in select * from jsonb_array_elements(p_dados->'etapas') loop
    v_piso_pct := coalesce((v_piso->>(v_item->>'etapaId'))::int, 0);
    if (v_item->>'pct')::int < v_piso_pct then
      raise exception 'PCT_ABAIXO_PISO';
    end if;
  end loop;

  v_geral_antes := coalesce((v_atual.snapshot#>>'{avancoFisico,geralAntes}')::int, public.fn_avanco_geral(v_obra.id));
  v_snapshot := private.montar_snapshot(v_obra, v_rel, p_dados, v_geral_antes, pg_catalog.now());

  if v_prev_rel.versao_atual_id is not null
     and (v_snapshot#>>'{avancoFisico,geralDepois}')::int
         < coalesce((
             select (s.snapshot#>>'{avancoFisico,geralDepois}')::int
             from public.relatorio_versoes s where s.id = v_prev_rel.versao_atual_id
           ), 0) then
    raise exception 'PCT_ABAIXO_PISO';
  end if;

  insert into public.relatorio_versoes (
    relatorio_id, obra_id, numero, tipo, status, snapshot, dados_aplicacao, motivo, criado_por
  ) values (
    v_rel.id, v_obra.id, v_atual.numero + 1, 'retificacao', 'processando',
    v_snapshot, p_dados, btrim(p_motivo), v_user
  ) returning id into v_versao_id;

  update public.relatorios
  set versao_pendente_id = v_versao_id,
      erro_operacional = null
  where id = v_rel.id;

  return jsonb_build_object(
    'versaoId', v_versao_id,
    'relatorioId', v_rel.id,
    'obraId', v_obra.id,
    'numero', v_rel.numero,
    'versaoNumero', v_atual.numero + 1,
    'snapshot', v_snapshot
  );
end;
$$;

create or replace function public.fn_finalizar_retificacao(
  p_versao uuid,
  p_pdf_path text,
  p_pdf_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_anterior public.relatorio_versoes%rowtype;
  v_esperado text;
  v_piso jsonb := '{}'::jsonb;
  v_item jsonb;
  v_prev public.relatorios%rowtype;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found then
    raise exception 'VERSAO_AUSENTE';
  end if;
  select * into v_rel from public.relatorios r where r.id = v_versao.relatorio_id for update;
  select * into v_obra from public.obras o where o.id = v_versao.obra_id for update;
  select * into v_anterior from public.relatorio_versoes v where v.id = v_rel.versao_atual_id for update;

  if v_versao.status = 'publicada'
     and v_versao.pdf_path = p_pdf_path
     and v_versao.pdf_sha256 = p_pdf_sha256 then
    return jsonb_build_object('versaoId', v_versao.id, 'relatorioId', v_rel.id, 'idempotente', true);
  end if;
  if v_versao.status <> 'processando' or v_versao.tipo <> 'retificacao' then
    raise exception 'VERSAO_INVALIDA';
  end if;
  if p_pdf_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'PDF_HASH_INVALIDO';
  end if;
  v_esperado := v_obra.id::text || '/' || v_rel.id::text || '/v' || v_versao.numero::text || '-' || p_pdf_sha256 || '.pdf';
  if p_pdf_path is distinct from v_esperado then
    raise exception 'PDF_PATH_INVALIDO';
  end if;

  select * into v_prev
  from public.relatorios r
  where r.obra_id = v_obra.id and r.status = 'enviado' and r.numero < v_rel.numero
  order by r.numero desc limit 1;
  if found then
    for v_item in select * from jsonb_array_elements(coalesce(
      (select snapshot#>'{avancoFisico,etapas}' from public.relatorio_versoes where id = v_prev.versao_atual_id),
      '[]'::jsonb
    )) loop
      v_piso := v_piso || jsonb_build_object(v_item->>'etapaId', (v_item->>'pctNovo')::int);
    end loop;
  end if;

  perform private.aplicar_efeitos_envio(
    v_obra, v_rel, v_versao, v_versao.dados_aplicacao, true, v_piso
  );
  perform private.aplicar_deltas_retificacao(v_obra, v_rel, v_versao, v_anterior, v_versao.dados_aplicacao);

  update public.relatorio_versoes
  set status = 'publicada',
      publicado_em = pg_catalog.now(),
      pdf_path = p_pdf_path,
      pdf_sha256 = p_pdf_sha256,
      dados_aplicacao = null
  where id = v_versao.id;

  update public.relatorios
  set versao_atual_id = v_versao.id,
      versao_pendente_id = null,
      snapshot = v_versao.snapshot,
      pdf_path = p_pdf_path,
      geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int,
      geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int,
      erro_operacional = null
  where id = v_rel.id;

  return jsonb_build_object(
    'versaoId', v_versao.id,
    'relatorioId', v_rel.id,
    'idempotente', false
  );
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
  if not private.eh_dono_obra_ativa(p_obra) then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
  if not found or v_rel.obra_id <> p_obra then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if v_rel.status not in ('rascunho', 'processando', 'enviado') then
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
  where f.relatorio_id = p_relatorio and f.etapa_id = p_etapa;
  if v_count >= 12 then
    raise exception 'LIMITE_FOTOS';
  end if;

  v_path := p_obra::text || '/' || p_relatorio::text || '/rascunho/' || p_etapa::text || '/' || v_id::text || '.webp';
  insert into public.fotos (obra_id, relatorio_id, etapa_id, storage_path, ordem, estado)
  values (p_obra, p_relatorio, p_etapa, v_path, v_count + 1, 'reservada');

  return jsonb_build_object('storagePath', v_path);
end;
$$;

create or replace function public.fn_remover_foto_rascunho(p_storage_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_foto public.fotos%rowtype;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  select * into v_foto from public.fotos f where f.storage_path = p_storage_path for update;
  if not found then
    raise exception 'FOTO_AUSENTE';
  end if;
  if not private.eh_dono_obra_ativa(v_foto.obra_id) then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_foto.estado = 'publicada' or v_foto.versao_id is not null then
    raise exception 'FOTO_PUBLICADA';
  end if;
  delete from public.fotos where id = v_foto.id;
end;
$$;

create or replace function public.fn_solicitar_acesso_obra(p_obra uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_email text;
  v_existentes int;
  v_acesso_id uuid;
  v_outbox_id uuid;
  v_alvo uuid;
  v_proprio text;
  v_status public.acesso_status;
  v_cobrado boolean;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  perform private.consumir_rate_limit(v_user, 'convite', 10, interval '1 hour');

  v_email := lower(btrim(p_email))::text;
  if v_email is null or position('@' in v_email::text) = 0 then
    raise exception 'EMAIL_INVALIDO';
  end if;
  v_proprio := private.email_do_usuario(v_user);
  if v_proprio is not null and v_email = lower(v_proprio) then
    raise exception 'EMAIL_PROPRIO';
  end if;

  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;

  perform 1 from public.obra_acessos a where a.obra_id = p_obra for update;

  if exists (
    select 1 from public.obra_acessos a
    where a.obra_id = p_obra
      and a.email = v_email
      and a.status in ('convidado', 'ativo', 'pendente_cobranca')
  ) then
    raise exception 'EMAIL_DUPLICADO';
  end if;

  select count(*) into v_existentes
  from public.obra_acessos a
  where a.obra_id = p_obra
    and a.status in ('convidado', 'ativo', 'pendente_cobranca');

  v_cobrado := v_existentes >= 1;
  v_alvo := private.user_id_por_email(v_email);

  if not v_cobrado then
    v_status := case when v_alvo is null then 'convidado'::public.acesso_status else 'ativo'::public.acesso_status end;
    insert into public.obra_acessos (obra_id, owner_id, email, user_id, status, cobrado_extra)
    values (p_obra, v_obra.owner_id, v_email, v_alvo, v_status, false)
    returning id into v_acesso_id;
    return jsonb_build_object(
      'acessoId', v_acesso_id,
      'cobradoExtra', false,
      'status', v_status,
      'enviarEmail', true
    );
  end if;

  if v_ass.status <> 'ativa' or v_ass.abacatepay_subscription_id is null
     or length(btrim(v_ass.abacatepay_subscription_id)) = 0 then
    raise exception 'PRECISA_ASSINAR';
  end if;

  insert into public.obra_acessos (obra_id, owner_id, email, user_id, status, cobrado_extra)
  values (p_obra, v_obra.owner_id, v_email, v_alvo, 'pendente_cobranca', true)
  returning id into v_acesso_id;

  insert into private.billing_outbox (
    chave_interna, assinatura_id, obra_acesso_id, obra_id, operacao, status
  ) values (
    'add:' || v_acesso_id::text, v_ass.id, v_acesso_id, p_obra, 'add', 'pendente'
  ) returning id into v_outbox_id;

  return jsonb_build_object(
    'acessoId', v_acesso_id,
    'cobradoExtra', true,
    'status', 'pendente_cobranca',
    'outboxId', v_outbox_id,
    'enviarEmail', false
  );
end;
$$;

create or replace function private.enfileirar_subtract(
  p_ass uuid,
  p_acesso uuid,
  p_obra uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_chave text := 'subtract:' || p_acesso::text || ':' || extract(epoch from pg_catalog.now())::bigint::text;
begin
  insert into private.billing_outbox (
    chave_interna, assinatura_id, obra_acesso_id, obra_id, operacao, status
  ) values (
    v_chave, p_ass, p_acesso, p_obra, 'subtract', 'pendente'
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_revogar_acesso_obra(p_obra uuid, p_acesso uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_promo public.obra_acessos%rowtype;
  v_outbox uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;
  select * into v_acesso from public.obra_acessos a where a.id = p_acesso and a.obra_id = p_obra for update;
  if not found or v_acesso.status = 'revogado' then
    raise exception 'NAO_ENCONTRADO';
  end if;

  update private.billing_outbox
  set status = 'cancelado',
      proximo_retry = null,
      erro_sanitizado = 'ACESSO_REVOGADO',
      atualizado_em = pg_catalog.now()
  where obra_acesso_id = v_acesso.id
    and operacao = 'add'
    and status in ('pendente', 'falhou');

  update public.obra_acessos
  set status = 'revogado',
      revogado_em = pg_catalog.now(),
      revogado_por = v_user
  where id = p_acesso;

  if v_acesso.cobrado_extra
     and v_acesso.status in ('convidado', 'ativo')
     and v_ass.abacatepay_subscription_id is not null then
    v_outbox := private.enfileirar_subtract(v_ass.id, v_acesso.id, p_obra);
  elsif not v_acesso.cobrado_extra then
    select * into v_promo
    from public.obra_acessos a
    where a.obra_id = p_obra
      and a.cobrado_extra
      and a.status in ('convidado', 'ativo')
    order by a.criado_em
    limit 1;
    if found then
      update public.obra_acessos set cobrado_extra = false where id = v_promo.id;
      if v_ass.abacatepay_subscription_id is not null then
        v_outbox := private.enfileirar_subtract(v_ass.id, v_promo.id, p_obra);
      end if;
    end if;
  end if;

  return jsonb_build_object('acessoId', p_acesso, 'outboxId', v_outbox);
end;
$$;

create or replace function public.fn_arquivar_obra(p_obra uuid, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_outboxes uuid[] := array[]::uuid[];
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_obra.arquivada_em is not null then
    raise exception 'JA_ARQUIVADA';
  end if;
  if btrim(p_nome) is distinct from v_obra.nome then
    raise exception 'NOME_NAO_CONFERE';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;

  for v_acesso in
    select * from public.obra_acessos a
    where a.obra_id = p_obra and a.status in ('convidado', 'ativo', 'pendente_cobranca')
    for update
  loop
    update private.billing_outbox
    set status = 'cancelado',
        proximo_retry = null,
        erro_sanitizado = 'OBRA_ARQUIVADA',
        atualizado_em = pg_catalog.now()
    where obra_acesso_id = v_acesso.id
      and operacao = 'add'
      and status in ('pendente', 'falhou');

    update public.obra_acessos
    set status = 'revogado',
        revogado_em = pg_catalog.now(),
        revogado_por = v_user
    where id = v_acesso.id;
    if v_acesso.cobrado_extra and v_acesso.status in ('convidado', 'ativo')
       and v_ass.abacatepay_subscription_id is not null then
      v_id := private.enfileirar_subtract(v_ass.id, v_acesso.id, p_obra);
      v_outboxes := v_outboxes || v_id;
    end if;
  end loop;

  update public.obras set arquivada_em = pg_catalog.now() where id = p_obra;
  return jsonb_build_object('obraId', p_obra, 'outboxIds', to_jsonb(v_outboxes));
end;
$$;

create or replace function public.fn_claim_outbox(p_outbox uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.billing_outbox%rowtype;
  v_ass public.assinaturas%rowtype;
begin
  select * into v_row from private.billing_outbox o where o.id = p_outbox for update;
  if not found then
    raise exception 'OUTBOX_AUSENTE';
  end if;
  if v_row.status = 'confirmado' then
    return jsonb_build_object('status', v_row.status, 'idempotente', true, 'usageId', v_row.abacatepay_usage_id);
  end if;
  if v_row.status = 'incerto' then
    return jsonb_build_object('status', 'incerto', 'repetirProvedor', false);
  end if;
  if v_row.status not in ('pendente', 'falhou') then
    return jsonb_build_object('status', v_row.status, 'repetirProvedor', false);
  end if;
  select * into v_ass from public.assinaturas s where s.id = v_row.assinatura_id;
  update private.billing_outbox
  set status = 'processando',
      tentativas = tentativas + 1,
      atualizado_em = pg_catalog.now()
  where id = p_outbox;
  return jsonb_build_object(
    'status', 'processando',
    'operacao', v_row.operacao,
    'subscriptionId', v_ass.abacatepay_subscription_id,
    'obraAcessoId', v_row.obra_acesso_id,
    'assinaturaId', v_row.assinatura_id
  );
end;
$$;

create or replace function public.fn_confirmar_outbox(
  p_outbox uuid,
  p_usage_id text,
  p_installment int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.billing_outbox%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_status public.acesso_status;
begin
  select * into v_row from private.billing_outbox o where o.id = p_outbox for update;
  if not found then
    raise exception 'OUTBOX_AUSENTE';
  end if;
  if v_row.status = 'confirmado' then
    return jsonb_build_object('status', 'confirmado', 'idempotente', true);
  end if;

  update private.billing_outbox
  set status = 'confirmado',
      abacatepay_usage_id = p_usage_id,
      installment_number = p_installment,
      atualizado_em = pg_catalog.now(),
      erro_sanitizado = null
  where id = p_outbox;

  insert into public.assinatura_usos (
    assinatura_id, obra_acesso_id, action, units, abacatepay_usage_id, installment_number
  ) values (
    v_row.assinatura_id, v_row.obra_acesso_id, v_row.operacao::text, 1, p_usage_id, p_installment
  );

  if v_row.operacao = 'add' then
    select * into v_acesso from public.obra_acessos a where a.id = v_row.obra_acesso_id for update;
    v_status := case when v_acesso.user_id is null then 'convidado'::public.acesso_status else 'ativo'::public.acesso_status end;
    update public.obra_acessos
    set status = v_status
    where id = v_acesso.id and status = 'pendente_cobranca';
    return jsonb_build_object('status', 'confirmado', 'acessoStatus', v_status, 'enviarEmail', true, 'email', v_acesso.email);
  end if;

  return jsonb_build_object('status', 'confirmado', 'enviarEmail', false);
end;
$$;

create or replace function public.fn_falhar_outbox(p_outbox uuid, p_erro text, p_incerto boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.billing_outbox
  set status = case when p_incerto then 'incerto'::public.outbox_status else 'falhou'::public.outbox_status end,
      erro_sanitizado = left(coalesce(p_erro, 'falha'), 180),
      atualizado_em = pg_catalog.now(),
      proximo_retry = case when p_incerto then null else pg_catalog.now() + interval '5 minutes' end
  where id = p_outbox
    and status in ('processando', 'pendente');
end;
$$;

create or replace function public.fn_claim_webhook_evento(
  p_event_id text,
  p_evento text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existente uuid;
begin
  if p_event_id is null or length(btrim(p_event_id)) = 0 then
    raise exception 'EVENTO_SEM_ID';
  end if;

  insert into public.webhooks_log (provedor, event_id, evento, payload, processado)
  values ('abacatepay', p_event_id, p_evento, p_payload, false)
  on conflict (provedor, event_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_existente
    from public.webhooks_log
    where provedor = 'abacatepay' and event_id = p_event_id;
    return jsonb_build_object('logId', v_existente, 'duplicado', true);
  end if;

  return jsonb_build_object('logId', v_id, 'duplicado', false);
end;
$$;

create or replace function public.fn_consumir_rate_limit(p_acao text)
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
  case p_acao
    when 'convite' then
      perform private.consumir_rate_limit(v_user, p_acao, 10, interval '1 hour');
    when 'preparar_envio' then
      perform private.consumir_rate_limit(v_user, p_acao, 10, interval '1 hour');
    when 'salvar_rascunho' then
      perform private.consumir_rate_limit(v_user, p_acao, 120, interval '1 hour');
    when 'checkout' then
      perform private.consumir_rate_limit(v_user, p_acao, 5, interval '15 minutes');
    when 'geocodificacao' then
      perform private.consumir_rate_limit(v_user, p_acao, 10, interval '1 hour');
    else
      raise exception 'ACAO_INVALIDA';
  end case;
end;
$$;

create or replace function public.fn_purgar_rate_limits()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  delete from private.rate_limits
  where janela_inicio < pg_catalog.now() - interval '2 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.fn_purgar_webhooks()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  delete from public.webhooks_log
  where recebido_em < pg_catalog.now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.fn_listar_obras_empreiteiro()
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
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'nome', o.nome,
      'clienteNome', o.cliente_nome,
      'fotoCapaPath', case when o.arquivada_em is null then o.foto_capa_path else null end,
      'arquivada', o.arquivada_em is not null,
      'criadoEm', o.criado_em
    ) order by o.criado_em desc)
    from public.obras o
    where o.owner_id = v_user
  ), '[]'::jsonb);
end;
$$;

create or replace function public.fn_sou_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

create or replace function public.fn_admin_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  return jsonb_build_object(
    'assinaturas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'status', s.status, 'plano', s.plano, 'trialFim', s.trial_fim
      )), '[]'::jsonb)
      from public.assinaturas s
    ),
    'obrasAtivas', (select count(*) from public.obras o where o.arquivada_em is null),
    'relatorios30d', (
      select count(*) from public.relatorios r
      where r.status = 'enviado'
        and r.enviado_em >= pg_catalog.now() - interval '30 days'
    )
  );
end;
$$;

create or replace function public.fn_admin_contas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', p.id,
      'nome', left(coalesce(p.nome, ''), 80),
      'plano', s.plano,
      'status', s.status,
      'obrasAtivas', (
        select count(*) from public.obras o
        where o.owner_id = p.id and o.arquivada_em is null
      )
    ) order by p.criado_em desc)
    from public.profiles p
    join public.assinaturas s on s.user_id = p.id
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.fn_admin_obras();
create or replace function public.fn_admin_obras(p_owner uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'ownerId', o.owner_id,
      'nome', left(o.nome, 80),
      'arquivada', o.arquivada_em is not null,
      'criadoEm', o.criado_em,
      'inicioContratual', o.inicio_contratual
    ) order by o.criado_em desc)
    from public.obras o
    where p_owner is null or o.owner_id = p_owner
  ), '[]'::jsonb);
end;
$$;

create or replace function public.fn_admin_webhooks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  return jsonb_build_object(
    'webhooks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'eventId', w.event_id,
        'evento', w.evento,
        'processado', w.processado,
        'erro', left(coalesce(w.erro, ''), 180),
        'recebidoEm', w.recebido_em
      ) order by w.recebido_em desc)
      from (
        select * from public.webhooks_log order by recebido_em desc limit 100
      ) w
    ), '[]'::jsonb),
    'outbox', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'operacao', o.operacao,
        'status', o.status,
        'tentativas', o.tentativas,
        'erro', o.erro_sanitizado,
        'criadoEm', o.criado_em
      ) order by o.criado_em desc)
      from (
        select * from private.billing_outbox order by criado_em desc limit 100
      ) o
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.fn_admin_reprocessar_webhook(p_log uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log public.webhooks_log%rowtype;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_log from public.webhooks_log w where w.id = p_log;
  if not found then
    raise exception 'NAO_ENCONTRADO';
  end if;
  if v_log.processado then
    raise exception 'ESTADO_INSEGURO';
  end if;
  return jsonb_build_object(
    'logId', v_log.id,
    'eventId', v_log.event_id,
    'evento', v_log.evento,
    'payload', v_log.payload
  );
end;
$$;

create or replace function public.fn_proximos_rotulos(p_obra uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max_medicao int;
  v_max_aditivo int;
begin
  if not private.eh_dono_obra_ativa(p_obra) and not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select coalesce(max(l.numero), 0) into v_max_medicao
  from public.lancamentos l where l.obra_id = p_obra and l.tipo = 'medicao';
  select coalesce(max(l.numero), 0) into v_max_aditivo
  from public.lancamentos l where l.obra_id = p_obra and l.tipo = 'aditivo';
  return jsonb_build_object(
    'proximaMedicao', 'Medição ' || lpad((v_max_medicao + 1)::text, 2, '0'),
    'proximoAditivo', 'Aditivo ' || lpad((v_max_aditivo + 1)::text, 2, '0')
  );
end;
$$;

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

create or replace function public.fn_enfileirar_renovacao_emails(
  p_assinatura uuid,
  p_event_id text,
  p_parcela int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_chave text;
begin
  select * into v_ass from public.assinaturas s where s.id = p_assinatura for update;
  if not found then
    raise exception 'ASSINATURA_AUSENTE';
  end if;
  for v_acesso in
    select a.*
    from public.obra_acessos a
    join public.obras o on o.id = a.obra_id
    where o.owner_id = v_ass.user_id
      and o.arquivada_em is null
      and a.cobrado_extra
      and a.status in ('convidado', 'ativo')
  loop
    v_chave := 'renew:' || coalesce(p_event_id, '') || ':' || coalesce(p_parcela, 0)::text || ':' || v_acesso.id::text;
    insert into private.billing_outbox (
      chave_interna, assinatura_id, obra_acesso_id, obra_id, operacao, status
    ) values (
      v_chave, v_ass.id, v_acesso.id, v_acesso.obra_id, 'add', 'pendente'
    )
    on conflict (chave_interna) do nothing
    returning id into v_id;
    if v_id is not null then
      v_ids := v_ids || v_id;
    end if;
  end loop;
  return jsonb_build_object('outboxIds', to_jsonb(v_ids));
end;
$$;

create or replace function public.fn_listar_outbox_pendente()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'operacao', o.operacao,
    'status', o.status
  )), '[]'::jsonb)
  from private.billing_outbox o
  where o.status = 'pendente'
     or (o.status = 'falhou' and o.proximo_retry is not null and o.proximo_retry <= pg_catalog.now());
$$;

-- SECURITY DEFINER nasce executável por PUBLIC no PostgreSQL. Revogar no fim
-- da própria expansão elimina a janela entre esta migration e o lockdown.
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;

revoke all on function public.fn_finalizar_envio_relatorio(uuid, text, text) from authenticated;
revoke all on function public.fn_finalizar_retificacao(uuid, text, text) from authenticated;
revoke all on function public.fn_marcar_versao_falhou(uuid, text) from authenticated;
revoke all on function public.fn_claim_outbox(uuid) from authenticated;
revoke all on function public.fn_confirmar_outbox(uuid, text, int) from authenticated;
revoke all on function public.fn_falhar_outbox(uuid, text, boolean) from authenticated;
revoke all on function public.fn_claim_webhook_evento(text, text, jsonb) from authenticated;
revoke all on function public.fn_enfileirar_renovacao_emails(uuid, text, int) from authenticated;
revoke all on function public.fn_listar_outbox_pendente() from authenticated;
revoke all on function public.fn_purgar_rate_limits() from authenticated;
revoke all on function public.fn_purgar_webhooks() from authenticated;
