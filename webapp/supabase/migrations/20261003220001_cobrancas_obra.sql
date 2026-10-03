-- E2 do plano da tela de Cobrança (01/10/2026): cobrança por obra, etapa "expandir".
-- Decisões: planos-cursor-pre-lançamento/decisoes-financeiras-2026-09-28.md (seções 2.1, 2.2, 2.6, 2.7, 2.9).
--
-- Esta migration só ADICIONA: a tabela public.cobrancas_obra e as funções de permissão por obra.
-- Nenhum chamador existente é trocado; as funções atuais continuam usando
-- private.assinatura_permite_escrita (estado da conta). A troca para o estado por obra,
-- a gravação pelo webhook e os jobs são a etapa E3. A remoção de plano/limite_obras é a E5.

create type public.cobranca_status as enum (
  'ativa',
  'inadimplente',
  'cancelamento_agendado',
  'cancelada'
);

-- Uma linha por assinatura de obra no AbacatePay. Só nasce quando o provedor confirma
-- (webhook subscription.completed / subscription.trial_started), então sempre tem o id da assinatura.
create table public.cobrancas_obra (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete restrict,
  abacatepay_subscription_id text not null,
  abacatepay_checkout_id text,
  status public.cobranca_status not null default 'ativa',
  valor_centavos int not null check (valor_centavos > 0),
  periodo_inicio timestamptz not null default now(),
  periodo_fim timestamptz not null,
  -- Preenchida quando a primeira cobrança é adiada (produto com trialDays, regra Q1).
  primeira_cobranca_em timestamptz,
  inadimplente_desde timestamptz,
  cancelamento_solicitado_em timestamptz,
  acesso_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cobrancas_obra_periodo_ck check (periodo_fim > periodo_inicio),
  constraint cobrancas_obra_inadimplente_ck
    check (status <> 'inadimplente' or inadimplente_desde is not null),
  constraint cobrancas_obra_cancelamento_ck
    check (
      status <> 'cancelamento_agendado'
      or (acesso_ate is not null and cancelamento_solicitado_em is not null)
    )
);

create unique index cobrancas_obra_subscription_uidx
  on public.cobrancas_obra (abacatepay_subscription_id);

-- No máximo uma cobrança não cancelada por obra (reativar = nova linha depois de cancelada).
create unique index cobrancas_obra_obra_vigente_uidx
  on public.cobrancas_obra (obra_id)
  where status <> 'cancelada';

create index cobrancas_obra_user_idx on public.cobrancas_obra (user_id);

-- Mantém atualizado_em e garante que a cobrança pertence ao dono da obra.
create or replace function private.cobrancas_obra_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    select o.owner_id into v_owner from public.obras o where o.id = new.obra_id;
    if v_owner is null or v_owner <> new.user_id then
      raise exception 'COBRANCA_DONO_INVALIDO' using errcode = 'P0001';
    end if;
  else
    if new.user_id <> old.user_id or new.obra_id <> old.obra_id then
      raise exception 'COBRANCA_IMUTAVEL' using errcode = 'P0001';
    end if;
    new.atualizado_em := pg_catalog.now();
  end if;
  return new;
end;
$$;

create trigger cobrancas_obra_before_write
  before insert or update on public.cobrancas_obra
  for each row execute function private.cobrancas_obra_before_write();

alter table public.cobrancas_obra enable row level security;

create policy cobrancas_obra_select on public.cobrancas_obra
  for select to authenticated
  using (user_id = auth.uid());

-- Leitura pelo dono; a gravação é só por funções security definer / backend (E3).
grant select on public.cobrancas_obra to authenticated;

-- A obra tem cobrança vigente? Ativa, ou cancelada pelo usuário mas ainda dentro do período pago.
-- Inadimplente e cancelada não contam (obra somente leitura).
create or replace function private.obra_cobranca_vigente(
  p_obra uuid,
  p_agora timestamptz default pg_catalog.now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cobrancas_obra c
    where c.obra_id = p_obra
      and (
        c.status = 'ativa'
        or (c.status = 'cancelamento_agendado' and p_agora <= c.acesso_ate)
      )
  );
$$;

-- A obra aceita escrita (editar rascunho, enviar relatório, compartilhar)?
-- 1) cobrança vigente da própria obra;
-- 2) a obra do trial, dentro do prazo (o trial tem uma obra);
-- 3) legado, só durante a fase expandir: conta com status 'ativa' do modelo antigo e obra SEM
--    nenhuma cobrança registrada (uma obra inadimplente ou cancelada nunca cai nesta regra).
create or replace function private.obra_permite_escrita(p_obra uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_ass public.assinaturas%rowtype;
begin
  select o.owner_id into v_owner from public.obras o where o.id = p_obra;
  if v_owner is null then
    return false;
  end if;

  if private.obra_cobranca_vigente(p_obra) then
    return true;
  end if;

  select * into v_ass from public.assinaturas s where s.user_id = v_owner;
  if not found then
    return false;
  end if;

  if v_ass.status = 'trial' then
    return v_ass.trial_fim is not null and pg_catalog.now() <= v_ass.trial_fim;
  end if;

  if v_ass.status = 'ativa' then
    return not exists (
      select 1 from public.cobrancas_obra c where c.obra_id = p_obra
    );
  end if;

  return false;
end;
$$;

revoke all on function private.cobrancas_obra_before_write() from public, anon, authenticated;
revoke all on function private.obra_cobranca_vigente(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.obra_permite_escrita(uuid) from public, anon, authenticated;
