-- Programa de afiliados (v1): atribuição do cadastro ao link e comissão por pagamento.

-- ===== helpers privados =====
create or replace function private.afiliado_saldo(
  p_afiliado uuid,
  p_agora timestamptz default pg_catalog.now()
)
returns table (disponivel_centavos bigint, pendente_centavos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(l.valor_centavos) filter (where l.disponivel_em <= p_agora), 0)::bigint,
    coalesce(sum(l.valor_centavos) filter (where l.disponivel_em > p_agora), 0)::bigint
  from private.afiliado_lancamentos l
  where l.afiliado_id = p_afiliado;
$$;

revoke all on function private.afiliado_saldo(uuid, timestamptz) from public, anon, authenticated;

-- ===== atribuição no cadastro (e-mail + senha) =====
-- O código viaja em raw_user_meta_data->>'ref' (signUp). É um trigger SEPARADO de handle_new_user:
-- um erro aqui nunca pode derrubar o cadastro, então tudo roda dentro de um bloco que engole
-- exceções. Dispara depois de on_auth_user_created (ordem alfabética), que cria o profile exigido
-- pela FK de indicacoes.
create or replace function private.registrar_indicacao_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_link private.afiliado_links%rowtype;
begin
  begin
    v_codigo := pg_catalog.lower(pg_catalog.btrim(coalesce(new.raw_user_meta_data->>'ref', '')));
    if v_codigo ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
      select * into v_link
      from private.afiliado_links l
      where l.codigo = v_codigo and l.ativo;
      if found and v_link.afiliado_id <> new.id then
        insert into private.indicacoes (
          indicado_id, link_id, afiliado_id, comissao_bps, comissao_vitalicia,
          desconto_bps, desconto_duracao, origem
        )
        values (
          new.id, v_link.id, v_link.afiliado_id, v_link.comissao_bps, v_link.comissao_vitalicia,
          v_link.desconto_bps, v_link.desconto_duracao, 'cadastro'
        )
        on conflict (indicado_id) do nothing;
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function private.registrar_indicacao_signup() from public, anon, authenticated;

create trigger on_auth_user_created_indicacao
  after insert on auth.users
  for each row execute function private.registrar_indicacao_signup();

-- ===== atribuição pelo callback (login social / confirmação no mesmo navegador) =====
-- Só vale para conta recém-criada (≤ 1h): quem já era usuário e clica num link não é indicado.
create or replace function public.fn_afiliado_registrar_indicacao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_codigo text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_codigo, '')));
  v_link private.afiliado_links%rowtype;
  v_criado timestamptz;
  v_linhas int;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if exists (select 1 from private.indicacoes i where i.indicado_id = v_user) then
    return pg_catalog.jsonb_build_object('atribuida', false, 'motivo', 'JA_INDICADO');
  end if;

  if v_codigo !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
    return pg_catalog.jsonb_build_object('atribuida', false, 'motivo', 'LINK_INVALIDO');
  end if;

  select * into v_link
  from private.afiliado_links l
  where l.codigo = v_codigo and l.ativo;
  if not found then
    return pg_catalog.jsonb_build_object('atribuida', false, 'motivo', 'LINK_INVALIDO');
  end if;

  if v_link.afiliado_id = v_user then
    return pg_catalog.jsonb_build_object('atribuida', false, 'motivo', 'AUTOINDICACAO');
  end if;

  select u.created_at into v_criado from auth.users u where u.id = v_user;
  if v_criado is null or v_criado < pg_catalog.now() - interval '1 hour' then
    return pg_catalog.jsonb_build_object('atribuida', false, 'motivo', 'CONTA_ANTIGA');
  end if;

  insert into private.indicacoes (
    indicado_id, link_id, afiliado_id, comissao_bps, comissao_vitalicia,
    desconto_bps, desconto_duracao, origem
  )
  values (
    v_user, v_link.id, v_link.afiliado_id, v_link.comissao_bps, v_link.comissao_vitalicia,
    v_link.desconto_bps, v_link.desconto_duracao, 'callback'
  )
  on conflict (indicado_id) do nothing;
  get diagnostics v_linhas = row_count;

  return pg_catalog.jsonb_build_object('atribuida', v_linhas > 0);
end;
$$;

revoke all on function public.fn_afiliado_registrar_indicacao(text) from public, anon;
grant execute on function public.fn_afiliado_registrar_indicacao(text) to authenticated;

