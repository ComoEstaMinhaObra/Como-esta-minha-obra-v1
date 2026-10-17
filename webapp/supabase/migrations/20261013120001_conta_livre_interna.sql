-- Conta interna/cortesia para demonstração e testes, sem cobranças fictícias.
-- A flag fica na assinatura (uma por usuário) e não é gravável pelo cliente.

alter table public.assinaturas
  add column if not exists conta_livre boolean not null default false;

comment on column public.assinaturas.conta_livre is
  'Libera obras e relatórios sem cobrança; uso interno/cortesia.';

-- Promove a conta se ela já existir.
update public.assinaturas s
set conta_livre = true,
    status = 'ativa',
    trial_fim = null,
    atualizado_em = pg_catalog.now()
from auth.users u
where u.id = s.user_id
  and lower(u.email) = 'contato@comoestaminhaobra.com.br';

-- A conta também nasce livre se o cadastro for feito depois desta migration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta_livre boolean := lower(coalesce(new.email, '')) =
    'contato@comoestaminhaobra.com.br';
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'nome'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'name'), ''),
      ''
    )
  );

  insert into public.assinaturas (user_id, status, trial_fim, conta_livre)
  values (
    new.id,
    case when v_conta_livre then 'ativa'::public.assinatura_status
         else 'trial'::public.assinatura_status end,
    case when v_conta_livre then null else pg_catalog.now() + interval '14 days' end,
    v_conta_livre
  );

  if new.email_confirmed_at is not null
     or coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then
    update public.obra_acessos
    set user_id = new.id,
        status = 'ativo'
    where lower(email::text) = lower(new.email)
      and user_id is null
      and status = 'convidado';
  end if;

  return new;
end;
$$;

-- Escrita em qualquer obra da conta livre, independentemente do histórico de cobrança.
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

  select * into v_ass from public.assinaturas s where s.user_id = v_owner;
  if not found then
    return false;
  end if;

  if v_ass.conta_livre then
    return true;
  end if;

  if private.obra_cobranca_vigente(p_obra) then
    return true;
  end if;

  if exists (select 1 from public.cobrancas_obra c where c.obra_id = p_obra) then
    return false;
  end if;

  return v_ass.status = 'trial'
    and v_ass.trial_fim is not null
    and pg_catalog.now() <= v_ass.trial_fim
    and not exists (select 1 from public.cobrancas_obra c where c.user_id = v_owner);
end;
$$;

revoke all on function private.obra_permite_escrita(uuid) from public, anon, authenticated;

-- fn_criar_obra já usa esta função para decidir se há limite de uma obra.
create or replace function private.usuario_tem_cobranca_vigente(
  p_user uuid,
  p_agora timestamptz default pg_catalog.now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.assinaturas s
      where s.user_id = p_user and s.conta_livre
    )
    or exists (
      select 1
      from public.cobrancas_obra c
      where c.user_id = p_user
        and (
          c.status = 'ativa'
          or (c.status = 'cancelamento_agendado' and p_agora <= c.acesso_ate)
        )
    );
$$;

revoke all on function private.usuario_tem_cobranca_vigente(uuid, timestamptz)
  from public, anon, authenticated;
