-- Programa de afiliados (v1): desconto do link para o indicado.
--
-- O Mercado Pago só aceita um valor por assinatura, então o desconto reduz o valor da assinatura da
-- obra. "Permanente": todas as obras do indicado nascem com o desconto. "Primeira fatura": o desconto
-- fica reservado a UMA obra (a primeira que o indicado contrata) e o app devolve a assinatura ao
-- preço cheio depois do 1º pagamento dela (fn_afiliado_registrar_pagamento devolve `reverter`).
--
-- O preço de tabela vem do app (env); as funções só fazem a conta. Todas são backend (service_role):
-- o app passa o usuário já autenticado, nunca o cliente decide o valor.

-- Calcula (e, se pedido, reserva) o desconto de uma obra do indicado.
create or replace function public.fn_afiliado_desconto_obra(
  p_user uuid,
  p_obra uuid,
  p_preco_centavos int,
  p_reservar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ind private.indicacoes%rowtype;
  v_desc int;
begin
  if p_preco_centavos is null or p_preco_centavos <= 0 then
    raise exception 'VALOR_INVALIDO';
  end if;
  if not exists (select 1 from public.obras o where o.id = p_obra and o.owner_id = p_user) then
    raise exception 'SEM_PERMISSAO';
  end if;

  if p_reservar then
    select * into v_ind from private.indicacoes i where i.indicado_id = p_user for update;
  else
    select * into v_ind from private.indicacoes i where i.indicado_id = p_user;
  end if;
  if not found or v_ind.desconto_bps = 0 or v_ind.desconto_duracao is null then
    return pg_catalog.jsonb_build_object('descontoCentavos', 0);
  end if;

  v_desc := pg_catalog.round(
    (p_preco_centavos::numeric * v_ind.desconto_bps::numeric) / 10000
  )::int;

  if v_ind.desconto_duracao = 'primeira_fatura' then
    if v_ind.desconto_revertido_em is not null then
      return pg_catalog.jsonb_build_object('descontoCentavos', 0);
    end if;
    if v_ind.desconto_obra_id is not null then
      -- já reservado: vale só para aquela obra, no valor gravado
      if v_ind.desconto_obra_id <> p_obra then
        return pg_catalog.jsonb_build_object('descontoCentavos', 0);
      end if;
      v_desc := coalesce(v_ind.desconto_centavos, v_desc);
    else
      if v_ind.primeiro_pagamento_id is not null then
        return pg_catalog.jsonb_build_object('descontoCentavos', 0);
      end if;
      if p_reservar and v_desc > 0 then
        update private.indicacoes
        set desconto_obra_id = p_obra,
            desconto_centavos = v_desc
        where indicado_id = p_user;
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'descontoCentavos', v_desc,
    'descontoBps', v_ind.desconto_bps,
    'duracao', v_ind.desconto_duracao
  );
end;
$$;

revoke all on function public.fn_afiliado_desconto_obra(uuid, uuid, int, boolean)
  from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_obra(uuid, uuid, int, boolean) to service_role;

-- Devolve a reserva quando a assinatura não chegou a ser criada (cartão recusado) e nada foi pago.
create or replace function public.fn_afiliado_desconto_liberar(p_user uuid, p_obra uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.indicacoes
  set desconto_obra_id = null,
      desconto_centavos = null
  where indicado_id = p_user
    and desconto_obra_id = p_obra
    and primeiro_pagamento_id is null
    and desconto_revertido_em is null;
$$;

revoke all on function public.fn_afiliado_desconto_liberar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_liberar(uuid, uuid) to service_role;

-- Desconto em vigor numa assinatura já registrada (piso do valor ao mexer no e-mail adicional).
create or replace function public.fn_afiliado_desconto_assinatura(
  p_subscription_id text,
  p_preco_centavos int
)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.cobrancas_obra%rowtype;
  v_ind private.indicacoes%rowtype;
begin
  select * into v_c from public.cobrancas_obra c where c.provedor_assinatura_id = p_subscription_id;
  if not found then
    return 0;
  end if;
  select * into v_ind from private.indicacoes i where i.indicado_id = v_c.user_id;
  if not found or v_ind.desconto_bps = 0 or v_ind.desconto_duracao is null then
    return 0;
  end if;

  if v_ind.desconto_duracao = 'permanente' then
    return pg_catalog.round(
      (p_preco_centavos::numeric * v_ind.desconto_bps::numeric) / 10000
    )::int;
  end if;

  if v_ind.desconto_obra_id = v_c.obra_id and v_ind.desconto_revertido_em is null then
    return coalesce(v_ind.desconto_centavos, 0);
  end if;
  return 0;
end;
$$;

revoke all on function public.fn_afiliado_desconto_assinatura(text, int) from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_assinatura(text, int) to service_role;

-- Grava (uma única vez) o valor absoluto a que a assinatura volta ao preço cheio e devolve o valor
-- gravado. Quem repete a reversão manda sempre o mesmo valor ao provedor.
create or replace function public.fn_afiliado_desconto_reversao_alvo(p_obra uuid, p_alvo_centavos int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_alvo int;
begin
  if p_alvo_centavos is null or p_alvo_centavos <= 0 then
    raise exception 'VALOR_INVALIDO';
  end if;
  select o.owner_id into v_owner from public.obras o where o.id = p_obra;

  update private.indicacoes
  set desconto_reversao_alvo_centavos = coalesce(desconto_reversao_alvo_centavos, p_alvo_centavos)
  where indicado_id = v_owner
    and desconto_obra_id = p_obra
    and desconto_revertido_em is null
  returning desconto_reversao_alvo_centavos into v_alvo;

  return v_alvo;
end;
$$;

revoke all on function public.fn_afiliado_desconto_reversao_alvo(uuid, int) from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_reversao_alvo(uuid, int) to service_role;

-- Marca o desconto da obra como devolvido ao preço cheio.
create or replace function public.fn_afiliado_desconto_revertido(p_obra uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.indicacoes i
  set desconto_revertido_em = pg_catalog.now()
  from public.obras o
  where o.id = p_obra
    and i.indicado_id = o.owner_id
    and i.desconto_obra_id = p_obra
    and i.desconto_revertido_em is null;
$$;

revoke all on function public.fn_afiliado_desconto_revertido(uuid) from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_revertido(uuid) to service_role;

-- Rede de segurança do job diário: descontos de 1ª fatura ainda não devolvidos, com a assinatura
-- viva da obra reservada. O app confere no provedor se a 1ª cobrança já aconteceu.
create or replace function public.fn_afiliado_descontos_a_reverter(p_limite int default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(t.item), '[]'::jsonb)
  from (
    select pg_catalog.jsonb_build_object(
      'obraId', i.desconto_obra_id,
      'subscriptionId', c.provedor_assinatura_id,
      'descontoCentavos', i.desconto_centavos,
      'alvoCentavos', i.desconto_reversao_alvo_centavos
    ) as item
    from private.indicacoes i
    join public.cobrancas_obra c on c.obra_id = i.desconto_obra_id and c.status <> 'cancelada'
    where i.desconto_duracao = 'primeira_fatura'
      and i.desconto_obra_id is not null
      and i.desconto_revertido_em is null
      and i.desconto_centavos is not null
    order by i.criado_em
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
  ) t;
$$;

revoke all on function public.fn_afiliado_descontos_a_reverter(int) from public, anon, authenticated;
grant execute on function public.fn_afiliado_descontos_a_reverter(int) to service_role;
