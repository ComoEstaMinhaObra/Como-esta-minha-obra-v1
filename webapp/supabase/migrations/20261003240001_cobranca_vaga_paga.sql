-- E4 do plano da tela de Cobrança (03/10/2026): período pago aproveitável (regra Q1).
-- Decisões: planos-cursor-pre-lançamento/decisoes-financeiras-2026-09-28.md (2.2, Q1).
--
-- Arquivar uma obra encerra a renovação da cobrança dela, com recursos até o fim do período já
-- pago. Se o usuário cria outra obra dentro desse período, a obra nova abre uma assinatura nova
-- cuja primeira cobrança é o fim do período pago da arquivada. Cada período pago aproveitável vale
-- para uma única obra nova.

alter table public.cobrancas_obra
  add column periodo_aproveitado_por_obra_id uuid references public.obras(id) on delete set null;

-- Um período pago só é aproveitado por uma obra, e uma obra só aproveita um período.
create unique index cobrancas_obra_aproveitado_uidx
  on public.cobrancas_obra (periodo_aproveitado_por_obra_id)
  where periodo_aproveitado_por_obra_id is not null;

-- Há período pago aproveitável? Cobrança com cancelamento agendado de obra arquivada, ainda dentro
-- do período pago e ainda não aproveitada. Escolhe a de fim mais distante. "dias" é o número de
-- dias inteiros (arredondado para cima) até o fim do período, que vira o trialDays do produto.
create or replace function public.fn_vaga_paga_disponivel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_ate timestamptz;
  v_dias int;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select c.id, c.acesso_ate
  into v_id, v_ate
  from public.cobrancas_obra c
  join public.obras o on o.id = c.obra_id
  where c.user_id = v_user
    and c.status = 'cancelamento_agendado'
    and o.arquivada_em is not null
    and c.periodo_aproveitado_por_obra_id is null
    and c.acesso_ate > pg_catalog.now()
  order by c.acesso_ate desc
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('disponivel', false);
  end if;

  v_dias := pg_catalog.ceil(extract(epoch from (v_ate - pg_catalog.now())) / 86400.0)::int;
  return pg_catalog.jsonb_build_object(
    'disponivel', v_dias >= 1,
    'cobrancaId', v_id,
    'acessoAte', v_ate,
    'dias', v_dias
  );
end;
$$;

revoke all on function public.fn_vaga_paga_disponivel() from public, anon;
grant execute on function public.fn_vaga_paga_disponivel() to authenticated;

-- fn_cobranca_registrar passa a marcar o período aproveitado quando a primeira cobrança é adiada.
-- O payload do webhook não diz qual período foi usado; o fim do trial (fim do dia, UTC) fica no
-- máximo 2 dias depois do acesso_ate da cobrança arquivada, o que identifica a cobrança de origem.
create or replace function public.fn_cobranca_registrar(
  p_obra uuid,
  p_subscription_id text,
  p_checkout_id text,
  p_valor_centavos int,
  p_periodo_inicio timestamptz,
  p_periodo_fim timestamptz,
  p_primeira_cobranca_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra public.obras%rowtype;
  v_existente public.cobrancas_obra%rowtype;
  v_id uuid;
begin
  select * into v_obra from public.obras o where o.id = p_obra;
  if not found then
    raise exception 'OBRA_AUSENTE';
  end if;

  select * into v_existente
  from public.cobrancas_obra c
  where c.abacatepay_subscription_id = p_subscription_id
  for update;
  if found then
    if v_existente.obra_id <> p_obra then
      raise exception 'COBRANCA_OBRA_DIVERGENTE';
    end if;
    return pg_catalog.jsonb_build_object(
      'id', v_existente.id, 'criada', false, 'status', v_existente.status
    );
  end if;

  -- Outra cobrança não cancelada da mesma obra: possível pagamento em duplicidade.
  if exists (
    select 1 from public.cobrancas_obra c
    where c.obra_id = p_obra and c.status <> 'cancelada'
  ) then
    raise exception 'COBRANCA_DUPLICADA';
  end if;

  insert into public.cobrancas_obra (
    user_id, obra_id, abacatepay_subscription_id, abacatepay_checkout_id,
    status, valor_centavos, periodo_inicio, periodo_fim, primeira_cobranca_em
  ) values (
    v_obra.owner_id, p_obra, p_subscription_id, p_checkout_id,
    'ativa', p_valor_centavos, p_periodo_inicio, p_periodo_fim, p_primeira_cobranca_em
  )
  returning id into v_id;

  if p_primeira_cobranca_em is not null then
    update public.cobrancas_obra
    set periodo_aproveitado_por_obra_id = p_obra
    where id = (
      select c2.id
      from public.cobrancas_obra c2
      join public.obras o2 on o2.id = c2.obra_id
      where c2.user_id = v_obra.owner_id
        and c2.id <> v_id
        and c2.status = 'cancelamento_agendado'
        and o2.arquivada_em is not null
        and c2.periodo_aproveitado_por_obra_id is null
        and c2.acesso_ate between p_primeira_cobranca_em - interval '2 days' and p_primeira_cobranca_em
      order by c2.acesso_ate desc
      limit 1
    );
  end if;

  return pg_catalog.jsonb_build_object('id', v_id, 'criada', true, 'status', 'ativa');
end;
$$;
