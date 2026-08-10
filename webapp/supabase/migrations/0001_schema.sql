-- 0001_schema.sql — enums, tabelas, funções base, RLS, storage

create extension if not exists citext;

-- ===== enums =====
create type plano_tipo as enum ('trial','obra_1','obra_3','obra_5');
create type assinatura_status as enum ('trial','ativa','inadimplente','cancelada');
create type relatorio_status as enum ('rascunho','enviado');
create type lancamento_tipo as enum ('sinal','medicao','material','aditivo','estorno');
create type lancamento_grupo as enum ('medicoes','materiais','aditivos');
create type acesso_status as enum ('convidado','ativo');
create type motivo_aditivo as enum (
  'chuvas','aditivo_escopo','atraso_materiais','licencas','interferencias','forca_maior','outro'
);
create type clima_condicao as enum ('aberto','nublado','chuvoso');

-- ===== tabelas =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status assinatura_status not null default 'trial',
  plano plano_tipo not null default 'trial',
  limite_obras int not null default 1,
  trial_fim timestamptz,
  relatorios_enviados_trial int not null default 0,
  abacatepay_customer_id text,
  abacatepay_subscription_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  nome text not null,
  endereco text not null,
  lat double precision,
  lng double precision,
  cliente_nome text not null,
  construtora text,
  engenheiro text,
  escritorio_arquitetura text,
  arquiteto text,
  projetista_estruturas text,
  projetista_instalacoes text,
  foto_capa_path text,
  inicio_contratual date not null,
  termino_contratual date not null,
  valor_contratado_centavos bigint not null check (valor_contratado_centavos >= 0),
  sinal_centavos bigint not null default 0 check (sinal_centavos >= 0),
  arquivada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.obras (owner_id) where arquivada_em is null;

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  ordem int not null,
  peso numeric not null default 1 check (peso > 0),
  pct_atual int not null default 0 check (pct_atual between 0 and 100),
  unique (obra_id, ordem)
);

create table public.obra_acessos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  email citext not null,
  user_id uuid references public.profiles(id),
  status acesso_status not null default 'convidado',
  cobrado_extra boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (obra_id, email)
);

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  numero int not null,
  status relatorio_status not null default 'rascunho',
  dados_rascunho jsonb,
  snapshot jsonb,
  pdf_path text,
  geral_antes int,
  geral_depois int,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  unique (obra_id, numero)
);

create table public.relatorio_etapas (
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  pct int not null check (pct between 0 and 100),
  primary key (relatorio_id, etapa_id)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid references public.relatorios(id),
  tipo lancamento_tipo not null,
  grupo lancamento_grupo not null,
  numero int,
  rotulo text not null,
  valor_centavos bigint not null,
  criado_em timestamptz not null default now(),
  check (tipo = 'estorno' or valor_centavos >= 0)
);
create index on public.lancamentos (obra_id);

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  nota text not null default ''
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete cascade,
  storage_path text not null,
  ordem int not null default 0
);

create table public.dias_aditivados (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  motivo motivo_aditivo not null,
  descricao text,
  dias int not null check (dias > 0)
);

create table public.clima_snapshots (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null,
  condicao clima_condicao not null,
  prob_chuva int check (prob_chuva between 0 and 100),
  fonte text not null default 'open-meteo',
  unique (obra_id, data)
);

create table public.assinatura_usos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas(id) on delete cascade,
  obra_acesso_id uuid references public.obra_acessos(id) on delete set null,
  action text not null check (action in ('add','subtract')),
  units int not null,
  abacatepay_usage_id text,
  installment_number int,
  criado_em timestamptz not null default now()
);

create table public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'abacatepay',
  evento text not null,
  payload jsonb not null,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

-- ===== funções =====
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create or replace function public.fn_avanco_geral(p_obra uuid) returns int
language sql stable as $$
  select coalesce(round(sum(peso * pct_atual) / nullif(sum(peso), 0))::int, 0)
  from etapas where obra_id = p_obra
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  insert into assinaturas (user_id, status, plano, limite_obras, trial_fim)
    values (new.id, 'trial', 'trial', 1, now() + interval '14 days');
  update obra_acessos set user_id = new.id, status = 'ativo'
    where email = new.email::citext and user_id is null;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.check_pct_monotonico() returns trigger
language plpgsql as $$
begin
  if new.pct_atual < old.pct_atual then
    raise exception 'pct_atual nao pode regredir (etapa %)', old.id;
  end if;
  return new;
end $$;

create trigger trg_etapas_monotonico before update of pct_atual on public.etapas
  for each row execute function public.check_pct_monotonico();

-- helper: dono da obra
create or replace function public.eh_dono_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from obras where id = p_obra and owner_id = auth.uid()
  )
$$;

create or replace function public.tem_acesso_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from obra_acessos a
    where a.obra_id = p_obra and a.user_id = auth.uid() and a.status = 'ativo'
  )
$$;

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.assinaturas enable row level security;
alter table public.obras enable row level security;
alter table public.etapas enable row level security;
alter table public.obra_acessos enable row level security;
alter table public.relatorios enable row level security;
alter table public.relatorio_etapas enable row level security;
alter table public.lancamentos enable row level security;
alter table public.atividades enable row level security;
alter table public.fotos enable row level security;
alter table public.dias_aditivados enable row level security;
alter table public.clima_snapshots enable row level security;
alter table public.assinatura_usos enable row level security;
alter table public.webhooks_log enable row level security;
alter table public.admins enable row level security;