-- ===== link público (tela de cadastro) =====
-- Só o que a tela precisa: se o link vale e qual é o desconto. Nunca a identidade do afiliado.
create or replace function public.fn_afiliado_link_publico(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select pg_catalog.jsonb_build_object(
        'valido', true,
        'descontoBps', l.desconto_bps,
        'descontoDuracao', l.desconto_duracao
      )
      from private.afiliado_links l
      where l.codigo = pg_catalog.lower(pg_catalog.btrim(coalesce(p_codigo, ''))) and l.ativo
    ),
    pg_catalog.jsonb_build_object('valido', false)
  );
$$;

revoke all on function public.fn_afiliado_link_publico(text) from public, anon, authenticated;
grant execute on function public.fn_afiliado_link_publico(text) to service_role;

-- ===== comissão por pagamento =====
-- Chamada pelo webhook a cada parcela aprovada. Idempotente por id do pagamento do provedor.
-- O dono da obra vem de obras.owner_id (não depende de a cobrança já estar registrada).
-- Devolve `reverter` enquanto o desconto de 1ª fatura da obra ainda precisa voltar ao preço cheio.
create or replace function public.fn_afiliado_registrar_pagamento(
  p_obra uuid,
  p_pagamento_id text,
  p_valor_centavos int,
  p_agora timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_ind private.indicacoes%rowtype;
  v_cfg private.afiliados_config%rowtype;
  v_primeiro boolean := false;
  v_comissao int := 0;
  v_registrada boolean := false;
  v_reverter jsonb := null;
begin
  if p_pagamento_id is null or pg_catalog.btrim(p_pagamento_id) = ''
     or p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'PAGAMENTO_INVALIDO';
  end if;

  select o.owner_id into v_owner from public.obras o where o.id = p_obra;
  if v_owner is null then
    return pg_catalog.jsonb_build_object('registrada', false, 'motivo', 'OBRA_AUSENTE');
  end if;

  -- serializa os pagamentos do mesmo indicado (webhooks de estados diferentes da mesma parcela)
  select * into v_ind from private.indicacoes i where i.indicado_id = v_owner for update;
  if not found then
    return pg_catalog.jsonb_build_object('registrada', false, 'motivo', 'SEM_INDICACAO');
  end if;

  if v_ind.desconto_duracao = 'primeira_fatura'
     and v_ind.desconto_obra_id = p_obra
     and v_ind.desconto_revertido_em is null
     and v_ind.desconto_centavos is not null then
    v_reverter := pg_catalog.jsonb_build_object(
      'descontoCentavos', v_ind.desconto_centavos,
      'alvoCentavos', v_ind.desconto_reversao_alvo_centavos
    );
  end if;

  if v_ind.primeiro_pagamento_id is not distinct from p_pagamento_id
     or exists (
       select 1 from private.afiliado_lancamentos l
       where l.tipo = 'comissao' and l.provedor_pagamento_id = p_pagamento_id
     ) then
    -- repetição de um pagamento já tratado
    return pg_catalog.jsonb_build_object(
      'registrada', false, 'motivo', 'JA_REGISTRADO', 'reverter', v_reverter
    );
  end if;

  v_primeiro := v_ind.primeiro_pagamento_id is null;
  if v_primeiro then
    update private.indicacoes
    set primeiro_pagamento_id = p_pagamento_id,
        primeiro_pagamento_em = p_agora
    where indicado_id = v_owner;
  end if;

  if (v_ind.comissao_vitalicia or v_primeiro) and v_ind.comissao_bps > 0 then
    v_comissao := pg_catalog.round(
      (p_valor_centavos::numeric * v_ind.comissao_bps::numeric) / 10000
    )::int;
    if v_comissao > 0 then
      select * into v_cfg from private.afiliados_config limit 1;
      insert into private.afiliado_lancamentos (
        afiliado_id, tipo, valor_centavos, disponivel_em, link_id, indicado_id,
        provedor_pagamento_id, valor_base_centavos, comissao_bps
      )
      values (
        v_ind.afiliado_id, 'comissao', v_comissao,
        p_agora + pg_catalog.make_interval(days => v_cfg.carencia_dias),
        v_ind.link_id, v_owner, p_pagamento_id, p_valor_centavos, v_ind.comissao_bps
      );
      v_registrada := true;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'registrada', v_registrada,
    'primeiraFatura', v_primeiro,
    'comissaoCentavos', v_comissao,
    'reverter', v_reverter
  );
end;
$$;

revoke all on function public.fn_afiliado_registrar_pagamento(uuid, text, int, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_afiliado_registrar_pagamento(uuid, text, int, timestamptz)
  to service_role;
