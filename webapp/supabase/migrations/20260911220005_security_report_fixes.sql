-- Correções transacionais de publicação, retry e retificação.

create or replace function private.montar_snapshot_retificacao(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_anterior public.relatorio_versoes,
  p_rascunho jsonb,
  p_enviado_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_lancamentos jsonb := '[]'::jsonb;
  v_etapas jsonb;
  v_item jsonb;
  v_idx int;
  v_num int;
  v_base_medicao int;
  v_base_aditivo int;
  v_rotulo text;
  v_grupo public.lancamento_grupo;
  v_pago_global bigint;
  v_pago_anterior bigint;
  v_pago_novo bigint;
  v_aditivo_global bigint;
  v_aditivo_anterior bigint;
  v_aditivo_novo bigint;
  v_pago_final bigint;
  v_aditivo_final bigint;
  v_contratado bigint;
  v_pct_pago int;
  v_dias_global int;
  v_dias_anterior int;
  v_dias_novo int;
  v_dias_final int;
begin
  v_snapshot := private.montar_snapshot(
    p_obra,
    p_relatorio,
    p_rascunho,
    coalesce((p_anterior.snapshot#>>'{avancoFisico,geralAntes}')::int, 0),
    p_enviado_em
  );

  select coalesce(max(l.numero), 0) into v_base_medicao
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and l.tipo = 'medicao'
    and l.relatorio_id is distinct from p_relatorio.id;

  select coalesce(max(l.numero), 0) into v_base_aditivo
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and l.tipo = 'aditivo'
    and l.relatorio_id is distinct from p_relatorio.id;

  v_idx := 0;
  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)
    )
  loop
    v_idx := v_idx + 1;
    v_num := v_base_medicao + v_idx;
    v_lancamentos := v_lancamentos || jsonb_build_array(jsonb_build_object(
      'tipo', 'medicao',
      'grupo', 'medicoes',
      'numero', v_num,
      'rotulo', 'Medição ' || lpad(v_num::text, 2, '0'),
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)
    )
  loop
    v_lancamentos := v_lancamentos || jsonb_build_array(jsonb_build_object(
      'tipo', 'material',
      'grupo', 'materiais',
      'rotulo', v_item->>'rotulo',
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  v_idx := 0;
  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)
    )
  loop
    v_idx := v_idx + 1;
    v_num := v_base_aditivo + v_idx;
    v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0')
      || ' — ' || coalesce(v_item->>'descricao', '');
    v_lancamentos := v_lancamentos || jsonb_build_array(jsonb_build_object(
      'tipo', 'aditivo',
      'grupo', 'aditivos',
      'numero', v_num,
      'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)
    )
  loop
    v_grupo := (v_item->>'grupo')::public.lancamento_grupo;
    v_lancamentos := v_lancamentos || jsonb_build_array(jsonb_build_object(
      'tipo', 'estorno',
      'grupo', v_grupo,
      'rotulo', 'Estorno — ' || coalesce(v_item->>'descricao', ''),
      'valorCentavos', -abs((v_item->>'valorCentavos')::bigint)
    ));
  end loop;

  select coalesce(sum(l.valor_centavos), 0) into v_pago_global
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and l.tipo in ('sinal', 'medicao', 'material', 'estorno')
    and not (l.tipo = 'estorno' and l.grupo = 'aditivos');
  select coalesce(sum(l.valor_centavos), 0) into v_pago_anterior
  from public.lancamentos l
  where l.relatorio_id = p_relatorio.id
    and l.tipo in ('medicao', 'material', 'estorno')
    and not (l.tipo = 'estorno' and l.grupo = 'aditivos');
  select coalesce(sum((x.elem->>'valorCentavos')::bigint), 0) into v_pago_novo
  from jsonb_array_elements(v_lancamentos) x(elem)
  where (x.elem->>'tipo') in ('medicao', 'material', 'estorno')
    and not ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  select coalesce(sum(l.valor_centavos), 0) into v_aditivo_global
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and (l.tipo = 'aditivo' or (l.tipo = 'estorno' and l.grupo = 'aditivos'));
  select coalesce(sum(l.valor_centavos), 0) into v_aditivo_anterior
  from public.lancamentos l
  where l.relatorio_id = p_relatorio.id
    and (l.tipo = 'aditivo' or (l.tipo = 'estorno' and l.grupo = 'aditivos'));
  select coalesce(sum((x.elem->>'valorCentavos')::bigint), 0) into v_aditivo_novo
  from jsonb_array_elements(v_lancamentos) x(elem)
  where (x.elem->>'tipo') = 'aditivo'
     or ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  v_pago_final := v_pago_global - v_pago_anterior + v_pago_novo;
  v_aditivo_final := v_aditivo_global - v_aditivo_anterior + v_aditivo_novo;
  v_contratado := p_obra.valor_contratado_centavos + v_aditivo_final;
  v_pct_pago := case
    when v_contratado > 0
      then round((v_pago_final::numeric / v_contratado::numeric) * 100)::int
    else 0
  end;

  select coalesce(sum(d.dias), 0) into v_dias_global
  from public.dias_aditivados d where d.obra_id = p_obra.id;
  select coalesce(sum(d.dias), 0) into v_dias_anterior
  from public.dias_aditivados d where d.relatorio_id = p_relatorio.id;
  select coalesce(sum((x.elem->>'dias')::int), 0) into v_dias_novo
  from jsonb_array_elements(coalesce(p_rascunho->'prazo', '[]'::jsonb)) x(elem);
  v_dias_final := v_dias_global - v_dias_anterior + v_dias_novo;

  select coalesce(jsonb_agg(
    x.elem || jsonb_build_object(
      'pctAnterior', coalesce((
        select (a.elem->>'pctAnterior')::int
        from jsonb_array_elements(
          coalesce(p_anterior.snapshot#>'{avancoFisico,etapas}', '[]'::jsonb)
        ) a(elem)
        where a.elem->>'etapaId' = x.elem->>'etapaId'
        limit 1
      ), (x.elem->>'pctAnterior')::int)
    ) order by x.ord
  ), '[]'::jsonb)
  into v_etapas
  from jsonb_array_elements(
    coalesce(v_snapshot#>'{avancoFisico,etapas}', '[]'::jsonb)
  ) with ordinality x(elem, ord);

  v_snapshot := jsonb_set(v_snapshot, '{obra}', p_anterior.snapshot->'obra', true);
  v_snapshot := jsonb_set(v_snapshot, '{clima}', p_anterior.snapshot->'clima', true);
  v_snapshot := jsonb_set(v_snapshot, '{avancoFisico,geralAntes}',
    to_jsonb(coalesce((p_anterior.snapshot#>>'{avancoFisico,geralAntes}')::int, 0)), true);
  v_snapshot := jsonb_set(v_snapshot, '{avancoFisico,etapas}', v_etapas, true);
  v_snapshot := jsonb_set(v_snapshot, '{financeiro}', jsonb_build_object(
    'valorContratadoCentavos', p_obra.valor_contratado_centavos,
    'aditivosAcumuladoCentavos', v_aditivo_final,
    'contratadoTotalCentavos', v_contratado,
    'pagoAcumuladoCentavos', v_pago_final,
    'pctPago', v_pct_pago,
    'saldoCentavos', v_contratado - v_pago_final,
    'lancamentosNovos', v_lancamentos
  ), true);
  v_snapshot := jsonb_set(v_snapshot, '{prazo}', jsonb_build_object(
    'novosDias', coalesce(v_snapshot#>'{prazo,novosDias}', '[]'::jsonb),
    'totalDiasAditivados', v_dias_final,
    'novaDataTermino', p_obra.termino_contratual + v_dias_final
  ), true);

  return v_snapshot;
end;
$$;

create or replace function private.aplicar_deltas_retificacao(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_versao public.relatorio_versoes,
  p_anterior public.relatorio_versoes,
  p_rascunho jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo text;
  v_old bigint;
  v_new bigint;
  v_delta bigint;
  v_tipo public.lancamento_tipo;
  v_dias int;
begin
  if p_rascunho is null then raise exception 'RASCUNHO_INVALIDO'; end if;
  for v_grupo in select unnest(array['medicoes', 'materiais', 'aditivos']) loop
    select coalesce(sum((x.elem->>'valorCentavos')::bigint), 0) into v_old
    from jsonb_array_elements(
      coalesce(p_anterior.snapshot#>'{financeiro,lancamentosNovos}', '[]'::jsonb)
    ) x(elem)
    where x.elem->>'grupo' = v_grupo;

    select coalesce(sum((x.elem->>'valorCentavos')::bigint), 0) into v_new
    from jsonb_array_elements(
      coalesce(p_versao.snapshot#>'{financeiro,lancamentosNovos}', '[]'::jsonb)
    ) x(elem)
    where x.elem->>'grupo' = v_grupo;

    v_delta := v_new - v_old;
    if v_delta <> 0 then
      v_tipo := case
        when v_delta < 0 then 'estorno'::public.lancamento_tipo
        when v_grupo = 'medicoes' then 'medicao'::public.lancamento_tipo
        when v_grupo = 'materiais' then 'material'::public.lancamento_tipo
        else 'aditivo'::public.lancamento_tipo
      end;
      insert into public.lancamentos (
        obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos
      ) values (
        p_obra.id,
        p_relatorio.id,
        p_versao.id,
        v_tipo,
        v_grupo::public.lancamento_grupo,
        'Ajuste consolidado da retificação v' || p_versao.numero::text,
        v_delta
      );
    end if;
  end loop;

  v_dias := coalesce((p_versao.snapshot#>>'{prazo,totalDiasAditivados}')::int, 0)
    - coalesce((p_anterior.snapshot#>>'{prazo,totalDiasAditivados}')::int, 0);
  if v_dias <> 0 then
    insert into public.dias_aditivados (
      obra_id, relatorio_id, versao_id, motivo, descricao, dias
    ) values (
      p_obra.id,
      p_relatorio.id,
      p_versao.id,
      'outro',
      'Ajuste de prazo da retificação v' || p_versao.numero::text,
      v_dias
    );
  end if;
end;
$$;

create or replace function public.fn_preparar_envio_relatorio(p_relatorio uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_falhou public.relatorio_versoes%rowtype;
  v_item jsonb;
  v_pct_ant int;
  v_versao_id uuid;
  v_snapshot jsonb;
  v_geral_antes int;
begin
  if v_user is null then raise exception 'NAO_AUTENTICADO'; end if;
  perform private.consumir_rate_limit(v_user, 'preparar_envio', 10, interval '1 hour');

  select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
  if not found then raise exception 'RELATORIO_AUSENTE'; end if;
  select * into v_obra from public.obras o where o.id = v_rel.obra_id for update;
  select * into v_ass from public.assinaturas s where s.user_id = v_obra.owner_id for update;
  if not found then raise exception 'ASSINATURA_AUSENTE'; end if;

  if v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_rel.status <> 'rascunho' then raise exception 'RELATORIO_INVALIDO'; end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if v_ass.status = 'trial' and v_ass.relatorios_enviados_trial >= 1 then
    raise exception 'TRIAL_LIMITE';
  end if;
  if exists (
    select 1 from public.relatorio_versoes v
    where v.obra_id = v_obra.id and v.status = 'processando'
  ) then raise exception 'ENVIO_PENDENTE'; end if;

  perform private.validar_rascunho(v_obra.id, v_rel.id, v_rel.dados_rascunho, true);
  for v_item in select * from jsonb_array_elements(v_rel.dados_rascunho->'etapas') loop
    select e.pct_atual into v_pct_ant from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = v_obra.id;
    if (v_item->>'pct')::int < v_pct_ant then raise exception 'PCT_REGREDIU'; end if;
  end loop;

  v_geral_antes := public.fn_avanco_geral(v_obra.id);
  v_snapshot := private.montar_snapshot(
    v_obra, v_rel, v_rel.dados_rascunho, v_geral_antes, pg_catalog.now()
  );

  select * into v_falhou
  from public.relatorio_versoes v
  where v.relatorio_id = v_rel.id
    and v.numero = 1
    and v.tipo = 'original'
    and v.status = 'falhou'
  for update;

  if found then
    v_versao_id := v_falhou.id;
    update public.relatorio_versoes
    set status = 'processando',
        snapshot = v_snapshot,
        dados_aplicacao = v_rel.dados_rascunho,
        motivo = null,
        criado_por = v_user,
        criado_em = pg_catalog.now(),
        publicado_em = null,
        pdf_path = null,
        pdf_sha256 = null
    where id = v_versao_id;
  else
    insert into public.relatorio_versoes (
      relatorio_id, obra_id, numero, tipo, status, snapshot,
      dados_aplicacao, criado_por
    ) values (
      v_rel.id, v_obra.id, 1, 'original', 'processando', v_snapshot,
      v_rel.dados_rascunho, v_user
    ) returning id into v_versao_id;
  end if;

  update public.relatorios
  set status = 'processando', versao_pendente_id = v_versao_id,
      erro_operacional = null
  where id = v_rel.id;

  return jsonb_build_object(
    'versaoId', v_versao_id, 'relatorioId', v_rel.id, 'obraId', v_obra.id,
    'numero', v_rel.numero, 'versaoNumero', 1, 'snapshot', v_snapshot
  );
end;
$$;

create or replace function public.fn_finalizar_envio_relatorio(
  p_versao uuid,
  p_pdf_path text,
  p_pdf_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_esperado text;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found then raise exception 'VERSAO_AUSENTE'; end if;
  select * into v_rel from public.relatorios r where r.id = v_versao.relatorio_id for update;
  select * into v_obra from public.obras o where o.id = v_versao.obra_id for update;
  select * into v_ass from public.assinaturas s where s.user_id = v_obra.owner_id for update;
  if not found then raise exception 'ASSINATURA_AUSENTE'; end if;

  if v_versao.status = 'publicada'
     and v_versao.pdf_path = p_pdf_path
     and v_versao.pdf_sha256 = p_pdf_sha256 then
    return jsonb_build_object(
      'versaoId', v_versao.id, 'relatorioId', v_rel.id,
      'status', 'enviado', 'idempotente', true
    );
  end if;
  if v_versao.status <> 'processando' or v_versao.tipo <> 'original'
     or v_rel.status <> 'processando'
     or v_rel.versao_pendente_id is distinct from v_versao.id then
    raise exception 'VERSAO_INVALIDA';
  end if;
  if v_obra.arquivada_em is not null then raise exception 'OBRA_ARQUIVADA'; end if;
  if not private.assinatura_permite_escrita(v_obra.owner_id) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if p_pdf_sha256 is null or p_pdf_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'PDF_HASH_INVALIDO';
  end if;
  v_esperado := v_obra.id::text || '/' || v_rel.id::text || '/v1-'
    || p_pdf_sha256 || '.pdf';
  if p_pdf_path is distinct from v_esperado then raise exception 'PDF_PATH_INVALIDO'; end if;
  perform private.validar_objeto_pdf(p_pdf_path);

  perform private.aplicar_efeitos_envio(
    v_obra, v_rel, v_versao, v_versao.dados_aplicacao, false, '{}'::jsonb
  );
  update public.relatorio_versoes
  set status = 'publicada', publicado_em = pg_catalog.now(),
      pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256
  where id = v_versao.id;
  update public.relatorios
  set status = 'enviado', snapshot = v_versao.snapshot, pdf_path = p_pdf_path,
      dados_rascunho = null, versao_atual_id = v_versao.id,
      versao_pendente_id = null,
      geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int,
      geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int,
      enviado_em = pg_catalog.now(), erro_operacional = null
  where id = v_rel.id;

  if v_ass.status = 'trial' then
    update public.assinaturas
    set relatorios_enviados_trial = least(relatorios_enviados_trial + 1, 1),
        atualizado_em = pg_catalog.now()
    where id = v_ass.id and relatorios_enviados_trial = 0;
  end if;
  return jsonb_build_object(
    'versaoId', v_versao.id, 'relatorioId', v_rel.id,
    'status', 'enviado', 'idempotente', false
  );
end;
$$;

create or replace function public.fn_preparar_retificacao(
  p_relatorio uuid,
  p_motivo text,
  p_dados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_atual public.relatorio_versoes%rowtype;
  v_falhou public.relatorio_versoes%rowtype;
  v_max_num int;
  v_piso jsonb := '{}'::jsonb;
  v_item jsonb;
  v_versao_id uuid;
  v_snapshot jsonb;
  v_prev_rel public.relatorios%rowtype;
begin
  if v_user is null then raise exception 'NAO_AUTENTICADO'; end if;
  perform private.consumir_rate_limit(v_user, 'preparar_envio', 10, interval '1 hour');
  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;

  select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
  if not found then raise exception 'RELATORIO_AUSENTE'; end if;
  select * into v_obra from public.obras o where o.id = v_rel.obra_id for update;
  if v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_rel.status <> 'enviado' or v_rel.versao_atual_id is null then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if not private.assinatura_permite_escrita(v_user) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  select coalesce(max(r.numero), 0) into v_max_num
  from public.relatorios r where r.obra_id = v_obra.id and r.status = 'enviado';
  if v_rel.numero <> v_max_num then raise exception 'NAO_E_ULTIMO'; end if;
  if exists (
    select 1 from public.relatorio_versoes v
    where v.obra_id = v_obra.id and v.status = 'processando'
  ) then raise exception 'VERSAO_PENDENTE'; end if;

  select * into v_atual from public.relatorio_versoes v
  where v.id = v_rel.versao_atual_id and v.status = 'publicada';
  if not found or v_atual.dados_aplicacao is null then
    raise exception 'RETIFICACAO_LEGADO_SEM_DADOS';
  end if;
  perform private.validar_rascunho(v_obra.id, v_rel.id, p_dados, true);

  select * into v_prev_rel from public.relatorios r
  where r.obra_id = v_obra.id and r.status = 'enviado' and r.numero < v_rel.numero
  order by r.numero desc limit 1;
  if found then
    for v_item in select * from jsonb_array_elements(coalesce(
      (select snapshot#>'{avancoFisico,etapas}' from public.relatorio_versoes
       where id = v_prev_rel.versao_atual_id), '[]'::jsonb
    )) loop
      v_piso := v_piso || jsonb_build_object(
        v_item->>'etapaId', (v_item->>'pctNovo')::int
      );
    end loop;
  end if;
  for v_item in select * from jsonb_array_elements(p_dados->'etapas') loop
    if (v_item->>'pct')::int < coalesce((v_piso->>(v_item->>'etapaId'))::int, 0) then
      raise exception 'PCT_ABAIXO_PISO';
    end if;
  end loop;

  v_snapshot := private.montar_snapshot_retificacao(
    v_obra, v_rel, v_atual, p_dados, pg_catalog.now()
  );
  select * into v_falhou
  from public.relatorio_versoes v
  where v.relatorio_id = v_rel.id
    and v.numero = v_atual.numero + 1
    and v.tipo = 'retificacao'
    and v.status = 'falhou'
  for update;
  if found then
    v_versao_id := v_falhou.id;
    update public.relatorio_versoes
    set status = 'processando', snapshot = v_snapshot, dados_aplicacao = p_dados,
        motivo = btrim(p_motivo), criado_por = v_user,
        criado_em = pg_catalog.now(), publicado_em = null,
        pdf_path = null, pdf_sha256 = null
    where id = v_versao_id;
  else
    insert into public.relatorio_versoes (
      relatorio_id, obra_id, numero, tipo, status, snapshot,
      dados_aplicacao, motivo, criado_por
    ) values (
      v_rel.id, v_obra.id, v_atual.numero + 1, 'retificacao', 'processando',
      v_snapshot, p_dados, btrim(p_motivo), v_user
    ) returning id into v_versao_id;
  end if;

  update public.relatorios
  set versao_pendente_id = v_versao_id, erro_operacional = null
  where id = v_rel.id;
  return jsonb_build_object(
    'versaoId', v_versao_id, 'relatorioId', v_rel.id, 'obraId', v_obra.id,
    'numero', v_rel.numero, 'versaoNumero', v_atual.numero + 1,
    'snapshot', v_snapshot
  );
end;
$$;

create or replace function public.fn_finalizar_retificacao(
  p_versao uuid,
  p_pdf_path text,
  p_pdf_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
  v_rel public.relatorios%rowtype;
  v_obra public.obras%rowtype;
  v_anterior public.relatorio_versoes%rowtype;
  v_esperado text;
  v_piso jsonb := '{}'::jsonb;
  v_item jsonb;
  v_prev public.relatorios%rowtype;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found then raise exception 'VERSAO_AUSENTE'; end if;
  select * into v_rel from public.relatorios r where r.id = v_versao.relatorio_id for update;
  select * into v_obra from public.obras o where o.id = v_versao.obra_id for update;
  select * into v_anterior from public.relatorio_versoes v
  where v.id = v_rel.versao_atual_id for update;

  if v_versao.status = 'publicada'
     and v_versao.pdf_path = p_pdf_path
     and v_versao.pdf_sha256 = p_pdf_sha256 then
    return jsonb_build_object(
      'versaoId', v_versao.id, 'relatorioId', v_rel.id, 'idempotente', true
    );
  end if;
  if v_versao.status <> 'processando' or v_versao.tipo <> 'retificacao'
     or v_rel.status <> 'enviado'
     or v_rel.versao_pendente_id is distinct from v_versao.id then
    raise exception 'VERSAO_INVALIDA';
  end if;
  if v_obra.arquivada_em is not null then raise exception 'OBRA_ARQUIVADA'; end if;
  if not private.assinatura_permite_escrita(v_obra.owner_id) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if p_pdf_sha256 is null or p_pdf_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'PDF_HASH_INVALIDO';
  end if;
  v_esperado := v_obra.id::text || '/' || v_rel.id::text || '/v'
    || v_versao.numero::text || '-' || p_pdf_sha256 || '.pdf';
  if p_pdf_path is distinct from v_esperado then raise exception 'PDF_PATH_INVALIDO'; end if;
  perform private.validar_objeto_pdf(p_pdf_path);

  select * into v_prev from public.relatorios r
  where r.obra_id = v_obra.id and r.status = 'enviado' and r.numero < v_rel.numero
  order by r.numero desc limit 1;
  if found then
    for v_item in select * from jsonb_array_elements(coalesce(
      (select snapshot#>'{avancoFisico,etapas}' from public.relatorio_versoes
       where id = v_prev.versao_atual_id), '[]'::jsonb
    )) loop
      v_piso := v_piso || jsonb_build_object(
        v_item->>'etapaId', (v_item->>'pctNovo')::int
      );
    end loop;
  end if;

  perform private.aplicar_efeitos_envio(
    v_obra, v_rel, v_versao, v_versao.dados_aplicacao, true, v_piso
  );
  perform private.aplicar_deltas_retificacao(
    v_obra, v_rel, v_versao, v_anterior, v_versao.dados_aplicacao
  );
  update public.relatorio_versoes
  set status = 'publicada', publicado_em = pg_catalog.now(),
      pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256
  where id = v_versao.id;
  update public.relatorios
  set versao_atual_id = v_versao.id, versao_pendente_id = null,
      snapshot = v_versao.snapshot, pdf_path = p_pdf_path,
      geral_antes = (v_versao.snapshot#>>'{avancoFisico,geralAntes}')::int,
      geral_depois = (v_versao.snapshot#>>'{avancoFisico,geralDepois}')::int,
      erro_operacional = null
  where id = v_rel.id;
  return jsonb_build_object(
    'versaoId', v_versao.id, 'relatorioId', v_rel.id, 'idempotente', false
  );
end;
$$;

create or replace function public.fn_marcar_versao_falhou(p_versao uuid, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versao public.relatorio_versoes%rowtype;
begin
  select * into v_versao from public.relatorio_versoes v where v.id = p_versao for update;
  if not found or v_versao.status <> 'processando' then return; end if;
  update public.relatorio_versoes set status = 'falhou' where id = p_versao;
  update public.relatorios
  set status = case when v_versao.tipo = 'original'
      then 'rascunho'::public.relatorio_status else 'enviado'::public.relatorio_status end,
      versao_pendente_id = null,
      erro_operacional = left(regexp_replace(
        coalesce(p_erro, 'FALHA_PDF'),
        '(email|token|key|sqlstate).*', 'erro operacional', 'gi'
      ), 180)
  where id = v_versao.relatorio_id;
end;
$$;

create or replace function public.fn_dados_versao_atual(p_relatorio uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select v.dados_aplicacao into v_result
  from public.relatorios r
  join public.relatorio_versoes v on v.id = r.versao_atual_id
  where r.id = p_relatorio
    and private.eh_dono_obra_ativa(r.obra_id)
    and r.status = 'enviado'
    and v.status = 'publicada';
  if not found then raise exception 'SEM_PERMISSAO'; end if;
  return v_result;
end;
$$;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.eh_dono_obra_ativa(uuid) to authenticated;
grant execute on function private.eh_dono_obra(uuid) to authenticated;
grant execute on function private.tem_acesso_obra_ativa(uuid) to authenticated;
grant execute on function public.fn_dados_versao_atual(uuid) to authenticated;
