-- Programa de afiliados (v1): painel do afiliado, saque via Pix e RPCs do admin.
-- Todas security definer com search_path vazio; anon nunca executa.

-- ===== afiliado =====
create or replace function public.fn_sou_afiliado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.afiliado_links l where l.afiliado_id = auth.uid()
  );
$$;

revoke all on function public.fn_sou_afiliado() from public, anon;
grant execute on function public.fn_sou_afiliado() to authenticated;

create or replace function public.fn_afiliado_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cfg private.afiliados_config%rowtype;
  v_saldo record;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if not exists (select 1 from private.afiliado_links l where l.afiliado_id = v_user) then
    return pg_catalog.jsonb_build_object('afiliado', false);
  end if;

  select * into v_cfg from private.afiliados_config limit 1;
  select * into v_saldo from private.afiliado_saldo(v_user);

  return pg_catalog.jsonb_build_object(
    'afiliado', true,
    'config', pg_catalog.jsonb_build_object(
      'carenciaDias', v_cfg.carencia_dias,
      'saqueMinimoCentavos', v_cfg.saque_minimo_centavos
    ),
    'saldo', pg_catalog.jsonb_build_object(
      'disponivelCentavos', v_saldo.disponivel_centavos,
      'pendenteCentavos', v_saldo.pendente_centavos,
      'recebidoCentavos', coalesce((
        select sum(s.valor_centavos) from private.afiliado_saques s
        where s.afiliado_id = v_user and s.status = 'pago'
      ), 0),
      'totalGanhoCentavos', coalesce((
        select sum(l.valor_centavos) from private.afiliado_lancamentos l
        where l.afiliado_id = v_user and l.tipo in ('comissao', 'estorno')
      ), 0)
    ),
    'saqueAberto', exists (
      select 1 from private.afiliado_saques s
      where s.afiliado_id = v_user and s.status = 'solicitado'
    ),
    'links', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', l.id,
          'codigo', l.codigo,
          'rotulo', l.rotulo,
          'ativo', l.ativo,
          'comissaoBps', l.comissao_bps,
          'vitalicia', l.comissao_vitalicia,
          'descontoBps', l.desconto_bps,
          'descontoDuracao', l.desconto_duracao,
          'cadastros', (
            select count(*) from private.indicacoes i where i.link_id = l.id
          ),
          'assinantes', (
            select count(*) from private.indicacoes i
            where i.link_id = l.id and i.primeiro_pagamento_id is not null
          ),
          'ativos', (
            select count(*) from private.indicacoes i
            where i.link_id = l.id
              and exists (
                select 1 from public.cobrancas_obra c
                where c.user_id = i.indicado_id and c.status = 'ativa'
              )
          ),
          'ganhosCentavos', coalesce((
            select sum(x.valor_centavos) from private.afiliado_lancamentos x
            where x.link_id = l.id and x.tipo in ('comissao', 'estorno')
          ), 0)
        )
        order by l.criado_em
      )
      from private.afiliado_links l
      where l.afiliado_id = v_user
    ), '[]'::jsonb),
    'comissoes', coalesce((
      select pg_catalog.jsonb_agg(t.item order by t.criado_em desc)
      from (
        select
          l.criado_em,
          pg_catalog.jsonb_build_object(
            'id', l.id,
            'em', l.criado_em,
            'linkCodigo', lk.codigo,
            'valorCentavos', l.valor_centavos,
            'disponivelEm', l.disponivel_em,
            'status', case
              when exists (
                select 1 from private.afiliado_lancamentos e
                where e.tipo = 'estorno' and e.ref_lancamento_id = l.id
              ) then 'estornada'
              when l.disponivel_em > pg_catalog.now() then 'pendente'
              else 'disponivel'
            end
          ) as item
        from private.afiliado_lancamentos l
        join private.afiliado_links lk on lk.id = l.link_id
        where l.afiliado_id = v_user and l.tipo = 'comissao'
        order by l.criado_em desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'saques', coalesce((
      select pg_catalog.jsonb_agg(t.item order by t.solicitado_em desc)
      from (
        select
          s.solicitado_em,
          pg_catalog.jsonb_build_object(
            'id', s.id,
            'valorCentavos', s.valor_centavos,
            'status', s.status,
            'tipoChave', s.tipo_chave,
            'chaveMascarada', case
              when s.tipo_chave = 'email' then
                pg_catalog.left(s.chave_pix, 1) || '***'
                || pg_catalog.substr(s.chave_pix, pg_catalog.strpos(s.chave_pix, '@'))
              else '••••' || pg_catalog.right(s.chave_pix, 4)
            end,
            'solicitadoEm', s.solicitado_em,
            'resolvidoEm', s.resolvido_em,
            'observacao', s.observacao
          ) as item
        from private.afiliado_saques s
        where s.afiliado_id = v_user
        order by s.solicitado_em desc
        limit 50
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fn_afiliado_painel() from public, anon;
grant execute on function public.fn_afiliado_painel() to authenticated;

-- Saque = todo o saldo disponível. A chave é normalizada aqui; o dígito verificador de CPF/CNPJ é
-- conferido no app. O saldo fica reservado no ledger na hora do pedido.
create or replace function public.fn_afiliado_solicitar_saque(
  p_tipo_chave text,
  p_chave text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_chave text := pg_catalog.btrim(coalesce(p_chave, ''));
  v_cfg private.afiliados_config%rowtype;
  v_disponivel bigint;
  v_saque uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  case p_tipo_chave
    when 'cpf' then
      v_chave := pg_catalog.regexp_replace(v_chave, '\D', '', 'g');
      if v_chave !~ '^[0-9]{11}$' then raise exception 'CHAVE_PIX_INVALIDA'; end if;
    when 'cnpj' then
      v_chave := pg_catalog.regexp_replace(v_chave, '\D', '', 'g');
      if v_chave !~ '^[0-9]{14}$' then raise exception 'CHAVE_PIX_INVALIDA'; end if;
    when 'telefone' then
      v_chave := pg_catalog.regexp_replace(v_chave, '[^0-9+]', '', 'g');
      if v_chave !~ '^\+?[0-9]{10,13}$' then raise exception 'CHAVE_PIX_INVALIDA'; end if;
    when 'email' then
      v_chave := pg_catalog.lower(v_chave);
      if v_chave !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
         or pg_catalog.char_length(v_chave) > 77 then
        raise exception 'CHAVE_PIX_INVALIDA';
      end if;
    when 'aleatoria' then
      v_chave := pg_catalog.lower(v_chave);
      if v_chave !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'CHAVE_PIX_INVALIDA';
      end if;
    else
      raise exception 'CHAVE_PIX_INVALIDA';
  end case;

  -- serializa os pedidos do mesmo afiliado (duplo clique, duas abas)
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('afiliado_saque:' || v_user::text, 0)
  );

  if exists (
    select 1 from private.afiliado_saques s
    where s.afiliado_id = v_user and s.status = 'solicitado'
  ) then
    raise exception 'SAQUE_EM_ABERTO';
  end if;

  select * into v_cfg from private.afiliados_config limit 1;
  select d.disponivel_centavos into v_disponivel from private.afiliado_saldo(v_user) d;

  if v_disponivel <= 0 then
    raise exception 'SALDO_INSUFICIENTE';
  end if;
  if v_disponivel < v_cfg.saque_minimo_centavos then
    raise exception 'SAQUE_MINIMO';
  end if;

  insert into private.afiliado_saques (afiliado_id, valor_centavos, tipo_chave, chave_pix)
  values (v_user, v_disponivel::int, p_tipo_chave, v_chave)
  returning id into v_saque;

  insert into private.afiliado_lancamentos (
    afiliado_id, tipo, valor_centavos, disponivel_em, saque_id
  )
  values (v_user, 'saque', -v_disponivel::int, pg_catalog.now(), v_saque);

  return pg_catalog.jsonb_build_object('saqueId', v_saque, 'valorCentavos', v_disponivel);
end;
$$;

revoke all on function public.fn_afiliado_solicitar_saque(text, text) from public, anon;
grant execute on function public.fn_afiliado_solicitar_saque(text, text) to authenticated;

-- ===== admin =====
create or replace function public.fn_admin_afiliados()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg private.afiliados_config%rowtype;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  select * into v_cfg from private.afiliados_config limit 1;

  return pg_catalog.jsonb_build_object(
    'config', pg_catalog.jsonb_build_object(
      'carenciaDias', v_cfg.carencia_dias,
      'saqueMinimoCentavos', v_cfg.saque_minimo_centavos
    ),
    'resumo', pg_catalog.jsonb_build_object(
      'saquesPendentes', (
        select count(*) from private.afiliado_saques s where s.status = 'solicitado'
      ),
      'saquesPendentesCentavos', coalesce((
        select sum(s.valor_centavos) from private.afiliado_saques s where s.status = 'solicitado'
      ), 0),
      'saldoAfiliadosCentavos', coalesce((
        select sum(l.valor_centavos) from private.afiliado_lancamentos l
      ), 0)
    ),
    'links', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', l.id,
          'codigo', l.codigo,
          'rotulo', l.rotulo,
          'ativo', l.ativo,
          'afiliadoId', l.afiliado_id,
          'afiliadoNome', pg_catalog.left(coalesce(p.nome, ''), 80),
          'afiliadoEmail', private.email_do_usuario(l.afiliado_id),
          'comissaoBps', l.comissao_bps,
          'vitalicia', l.comissao_vitalicia,
          'descontoBps', l.desconto_bps,
          'descontoDuracao', l.desconto_duracao,
          'criadoEm', l.criado_em,
          'cadastros', (
            select count(*) from private.indicacoes i where i.link_id = l.id
          ),
          'assinantes', (
            select count(*) from private.indicacoes i
            where i.link_id = l.id and i.primeiro_pagamento_id is not null
          ),
          'ganhosCentavos', coalesce((
            select sum(x.valor_centavos) from private.afiliado_lancamentos x
            where x.link_id = l.id and x.tipo in ('comissao', 'estorno')
          ), 0)
        )
        order by l.criado_em desc
      )
      from private.afiliado_links l
      join public.profiles p on p.id = l.afiliado_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fn_admin_afiliados() from public, anon;
grant execute on function public.fn_admin_afiliados() to authenticated;

create or replace function public.fn_admin_buscar_usuario(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nome text;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  v_id := private.user_id_por_email(pg_catalog.btrim(coalesce(p_email, '')));
  if v_id is null then
    return pg_catalog.jsonb_build_object('encontrado', false);
  end if;

  select pg_catalog.left(coalesce(p.nome, ''), 80) into v_nome
  from public.profiles p where p.id = v_id;

  return pg_catalog.jsonb_build_object(
    'encontrado', true,
    'id', v_id,
    'nome', coalesce(v_nome, ''),
    'email', private.email_do_usuario(v_id)
  );
end;
$$;

revoke all on function public.fn_admin_buscar_usuario(text) from public, anon;
grant execute on function public.fn_admin_buscar_usuario(text) to authenticated;

create or replace function public.fn_admin_afiliado_criar_link(
  p_afiliado uuid,
  p_codigo text,
  p_rotulo text,
  p_comissao_bps int,
  p_vitalicia boolean,
  p_desconto_bps int,
  p_desconto_duracao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_codigo, '')));
  v_desconto int := coalesce(p_desconto_bps, 0);
  v_duracao text := case when coalesce(p_desconto_bps, 0) = 0 then null else p_desconto_duracao end;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  if v_codigo !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
    raise exception 'CODIGO_INVALIDO';
  end if;
  if p_comissao_bps is null or p_comissao_bps < 0 or p_comissao_bps > 10000
     or p_vitalicia is null then
    raise exception 'COMISSAO_INVALIDA';
  end if;
  if v_desconto < 0 or v_desconto > 9000
     or (v_desconto > 0 and coalesce(v_duracao, '') not in ('primeira_fatura', 'permanente')) then
    raise exception 'DESCONTO_INVALIDO';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_afiliado) then
    raise exception 'AFILIADO_NAO_ENCONTRADO';
  end if;

  begin
    insert into private.afiliado_links (
      afiliado_id, codigo, rotulo, comissao_bps, comissao_vitalicia, desconto_bps, desconto_duracao
    )
    values (
      p_afiliado, v_codigo, pg_catalog.left(pg_catalog.btrim(coalesce(p_rotulo, '')), 80),
      p_comissao_bps, p_vitalicia, v_desconto, v_duracao
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'CODIGO_EM_USO';
  end;

  return pg_catalog.jsonb_build_object('id', v_id, 'codigo', v_codigo);
end;
$$;

revoke all on function public.fn_admin_afiliado_criar_link(uuid, text, text, int, boolean, int, text)
  from public, anon;
grant execute on function public.fn_admin_afiliado_criar_link(uuid, text, text, int, boolean, int, text)
  to authenticated;

-- Editar um link só vale para novos cadastros (os termos ficam congelados na indicação).
create or replace function public.fn_admin_afiliado_atualizar_link(
  p_link uuid,
  p_rotulo text,
  p_comissao_bps int,
  p_vitalicia boolean,
  p_desconto_bps int,
  p_desconto_duracao text,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desconto int := coalesce(p_desconto_bps, 0);
  v_duracao text := case when coalesce(p_desconto_bps, 0) = 0 then null else p_desconto_duracao end;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  if p_comissao_bps is null or p_comissao_bps < 0 or p_comissao_bps > 10000
     or p_vitalicia is null or p_ativo is null then
    raise exception 'COMISSAO_INVALIDA';
  end if;
  if v_desconto < 0 or v_desconto > 9000
     or (v_desconto > 0 and coalesce(v_duracao, '') not in ('primeira_fatura', 'permanente')) then
    raise exception 'DESCONTO_INVALIDO';
  end if;

  update private.afiliado_links
  set rotulo = pg_catalog.left(pg_catalog.btrim(coalesce(p_rotulo, '')), 80),
      comissao_bps = p_comissao_bps,
      comissao_vitalicia = p_vitalicia,
      desconto_bps = v_desconto,
      desconto_duracao = v_duracao,
      ativo = p_ativo,
      atualizado_em = pg_catalog.now()
  where id = p_link;

  if not found then
    raise exception 'LINK_NAO_ENCONTRADO';
  end if;

  return pg_catalog.jsonb_build_object('alterada', true);
end;
$$;

revoke all on function public.fn_admin_afiliado_atualizar_link(uuid, text, int, boolean, int, text, boolean)
  from public, anon;
grant execute on function public.fn_admin_afiliado_atualizar_link(uuid, text, int, boolean, int, text, boolean)
  to authenticated;

create or replace function public.fn_admin_afiliado_config_salvar(
  p_carencia_dias int,
  p_saque_minimo_centavos int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  if p_carencia_dias is null or p_carencia_dias < 0 or p_carencia_dias > 365
     or p_saque_minimo_centavos is null or p_saque_minimo_centavos < 0 then
    raise exception 'CONFIG_INVALIDA';
  end if;

  -- singleton (id = true); o WHERE também satisfaz o pg_safeupdate das sessões do PostgREST
  update private.afiliados_config
  set carencia_dias = p_carencia_dias,
      saque_minimo_centavos = p_saque_minimo_centavos,
      atualizado_em = pg_catalog.now()
  where id;

  return pg_catalog.jsonb_build_object('alterada', true);
end;
$$;

revoke all on function public.fn_admin_afiliado_config_salvar(int, int) from public, anon;
grant execute on function public.fn_admin_afiliado_config_salvar(int, int) to authenticated;

create or replace function public.fn_admin_afiliado_comissoes(p_limite int default 100)
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
    select pg_catalog.jsonb_agg(t.item order by t.criado_em desc)
    from (
      select
        l.criado_em,
        pg_catalog.jsonb_build_object(
          'id', l.id,
          'em', l.criado_em,
          'afiliadoNome', pg_catalog.left(coalesce(pa.nome, ''), 80),
          'linkCodigo', lk.codigo,
          'indicadoNome', pg_catalog.left(coalesce(pind.nome, ''), 80),
          'valorCentavos', l.valor_centavos,
          'baseCentavos', l.valor_base_centavos,
          'comissaoBps', l.comissao_bps,
          'disponivelEm', l.disponivel_em,
          'pagamentoId', l.provedor_pagamento_id,
          'estornada', exists (
            select 1 from private.afiliado_lancamentos e
            where e.tipo = 'estorno' and e.ref_lancamento_id = l.id
          )
        ) as item
      from private.afiliado_lancamentos l
      join private.afiliado_links lk on lk.id = l.link_id
      left join public.profiles pa on pa.id = l.afiliado_id
      left join public.profiles pind on pind.id = l.indicado_id
      where l.tipo = 'comissao'
      order by l.criado_em desc
      limit least(greatest(coalesce(p_limite, 100), 1), 500)
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_admin_afiliado_comissoes(int) from public, anon;
grant execute on function public.fn_admin_afiliado_comissoes(int) to authenticated;

-- Estorno manual de uma comissão (pagamento reembolsado ou contestado). Idempotente: o segundo
-- estorno da mesma comissão devolve alterada=false.
create or replace function public.fn_admin_afiliado_estornar(p_lancamento uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l private.afiliado_lancamentos%rowtype;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_motivo = '' then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;

  select * into v_l
  from private.afiliado_lancamentos l
  where l.id = p_lancamento and l.tipo = 'comissao';
  if not found then
    raise exception 'LANCAMENTO_NAO_ENCONTRADO';
  end if;

  begin
    insert into private.afiliado_lancamentos (
      afiliado_id, tipo, valor_centavos, disponivel_em, link_id, indicado_id,
      ref_lancamento_id, motivo, criado_por
    )
    values (
      v_l.afiliado_id, 'estorno', -v_l.valor_centavos, v_l.disponivel_em, v_l.link_id,
      v_l.indicado_id, v_l.id, pg_catalog.left(v_motivo, 300), auth.uid()
    );
  exception when unique_violation then
    return pg_catalog.jsonb_build_object('alterada', false);
  end;

  return pg_catalog.jsonb_build_object('alterada', true);
end;
$$;

revoke all on function public.fn_admin_afiliado_estornar(uuid, text) from public, anon;
grant execute on function public.fn_admin_afiliado_estornar(uuid, text) to authenticated;

-- Única função que devolve a chave Pix completa (o suporte precisa dela para pagar).
create or replace function public.fn_admin_saques(p_status text default null)
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
    select pg_catalog.jsonb_agg(t.item order by t.aberto desc, t.solicitado_em desc)
    from (
      select
        (s.status = 'solicitado') as aberto,
        s.solicitado_em,
        pg_catalog.jsonb_build_object(
          'id', s.id,
          'afiliadoId', s.afiliado_id,
          'afiliadoNome', pg_catalog.left(coalesce(p.nome, ''), 80),
          'afiliadoEmail', private.email_do_usuario(s.afiliado_id),
          'valorCentavos', s.valor_centavos,
          'tipoChave', s.tipo_chave,
          'chavePix', s.chave_pix,
          'status', s.status,
          'solicitadoEm', s.solicitado_em,
          'resolvidoEm', s.resolvido_em,
          'observacao', s.observacao
        ) as item
      from private.afiliado_saques s
      left join public.profiles p on p.id = s.afiliado_id
      where p_status is null or s.status = p_status
      order by (s.status = 'solicitado') desc, s.solicitado_em desc
      limit 200
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_admin_saques(text) from public, anon;
grant execute on function public.fn_admin_saques(text) to authenticated;

create or replace function public.fn_admin_saque_pagar(p_saque uuid, p_obs text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s private.afiliado_saques%rowtype;
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  select * into v_s from private.afiliado_saques s where s.id = p_saque for update;
  if not found then
    raise exception 'SAQUE_NAO_ENCONTRADO';
  end if;
  if v_s.status = 'pago' then
    return pg_catalog.jsonb_build_object('alterada', false);
  end if;
  if v_s.status <> 'solicitado' then
    raise exception 'SAQUE_JA_RESOLVIDO';
  end if;

  update private.afiliado_saques
  set status = 'pago',
      resolvido_em = pg_catalog.now(),
      resolvido_por = auth.uid(),
      observacao = pg_catalog.left(nullif(pg_catalog.btrim(coalesce(p_obs, '')), ''), 300)
  where id = p_saque;

  return pg_catalog.jsonb_build_object(
    'alterada', true, 'afiliadoId', v_s.afiliado_id, 'valorCentavos', v_s.valor_centavos
  );
end;
$$;

revoke all on function public.fn_admin_saque_pagar(uuid, text) from public, anon;
grant execute on function public.fn_admin_saque_pagar(uuid, text) to authenticated;

create or replace function public.fn_admin_saque_recusar(p_saque uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s private.afiliado_saques%rowtype;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_motivo = '' then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;

  select * into v_s from private.afiliado_saques s where s.id = p_saque for update;
  if not found then
    raise exception 'SAQUE_NAO_ENCONTRADO';
  end if;
  if v_s.status = 'recusado' then
    return pg_catalog.jsonb_build_object('alterada', false);
  end if;
  if v_s.status <> 'solicitado' then
    raise exception 'SAQUE_JA_RESOLVIDO';
  end if;

  update private.afiliado_saques
  set status = 'recusado',
      resolvido_em = pg_catalog.now(),
      resolvido_por = auth.uid(),
      observacao = pg_catalog.left(v_motivo, 300)
  where id = p_saque;

  -- devolve o saldo reservado no pedido
  insert into private.afiliado_lancamentos (
    afiliado_id, tipo, valor_centavos, disponivel_em, saque_id, motivo, criado_por
  )
  values (
    v_s.afiliado_id, 'saque_devolvido', v_s.valor_centavos, pg_catalog.now(), v_s.id,
    pg_catalog.left(v_motivo, 300), auth.uid()
  );

  return pg_catalog.jsonb_build_object(
    'alterada', true, 'afiliadoId', v_s.afiliado_id, 'valorCentavos', v_s.valor_centavos
  );
end;
$$;

revoke all on function public.fn_admin_saque_recusar(uuid, text) from public, anon;
grant execute on function public.fn_admin_saque_recusar(uuid, text) to authenticated;
