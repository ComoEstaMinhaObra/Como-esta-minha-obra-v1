-- E5 do plano da tela de Cobrança: fim do modelo de planos por faixa (07/10/2026).
--
-- Remove do banco o que só existia para o modelo antigo (1/3/5 obras):
--   * colunas assinaturas.plano e assinaturas.limite_obras e o enum plano_tipo;
--   * private.assinatura_permite_escrita (estado da conta decidia a escrita);
--   * o ramo "conta ativa do legado" de private.obra_permite_escrita e de fn_criar_obra;
--   * fn_admin_kpis, fn_admin_contas e handle_new_user passam a não usar plano nem limite.
--
-- Efeito conhecido (aceito no plano): a conta ativa do modelo antigo deixa de escrever até que
-- suas obras sejam contratadas em /cobranca. Aplicar só com o código novo já no ar (a tela de
-- Cobrança sem a flag "legado" e o admin sem a coluna "plano").

-- ===== escrita por obra, sem o ramo legado =====
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

  -- obra com histórico de cobrança sem cobrança vigente: somente leitura
  if exists (select 1 from public.cobrancas_obra c where c.obra_id = p_obra) then
    return false;
  end if;

  select * into v_ass from public.assinaturas s where s.user_id = v_owner;
  if not found then
    return false;
  end if;

  -- trial: só para quem nunca teve cobrança (quem já pagou uma obra deixou o trial para trás)
  return v_ass.status = 'trial'
    and v_ass.trial_fim is not null
    and pg_catalog.now() <= v_ass.trial_fim
    and not exists (select 1 from public.cobrancas_obra c where c.user_id = v_owner);
end;
$$;

-- ===== criar obra, sem o ramo legado =====
CREATE OR REPLACE FUNCTION public.fn_criar_obra(p_nome text, p_endereco text, p_cliente_nome text, p_inicio date, p_termino date, p_valor_centavos bigint, p_sinal_centavos bigint DEFAULT 0, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_construtora text DEFAULT NULL::text, p_engenheiro text DEFAULT NULL::text, p_escritorio_arquitetura text DEFAULT NULL::text, p_arquiteto text DEFAULT NULL::text, p_projetista_estruturas text DEFAULT NULL::text, p_projetista_instalacoes text DEFAULT NULL::text, p_foto_capa_path text DEFAULT NULL::text, p_etapas jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_assinatura public.assinaturas%rowtype;
  v_paga boolean;
  v_ativas int;
  v_obra_id uuid;
  v_etapa jsonb;
  v_ordem int := 0;
  v_peso numeric;
  v_peso_total numeric := 0;
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
  if p_valor_centavos is null or p_valor_centavos <= 0
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

  if p_etapas is null or jsonb_typeof(p_etapas) <> 'array' then
    raise exception 'PESOS_ETAPAS_INVALIDOS';
  end if;
  if jsonb_array_length(p_etapas) = 0 or jsonb_array_length(p_etapas) > 60 then
    raise exception 'PESOS_ETAPAS_INVALIDOS';
  end if;

  for v_etapa in select * from jsonb_array_elements(p_etapas) loop
    if jsonb_typeof(v_etapa) <> 'object'
       or length(btrim(coalesce(v_etapa->>'nome', ''))) = 0
       or coalesce(v_etapa->>'peso', '') !~ '^\d+(\.\d{1,2})?$' then
      raise exception 'PESOS_ETAPAS_INVALIDOS';
    end if;

    v_peso := (v_etapa->>'peso')::numeric;
    if v_peso <= 0 then
      raise exception 'PESOS_ETAPAS_INVALIDOS';
    end if;
    v_peso_total := v_peso_total + v_peso;
  end loop;

  if v_peso_total <> 100 then
    raise exception 'PESOS_ETAPAS_INVALIDOS';
  end if;

  select * into v_assinatura
  from public.assinaturas s
  where s.user_id = v_user
  for update;
  if not found then
    raise exception 'ASSINATURA_AUSENTE';
  end if;
  -- Cobrança por obra: quem tem cobrança vigente cria obras sem limite; cada obra só aceita
  -- escrita com a própria cobrança (private.obra_permite_escrita). Sem cobrança, vale o trial:
  -- uma obra, dentro do prazo.
  v_paga := private.usuario_tem_cobranca_vigente(v_user);
  if not v_paga then
    if v_assinatura.status <> 'trial' then
      raise exception 'ASSINATURA_INATIVA';
    end if;
    if v_assinatura.trial_fim is null or pg_catalog.now() > v_assinatura.trial_fim then
      raise exception 'TRIAL_EXPIRADO';
    end if;
    select count(*) into v_ativas
    from public.obras o
    where o.owner_id = v_user and o.arquivada_em is null;
    if v_ativas >= 1 then
      raise exception 'LIMITE_OBRAS';
    end if;
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

  for v_etapa in select * from jsonb_array_elements(p_etapas) loop
    v_ordem := v_ordem + 1;
    insert into public.etapas (obra_id, nome, ordem, peso, pct_atual)
    values (
      v_obra_id,
      btrim(v_etapa->>'nome'),
      v_ordem,
      (v_etapa->>'peso')::numeric,
      0
    );
  end loop;

  if coalesce(p_sinal_centavos, 0) > 0 then
    insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos)
    values (v_obra_id, 'sinal', 'medicoes', 'Sinal', p_sinal_centavos);
  end if;

  return v_obra_id;
end;
$function$;

-- ===== novo usuário: só trial =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  insert into public.assinaturas (user_id, status, trial_fim)
  values (new.id, 'trial', pg_catalog.now() + interval '14 days');

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

-- ===== admin: sem plano =====
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
        'status', s.status, 'trialFim', s.trial_fim
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
      'status', s.status,
      'obrasAtivas', (
        select count(*) from public.obras o
        where o.owner_id = p.id and o.arquivada_em is null
      ),
      'obrasPagas', (
        select count(*) from public.cobrancas_obra c
        where c.user_id = p.id and c.status = 'ativa'
      ),
      'obrasInadimplentes', (
        select count(*) from public.cobrancas_obra c
        where c.user_id = p.id and c.status = 'inadimplente'
      )
    ) order by p.criado_em desc)
    from public.profiles p
    join public.assinaturas s on s.user_id = p.id
  ), '[]'::jsonb);
end;
$$;

-- ===== remoção =====
drop function if exists private.assinatura_permite_escrita(uuid);

alter table public.assinaturas drop column plano;
alter table public.assinaturas drop column limite_obras;
drop type public.plano_tipo;