-- profiles
create policy profiles_own_select on public.profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_own_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- assinaturas: select próprio; escrita via service role
create policy assinaturas_own_select on public.assinaturas
  for select using (user_id = auth.uid() or is_admin());

create policy assinatura_usos_own_select on public.assinatura_usos
  for select using (
    exists (
      select 1 from assinaturas s
      where s.id = assinatura_usos.assinatura_id and s.user_id = auth.uid()
    ) or is_admin()
  );

-- obras
create policy obras_owner_all on public.obras
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy obras_proprietario_select on public.obras
  for select using (
    exists (
      select 1 from obra_acessos a
      where a.obra_id = obras.id and a.user_id = auth.uid() and a.status = 'ativo'
    ) and arquivada_em is null
  );

create policy obras_admin_select on public.obras
  for select using (is_admin());

-- etapas
create policy etapas_owner_all on public.etapas
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy etapas_proprietario_select on public.etapas
  for select using (tem_acesso_obra(obra_id));

-- obra_acessos
create policy obra_acessos_owner_all on public.obra_acessos
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy obra_acessos_convidado_select on public.obra_acessos
  for select using (user_id = auth.uid());

-- relatorios: dono tudo; proprietário só enviados
create policy relatorios_owner_all on public.relatorios
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy relatorios_proprietario_select on public.relatorios
  for select using (
    tem_acesso_obra(obra_id) and status = 'enviado'
  );

-- relatorio_etapas
create policy relatorio_etapas_owner_all on public.relatorio_etapas
  for all using (
    exists (
      select 1 from relatorios r
      where r.id = relatorio_etapas.relatorio_id and eh_dono_obra(r.obra_id)
    )
  ) with check (
    exists (
      select 1 from relatorios r
      where r.id = relatorio_etapas.relatorio_id and eh_dono_obra(r.obra_id)
    )
  );

create policy relatorio_etapas_proprietario_select on public.relatorio_etapas
  for select using (
    exists (
      select 1 from relatorios r
      where r.id = relatorio_etapas.relatorio_id
        and tem_acesso_obra(r.obra_id)
        and r.status = 'enviado'
    )
  );

-- lancamentos
create policy lancamentos_owner_all on public.lancamentos
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy lancamentos_proprietario_select on public.lancamentos
  for select using (
    tem_acesso_obra(obra_id)
    and (
      relatorio_id is null
      or exists (
        select 1 from relatorios r
        where r.id = lancamentos.relatorio_id and r.status = 'enviado'
      )
    )
  );

-- atividades
create policy atividades_owner_all on public.atividades
  for all using (
    exists (
      select 1 from relatorios r
      where r.id = atividades.relatorio_id and eh_dono_obra(r.obra_id)
    )
  ) with check (
    exists (
      select 1 from relatorios r
      where r.id = atividades.relatorio_id and eh_dono_obra(r.obra_id)
    )
  );

create policy atividades_proprietario_select on public.atividades
  for select using (
    exists (
      select 1 from relatorios r
      where r.id = atividades.relatorio_id
        and tem_acesso_obra(r.obra_id)
        and r.status = 'enviado'
    )
  );

-- fotos
create policy fotos_owner_all on public.fotos
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy fotos_proprietario_select on public.fotos
  for select using (
    tem_acesso_obra(obra_id)
    and exists (
      select 1 from relatorios r
      where r.id = fotos.relatorio_id and r.status = 'enviado'
    )
  );

-- dias_aditivados
create policy dias_aditivados_owner_all on public.dias_aditivados
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy dias_aditivados_proprietario_select on public.dias_aditivados
  for select using (
    tem_acesso_obra(obra_id)
    and exists (
      select 1 from relatorios r
      where r.id = dias_aditivados.relatorio_id and r.status = 'enviado'
    )
  );

-- clima_snapshots
create policy clima_owner_all on public.clima_snapshots
  for all using (eh_dono_obra(obra_id)) with check (eh_dono_obra(obra_id));

create policy clima_proprietario_select on public.clima_snapshots
  for select using (tem_acesso_obra(obra_id));

-- webhooks_log / admins: só admin leitura
create policy webhooks_admin_select on public.webhooks_log
  for select using (is_admin());

create policy admins_admin_select on public.admins
  for select using (is_admin());

-- ===== Storage =====
insert into storage.buckets (id, name, public)
values
  ('capas', 'capas', false),
  ('fotos', 'fotos', false),
  ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

-- path prefix = obraId/
create policy storage_capas_owner on storage.objects
  for all using (
    bucket_id = 'capas'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  ) with check (
    bucket_id = 'capas'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  );

create policy storage_capas_proprietario on storage.objects
  for select using (
    bucket_id = 'capas'
    and tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );

create policy storage_fotos_owner on storage.objects
  for all using (
    bucket_id = 'fotos'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  ) with check (
    bucket_id = 'fotos'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  );

create policy storage_fotos_proprietario on storage.objects
  for select using (
    bucket_id = 'fotos'
    and tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );

create policy storage_pdfs_owner on storage.objects
  for all using (
    bucket_id = 'pdfs'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  ) with check (
    bucket_id = 'pdfs'
    and eh_dono_obra((storage.foldername(name))[1]::uuid)
  );

create policy storage_pdfs_proprietario on storage.objects
  for select using (
    bucket_id = 'pdfs'
    and tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );
