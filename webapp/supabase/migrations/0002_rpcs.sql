-- 0002_rpcs.sql — RPCs de negócio

-- 23 etapas padrão (ordem e grafia EXATAS — BRIEFING §5.15)
create or replace function public.etapas_padrao()
returns table (ordem int, nome text)
language sql immutable as $$
  select * from (values
    (1,  'Montagem do canteiro de obras'),
    (2,  'Demolições'),
    (3,  'Terraplanagem'),
    (4,  'Fundações'),
    (5,  'Estrutura'),
    (6,  'Alvenarias'),
    (7,  'Cobertura'),
    (8,  'Instalações elétricas e rede'),
    (9,  'Instalações hidrossanitárias'),
    (10, 'Instalações de ar condicionado'),
    (11, 'Rebocos e contrapisos'),
    (12, 'Impermeabilizações'),
    (13, 'Revestimentos de piso'),
    (14, 'Revestimentos de parede'),
    (15, 'Revestimentos de teto'),
    (16, 'Fachadas'),
    (17, 'Esquadrias (janelas)'),
    (18, 'Esquadrias (portas)'),
    (19, 'Acabamentos de granito'),
    (20, 'Acabamentos elétricos e luminárias'),
    (21, 'Louças e metais sanitários'),
    (22, 'Pintura'),
    (23, 'Limpeza final de obra')
  ) as t(ordem, nome);
$$;

create or replace function public.fn_proximos_rotulos(p_obra uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_max_medicao int;
  v_max_aditivo int;
begin
  if not eh_dono_obra(p_obra) and not is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  select coalesce(max(numero), 0) into v_max_medicao
  from lancamentos where obra_id = p_obra and tipo = 'medicao';

  select coalesce(max(numero), 0) into v_max_aditivo
  from lancamentos where obra_id = p_obra and tipo = 'aditivo';

  return jsonb_build_object(
    'proximaMedicao', 'Medição ' || lpad((v_max_medicao + 1)::text, 2, '0'),
    'proximoAditivo', 'Aditivo ' || lpad((v_max_aditivo + 1)::text, 2, '0')
  );
end $$;

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
  p_etapas jsonb default null  -- [{nome, peso}] ou null = 23 padrão
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_assinatura assinaturas%rowtype;
  v_ativas int;
  v_obra_id uuid;
  v_etapa jsonb;
  v_ordem int := 0;
  v_ep record;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_assinatura from assinaturas where user_id = v_user for update;
  if not found then
    raise exception 'ASSINATURA_AUSENTE';
  end if;

  if v_assinatura.status not in ('trial', 'ativa') then
    raise exception 'ASSINATURA_INATIVA';
  end if;

  select count(*) into v_ativas from obras
  where owner_id = v_user and arquivada_em is null;

  if v_ativas >= v_assinatura.limite_obras then
    raise exception 'LIMITE_OBRAS';
  end if;

  insert into obras (
    owner_id, nome, endereco, lat, lng, cliente_nome,
    construtora, engenheiro, escritorio_arquitetura, arquiteto,
    projetista_estruturas, projetista_instalacoes, foto_capa_path,
    inicio_contratual, termino_contratual,
    valor_contratado_centavos, sinal_centavos
  ) values (
    v_user, p_nome, p_endereco, p_lat, p_lng, p_cliente_nome,
    p_construtora, p_engenheiro, p_escritorio_arquitetura, p_arquiteto,
    p_projetista_estruturas, p_projetista_instalacoes, p_foto_capa_path,
    p_inicio, p_termino,
    p_valor_centavos, coalesce(p_sinal_centavos, 0)
  ) returning id into v_obra_id;

  if p_etapas is null or jsonb_array_length(p_etapas) = 0 then
    for v_ep in select * from etapas_padrao() loop
      insert into etapas (obra_id, nome, ordem, peso, pct_atual)
      values (v_obra_id, v_ep.nome, v_ep.ordem, 1, 0);
    end loop;
  else
    for v_etapa in select * from jsonb_array_elements(p_etapas) loop
      v_ordem := v_ordem + 1;
      insert into etapas (obra_id, nome, ordem, peso, pct_atual)
      values (
        v_obra_id,
        v_etapa->>'nome',
        v_ordem,
        coalesce((v_etapa->>'peso')::numeric, 1),
        0
      );
    end loop;
  end if;

  if coalesce(p_sinal_centavos, 0) > 0 then
    insert into lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos)
    values (v_obra_id, 'sinal', 'medicoes', 'Sinal contratual', p_sinal_centavos);
  end if;

  return v_obra_id;
end $$;

create or replace function public.fn_enviar_relatorio(p_relatorio uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_rel relatorios%rowtype;
  v_obra obras%rowtype;
  v_assinatura assinaturas%rowtype;
  v_rascunho jsonb;
  v_geral_antes int;
  v_geral_depois int;
  v_etapa record;
  v_item jsonb;
  v_idx int;
  v_max_medicao int;
  v_max_aditivo int;
  v_num int;
  v_rotulo text;
  v_atividade_id uuid;
  v_foto_path text;
  v_foto_ordem int;
  v_aditivos_acum bigint;
  v_pago_acum bigint;
  v_contratado_total bigint;
  v_pct_pago int;
  v_saldo bigint;
  v_dias_total int;
  v_nova_data date;
  v_snapshot jsonb;
  v_etapas_snap jsonb := '[]'::jsonb;
  v_lanc_novos jsonb := '[]'::jsonb;
  v_atividades_snap jsonb := '[]'::jsonb;
  v_prazo_novos jsonb := '[]'::jsonb;
  v_clima jsonb := '[]'::jsonb;
  v_pct_ant int;
  v_etapa_nome text;
  v_etapa_peso numeric;
  v_grupo lancamento_grupo;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_rel from relatorios where id = p_relatorio;
  if not found then
    raise exception 'RELATORIO_AUSENTE';
  end if;

  select * into v_obra from obras where id = v_rel.obra_id for update;
  if not found or v_obra.owner_id <> v_user then
    raise exception 'SEM_PERMISSAO';
  end if;

  if v_rel.status <> 'rascunho' then
    raise exception 'RELATORIO_JA_ENVIADO';
  end if;

  select * into v_assinatura from assinaturas where user_id = v_obra.owner_id for update;
  if v_assinatura.status not in ('trial', 'ativa') then
    raise exception 'ASSINATURA_INATIVA';
  end if;

  if v_assinatura.status = 'trial' then
    if v_assinatura.trial_fim is null or now() > v_assinatura.trial_fim then
      raise exception 'TRIAL_EXPIRADO';
    end if;
    if v_assinatura.relatorios_enviados_trial >= 1 then
      raise exception 'TRIAL_LIMITE';
    end if;
  end if;

  v_rascunho := v_rel.dados_rascunho;
  if v_rascunho is null then
    raise exception 'RASCUNHO_AUSENTE';
  end if;

  v_geral_antes := fn_avanco_geral(v_obra.id);

  -- validar e preparar etapas
  for v_item in select * from jsonb_array_elements(v_rascunho->'etapas') loop
    select pct_atual, nome, peso into v_pct_ant, v_etapa_nome, v_etapa_peso
    from etapas where id = (v_item->>'etapaId')::uuid and obra_id = v_obra.id;

    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;

    if (v_item->>'pct')::int < v_pct_ant then
      raise exception 'PCT_REGREDIU';
    end if;

    if (v_item->>'pct')::int < 0 or (v_item->>'pct')::int > 100 then
      raise exception 'PCT_INVALIDO';
    end if;

    v_etapas_snap := v_etapas_snap || jsonb_build_array(jsonb_build_object(
      'nome', v_etapa_nome,
      'peso', v_etapa_peso,
      'pctAnterior', v_pct_ant,
      'pctNovo', (v_item->>'pct')::int
    ));
  end loop;

  select coalesce(max(numero), 0) into v_max_medicao
  from lancamentos where obra_id = v_obra.id and tipo = 'medicao';
  select coalesce(max(numero), 0) into v_max_aditivo
  from lancamentos where obra_id = v_obra.id and tipo = 'aditivo';

  -- medições
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'financeiro'->'medicoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_medicao + v_idx;
    v_rotulo := 'Medição ' || lpad(v_num::text, 2, '0');
    insert into lancamentos (obra_id, relatorio_id, tipo, grupo, numero, rotulo, valor_centavos)
    values (v_obra.id, p_relatorio, 'medicao', 'medicoes', v_num, v_rotulo, (v_item->>'valorCentavos')::bigint);
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'medicao', 'grupo', 'medicoes', 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  -- materiais
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'financeiro'->'materiais', '[]'::jsonb)) loop
    v_rotulo := v_item->>'rotulo';
    insert into lancamentos (obra_id, relatorio_id, tipo, grupo, rotulo, valor_centavos)
    values (v_obra.id, p_relatorio, 'material', 'materiais', v_rotulo, (v_item->>'valorCentavos')::bigint);
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'material', 'grupo', 'materiais', 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  -- aditivos
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'financeiro'->'aditivos', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_aditivo + v_idx;
    v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    insert into lancamentos (obra_id, relatorio_id, tipo, grupo, numero, rotulo, valor_centavos)
    values (v_obra.id, p_relatorio, 'aditivo', 'aditivos', v_num, v_rotulo, (v_item->>'valorCentavos')::bigint);
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'aditivo', 'grupo', 'aditivos', 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  -- estornos (valor positivo no rascunho → negativo no banco)
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'financeiro'->'estornos', '[]'::jsonb)) loop
    v_grupo := (v_item->>'grupo')::lancamento_grupo;
    v_rotulo := 'Estorno — ' || (v_item->>'descricao');
    insert into lancamentos (obra_id, relatorio_id, tipo, grupo, rotulo, valor_centavos)
    values (v_obra.id, p_relatorio, 'estorno', v_grupo, v_rotulo, -abs((v_item->>'valorCentavos')::bigint));
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'estorno', 'grupo', v_grupo, 'rotulo', v_rotulo,
      'valorCentavos', -abs((v_item->>'valorCentavos')::bigint)
    ));
  end loop;

  -- atividades + fotos
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'atividades', '[]'::jsonb)) loop
    insert into atividades (relatorio_id, etapa_id, nota)
    values (p_relatorio, (v_item->>'etapaId')::uuid, coalesce(v_item->>'nota', ''))
    returning id into v_atividade_id;

    select nome into v_etapa_nome from etapas where id = (v_item->>'etapaId')::uuid;

    v_foto_ordem := 0;
    for v_foto_path in select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb)) loop
      v_foto_ordem := v_foto_ordem + 1;
      insert into fotos (obra_id, relatorio_id, etapa_id, atividade_id, storage_path, ordem)
      values (v_obra.id, p_relatorio, (v_item->>'etapaId')::uuid, v_atividade_id, v_foto_path, v_foto_ordem);
    end loop;

    v_atividades_snap := v_atividades_snap || jsonb_build_array(jsonb_build_object(
      'etapaNome', v_etapa_nome,
      'nota', coalesce(v_item->>'nota', ''),
      'fotosPaths', coalesce(v_item->'fotosPaths', '[]'::jsonb)
    ));
  end loop;

  -- prazo / dias aditivados
  for v_item in select * from jsonb_array_elements(coalesce(v_rascunho->'prazo', '[]'::jsonb)) loop
    insert into dias_aditivados (obra_id, relatorio_id, motivo, descricao, dias)
    values (
      v_obra.id, p_relatorio,
      (v_item->>'motivo')::motivo_aditivo,
      v_item->>'descricao',
      (v_item->>'dias')::int
    );
    v_prazo_novos := v_prazo_novos || jsonb_build_array(jsonb_build_object(
      'motivo', v_item->>'motivo',
      'descricao', v_item->>'descricao',
      'dias', (v_item->>'dias')::int
    ));
  end loop;

  -- aplicar pcts nas etapas + relatorio_etapas
  for v_item in select * from jsonb_array_elements(v_rascunho->'etapas') loop
    update etapas set pct_atual = (v_item->>'pct')::int
    where id = (v_item->>'etapaId')::uuid;

    insert into relatorio_etapas (relatorio_id, etapa_id, pct)
    values (p_relatorio, (v_item->>'etapaId')::uuid, (v_item->>'pct')::int);
  end loop;

  v_geral_depois := fn_avanco_geral(v_obra.id);

  -- agregados financeiros
  select coalesce(sum(valor_centavos), 0) into v_aditivos_acum
  from lancamentos where obra_id = v_obra.id and tipo = 'aditivo';

  select coalesce(sum(valor_centavos), 0) into v_pago_acum
  from lancamentos
  where obra_id = v_obra.id and tipo in ('sinal', 'medicao', 'material', 'estorno');

  -- estornos em aditivos reduzem contratado total (valor negativo já está em lancamentos tipo estorno grupo aditivos)
  -- contratado total = valor contratado + aditivos + estornos de aditivos
  select coalesce(sum(valor_centavos), 0) into v_aditivos_acum
  from lancamentos
  where obra_id = v_obra.id
    and (tipo = 'aditivo' or (tipo = 'estorno' and grupo = 'aditivos'));

  v_contratado_total := v_obra.valor_contratado_centavos + v_aditivos_acum;

  if v_contratado_total > 0 then
    v_pct_pago := round((v_pago_acum::numeric / v_contratado_total::numeric) * 100)::int;
  else
    v_pct_pago := 0;
  end if;
  v_saldo := v_contratado_total - v_pago_acum;

  select coalesce(sum(dias), 0) into v_dias_total
  from dias_aditivados where obra_id = v_obra.id;
  v_nova_data := v_obra.termino_contratual + v_dias_total;

  -- clima: últimos 7 dias até hoje
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'data', cs.data,
      'condicao', cs.condicao,
      'probChuva', cs.prob_chuva
    ) order by cs.data
  ), '[]'::jsonb)
  into v_clima
  from clima_snapshots cs
  where cs.obra_id = v_obra.id
    and cs.data >= (current_date - 7)
    and cs.data <= current_date;

  v_snapshot := jsonb_build_object(
    'versao', 1,
    'numero', v_rel.numero,
    'enviadoEm', to_jsonb(now()),
    'obra', jsonb_build_object(
      'nome', v_obra.nome,
      'endereco', v_obra.endereco,
      'clienteNome', v_obra.cliente_nome,
      'construtora', v_obra.construtora,
      'engenheiro', v_obra.engenheiro,
      'escritorioArquitetura', v_obra.escritorio_arquitetura,
      'arquiteto', v_obra.arquiteto,
      'projetistaEstruturas', v_obra.projetista_estruturas,
      'projetistaInstalacoes', v_obra.projetista_instalacoes,
      'inicioContratual', v_obra.inicio_contratual,
      'terminoContratual', v_obra.termino_contratual
    ),
    'avancoFisico', jsonb_build_object(
      'geralAntes', v_geral_antes,
      'geralDepois', v_geral_depois,
      'etapas', v_etapas_snap
    ),
    'financeiro', jsonb_build_object(
      'valorContratadoCentavos', v_obra.valor_contratado_centavos,
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

  update relatorios set
    status = 'enviado',
    snapshot = v_snapshot,
    dados_rascunho = null,
    geral_antes = v_geral_antes,
    geral_depois = v_geral_depois,
    enviado_em = now()
  where id = p_relatorio;

  if v_assinatura.status = 'trial' then
    update assinaturas
    set relatorios_enviados_trial = relatorios_enviados_trial + 1,
        atualizado_em = now()
    where id = v_assinatura.id;
  end if;

  return v_snapshot;
end $$;

grant execute on function public.fn_criar_obra to authenticated;
grant execute on function public.fn_enviar_relatorio to authenticated;
grant execute on function public.fn_proximos_rotulos to authenticated;
grant execute on function public.fn_avanco_geral to authenticated, anon;
