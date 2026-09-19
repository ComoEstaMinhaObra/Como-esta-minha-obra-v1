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
    values (v_obra_id, 'sinal', 'medicoes', 'Sinal contratual', p_sinal_centavos);
  end if;

  return v_obra_id;
end;
$$;
