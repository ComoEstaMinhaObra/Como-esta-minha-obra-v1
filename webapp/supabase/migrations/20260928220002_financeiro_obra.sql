-- 20260928220002_financeiro_obra.sql
-- Fase 1 do plano financeiro (28/09/2026): contrato > 0, supressão, estornos
-- vinculados, invariantes de contratado/pago, sinal no primeiro relatório e
-- fim da retificação.
--
-- As constraints novas nascem NOT VALID: o banco só contém dados de teste
-- internos, e o resultado da validação deve ser conferido antes de VALIDATE.

-- ===== contrato e lançamentos =====
alter table public.obras
  add constraint obras_valor_contratado_positivo
  check (valor_contratado_centavos > 0) not valid;

alter table public.lancamentos
  add column if not exists lancamento_origem_id uuid;

alter table public.lancamentos
  add constraint lancamentos_id_obra_key unique (id, obra_id);

alter table public.lancamentos
  add constraint lancamentos_origem_fk
  foreign key (lancamento_origem_id, obra_id)
  references public.lancamentos (id, obra_id);

alter table public.lancamentos
  add constraint lancamentos_estorno_origem_chk
  check ((tipo = 'estorno') = (lancamento_origem_id is not null)) not valid;

alter table public.lancamentos
  add constraint lancamentos_valor_sinal_chk
  check (
    (tipo = 'estorno' and valor_centavos < 0)
    or (tipo <> 'estorno' and valor_centavos > 0)
  ) not valid;

create index if not exists lancamentos_origem_idx
  on public.lancamentos (lancamento_origem_id)
  where lancamento_origem_id is not null;

create unique index if not exists lancamentos_obra_tipo_numero_uidx
  on public.lancamentos (obra_id, tipo, numero)
  where numero is not null;

update public.lancamentos
set rotulo = 'Sinal'
where tipo = 'sinal' and rotulo <> 'Sinal';

-- ===== totais da obra (fonte única das invariantes) =====
create or replace function private.totais_obra(p_obra uuid)
returns table (contratado bigint, pago bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.valor_centavos
      + coalesce(sum(l.valor_centavos) filter (where l.tipo = 'aditivo'), 0)
      - coalesce(sum(l.valor_centavos) filter (where l.tipo = 'supressao'), 0)
      + coalesce(sum(l.valor_centavos) filter (
          where l.tipo = 'estorno' and l.grupo = 'aditivos'), 0),
    coalesce(sum(l.valor_centavos) filter (
      where l.tipo in ('sinal', 'medicao', 'material')
         or (l.tipo = 'estorno' and l.grupo <> 'aditivos')), 0)
  from (
    select ob.valor_contratado_centavos as valor_centavos
    from public.obras ob where ob.id = p_obra
  ) o
  left join public.lancamentos l on l.obra_id = p_obra
  group by o.valor_centavos;
$$;

-- ===== validação dos estornos do rascunho =====
create or replace function private.validar_estornos_rascunho(
  p_obra uuid,
  p_estornos jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_origem_txt text;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_estornos, '[]'::jsonb)) loop
    v_origem_txt := v_item->>'origemId';
    if v_origem_txt is null
       or v_origem_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'ESTORNO_ORIGEM_INVALIDA';
    end if;
    perform 1 from public.lancamentos o
    where o.id = v_origem_txt::uuid
      and o.obra_id = p_obra
      and o.tipo in ('sinal', 'medicao', 'material', 'aditivo');
    if not found then
      raise exception 'ESTORNO_ORIGEM_INVALIDA';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select
        o.valor_centavos,
        coalesce((
          select -sum(e.valor_centavos)
          from public.lancamentos e
          where e.lancamento_origem_id = o.id
        ), 0) as ja_estornado,
        sum((x.item->>'valorCentavos')::bigint) as novo
      from jsonb_array_elements(coalesce(p_estornos, '[]'::jsonb)) x(item)
      join public.lancamentos o on o.id = (x.item->>'origemId')::uuid
      group by o.id, o.valor_centavos
    ) t
    where t.ja_estornado + t.novo > t.valor_centavos
  ) then
    raise exception 'ESTORNO_ACIMA_ORIGEM';
  end if;
end;
$$;

-- ===== validação do rascunho =====
create or replace function private.validar_rascunho(
  p_obra uuid,
  p_relatorio uuid,
  p_rascunho jsonb,
  p_exigir_reservas boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_path text;
  v_count int;
  v_fotos int;
  v_rel public.relatorios%rowtype;
begin
  if p_rascunho is null
     or coalesce((p_rascunho->>'versao')::int, 0) <> 1
     or jsonb_typeof(p_rascunho->'etapas') is distinct from 'array'
     or jsonb_typeof(p_rascunho->'financeiro') is distinct from 'object'
     or jsonb_typeof(p_rascunho->'atividades') is distinct from 'array'
     or jsonb_typeof(p_rascunho->'prazo') is distinct from 'array' then
    raise exception 'RASCUNHO_INVALIDO';
  end if;

  select * into v_rel
  from public.relatorios r
  where r.id = p_relatorio and r.obra_id = p_obra;

  select count(*) into v_count
  from jsonb_array_elements(p_rascunho->'etapas') x;
  if v_count <> (select count(*) from public.etapas e where e.obra_id = p_obra)
     or v_count <> (
       select count(distinct (x.item->>'etapaId'))
       from jsonb_array_elements(p_rascunho->'etapas') x(item)
     ) then
    raise exception 'ETAPAS_INCOMPLETAS';
  end if;

  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    perform 1 from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;
    if (v_item->>'pct')::int not between 0 and 100 then
      raise exception 'PCT_INVALIDO';
    end if;
  end loop;

  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'supressoes', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)
    )
  loop
    if coalesce((v_item->>'valorCentavos')::bigint, 0) <= 0 then
      raise exception 'VALOR_INVALIDO';
    end if;
  end loop;

  for v_item in
    select * from jsonb_array_elements(
      coalesce(p_rascunho->'financeiro'->'supressoes', '[]'::jsonb)
      || coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)
    )
  loop
    if length(btrim(coalesce(v_item->>'descricao', ''))) = 0 then
      raise exception 'DADOS_INVALIDOS';
    end if;
  end loop;

  perform private.validar_estornos_rascunho(
    p_obra, p_rascunho->'financeiro'->'estornos'
  );

  for v_item in select * from jsonb_array_elements(p_rascunho->'prazo') loop
    if coalesce((v_item->>'dias')::int, 0) <= 0 then
      raise exception 'DIAS_INVALIDOS';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_rascunho->'atividades') loop
    perform 1 from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra;
    if not found then
      raise exception 'ETAPA_INVALIDA';
    end if;

    v_fotos := jsonb_array_length(coalesce(v_item->'fotosPaths', '[]'::jsonb));
    if v_fotos > 12 then
      raise exception 'LIMITE_FOTOS';
    end if;

    if p_exigir_reservas then
      for v_path in
        select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb))
      loop
        select count(*) into v_count
        from public.fotos f
        where f.storage_path = v_path
          and f.obra_id = p_obra
          and f.relatorio_id = p_relatorio
          and f.etapa_id = (v_item->>'etapaId')::uuid
          and (
            (f.estado = 'reservada' and f.versao_id is null)
            or (
              v_rel.versao_atual_id is not null
              and f.estado = 'publicada'
              and exists (
                select 1
                from public.relatorio_versoes fv
                where fv.id = f.versao_id
                  and fv.relatorio_id = p_relatorio
                  and fv.status = 'publicada'
              )
            )
          )
          and exists (
            select 1 from storage.objects so
            where so.bucket_id = 'fotos'
              and so.name = f.storage_path
              and lower(coalesce(so.metadata->>'mimetype', '')) = 'image/webp'
          );
        if v_count <> 1 then
          raise exception 'FOTO_SEM_RESERVA';
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

-- ===== criação da obra =====
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
    values (v_obra_id, 'sinal', 'medicoes', 'Sinal', p_sinal_centavos);
  end if;

  return v_obra_id;
end;
$$;

-- ===== rótulos =====
create or replace function public.fn_proximos_rotulos(p_obra uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max_medicao int;
  v_max_aditivo int;
  v_max_supressao int;
begin
  if not private.eh_dono_obra_ativa(p_obra) and not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  select coalesce(max(l.numero) filter (where l.tipo = 'medicao'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'aditivo'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'supressao'), 0)
    into v_max_medicao, v_max_aditivo, v_max_supressao
  from public.lancamentos l where l.obra_id = p_obra;
  return jsonb_build_object(
    'proximaMedicao', 'Medição ' || lpad((v_max_medicao + 1)::text, 2, '0'),
    'proximoAditivo', 'Aditivo ' || lpad((v_max_aditivo + 1)::text, 2, '0'),
    'proximaSupressao', 'Supressão ' || lpad((v_max_supressao + 1)::text, 2, '0')
  );
end;
$$;

-- ===== saldo estornável por lançamento de origem =====
create or replace function public.fn_saldo_estornavel(p_obra uuid)
returns table (
  lancamento_id uuid,
  tipo public.lancamento_tipo,
  rotulo text,
  valor_centavos bigint,
  estornado_centavos bigint,
  saldo_centavos bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.eh_dono_obra_ativa(p_obra) and not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;
  return query
  select
    l.id,
    l.tipo,
    l.rotulo,
    l.valor_centavos,
    coalesce(-sum(e.valor_centavos), 0)::bigint,
    (l.valor_centavos + coalesce(sum(e.valor_centavos), 0))::bigint
  from public.lancamentos l
  left join public.lancamentos e on e.lancamento_origem_id = l.id
  where l.obra_id = p_obra
    and l.tipo in ('sinal', 'medicao', 'material', 'aditivo')
  group by l.id
  order by l.criado_em, l.numero nulls first, l.id;
end;
$$;

-- ===== snapshot do envio =====
create or replace function private.montar_snapshot(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_rascunho jsonb,
  p_geral_antes int,
  p_enviado_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_etapas_snap jsonb := '[]'::jsonb;
  v_lanc_novos jsonb := '[]'::jsonb;
  v_atividades_snap jsonb := '[]'::jsonb;
  v_prazo_novos jsonb := '[]'::jsonb;
  v_clima jsonb := '[]'::jsonb;
  v_pct_ant int;
  v_etapa_nome text;
  v_etapa_peso numeric;
  v_max_medicao int;
  v_max_aditivo int;
  v_max_supressao int;
  v_idx int;
  v_num int;
  v_rotulo text;
  v_grupo public.lancamento_grupo;
  v_origem public.lancamentos%rowtype;
  v_aditivos_acum bigint;
  v_supressoes_acum bigint;
  v_pago_acum bigint;
  v_contratado_total bigint;
  v_pct_pago int;
  v_saldo bigint;
  v_dias_total int;
  v_nova_data date;
  v_geral_depois int;
  v_peso_sum numeric := 0;
  v_peso_pct numeric := 0;
  v_map_pct jsonb := '{}'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    select e.pct_atual, e.nome, e.peso
      into v_pct_ant, v_etapa_nome, v_etapa_peso
    from public.etapas e
    where e.id = (v_item->>'etapaId')::uuid and e.obra_id = p_obra.id;

    v_map_pct := v_map_pct || jsonb_build_object((v_item->>'etapaId'), (v_item->>'pct')::int);
    v_etapas_snap := v_etapas_snap || jsonb_build_array(jsonb_build_object(
      'etapaId', v_item->>'etapaId',
      'nome', v_etapa_nome,
      'peso', v_etapa_peso,
      'pctAnterior', v_pct_ant,
      'pctNovo', (v_item->>'pct')::int
    ));
  end loop;

  for v_item in
    select jsonb_build_object('id', e.id, 'peso', e.peso, 'pct', e.pct_atual)
    from public.etapas e where e.obra_id = p_obra.id
  loop
    v_peso_sum := v_peso_sum + (v_item->>'peso')::numeric;
    v_peso_pct := v_peso_pct + (v_item->>'peso')::numeric
      * coalesce((v_map_pct->>(v_item->>'id'))::int, (v_item->>'pct')::int);
  end loop;
  v_geral_depois := coalesce(round(v_peso_pct / nullif(v_peso_sum, 0))::int, 0);

  select coalesce(max(l.numero) filter (where l.tipo = 'medicao'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'aditivo'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'supressao'), 0)
    into v_max_medicao, v_max_aditivo, v_max_supressao
  from public.lancamentos l where l.obra_id = p_obra.id;

  -- O sinal criado com a obra ainda não pertence a nenhum relatório; ele passa
  -- a integrar o primeiro relatório enviado, antes das medições. Já compõe o
  -- pago acumulado da tabela e por isso não é somado de novo mais abaixo.
  for v_item in
    select jsonb_build_object(
      'tipo', 'sinal', 'grupo', 'medicoes', 'rotulo', 'Sinal',
      'valorCentavos', l.valor_centavos
    )
    from public.lancamentos l
    where l.obra_id = p_obra.id and l.tipo = 'sinal' and l.relatorio_id is null
    order by l.criado_em
  loop
    v_lanc_novos := v_lanc_novos || jsonb_build_array(v_item);
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_medicao + v_idx;
    v_rotulo := 'Medição ' || lpad(v_num::text, 2, '0');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'medicao', 'grupo', 'medicoes', 'numero', v_num, 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)) loop
    v_rotulo := v_item->>'rotulo';
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'material', 'grupo', 'materiais', 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_aditivo + v_idx;
    v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'aditivo', 'grupo', 'aditivos', 'numero', v_num, 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'supressoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_supressao + v_idx;
    v_rotulo := 'Supressão ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'supressao', 'grupo', 'supressoes', 'numero', v_num, 'rotulo', v_rotulo,
      'valorCentavos', (v_item->>'valorCentavos')::bigint
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)) loop
    select * into v_origem from public.lancamentos o
    where o.id = (v_item->>'origemId')::uuid and o.obra_id = p_obra.id;
    v_grupo := private.grupo_do_estorno(v_origem.tipo);
    v_rotulo := 'Estorno — ' || (v_item->>'descricao');
    v_lanc_novos := v_lanc_novos || jsonb_build_array(jsonb_build_object(
      'tipo', 'estorno', 'grupo', v_grupo, 'rotulo', v_rotulo,
      'origemId', v_origem.id,
      'valorCentavos', -abs((v_item->>'valorCentavos')::bigint)
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'atividades', '[]'::jsonb)) loop
    select e.nome into v_etapa_nome from public.etapas e where e.id = (v_item->>'etapaId')::uuid;
    v_atividades_snap := v_atividades_snap || jsonb_build_array(jsonb_build_object(
      'etapaId', v_item->>'etapaId',
      'etapaNome', v_etapa_nome,
      'nota', coalesce(v_item->>'nota', ''),
      'fotosPaths', coalesce(v_item->'fotosPaths', '[]'::jsonb)
    ));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'prazo', '[]'::jsonb)) loop
    v_prazo_novos := v_prazo_novos || jsonb_build_array(jsonb_build_object(
      'motivo', v_item->>'motivo',
      'descricao', v_item->>'descricao',
      'dias', (v_item->>'dias')::int
    ));
  end loop;

  select coalesce(sum(l.valor_centavos), 0) into v_pago_acum
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and l.tipo in ('sinal', 'medicao', 'material', 'estorno')
    and not (l.tipo = 'estorno' and l.grupo = 'aditivos');

  select coalesce(sum(l.valor_centavos), 0) into v_aditivos_acum
  from public.lancamentos l
  where l.obra_id = p_obra.id
    and (l.tipo = 'aditivo' or (l.tipo = 'estorno' and l.grupo = 'aditivos'));

  select coalesce(sum(l.valor_centavos), 0) into v_supressoes_acum
  from public.lancamentos l
  where l.obra_id = p_obra.id and l.tipo = 'supressao';

  -- incluir novos no acumulado projetado (o sinal pendente já está na tabela)
  select v_pago_acum + coalesce(sum((x.elem->>'valorCentavos')::bigint), 0)
    into v_pago_acum
  from jsonb_array_elements(v_lanc_novos) as x(elem)
  where (x.elem->>'tipo') in ('medicao', 'material', 'estorno')
    and not ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  select v_aditivos_acum + coalesce(sum((x.elem->>'valorCentavos')::bigint), 0)
    into v_aditivos_acum
  from jsonb_array_elements(v_lanc_novos) as x(elem)
  where (x.elem->>'tipo') = 'aditivo'
     or ((x.elem->>'tipo') = 'estorno' and (x.elem->>'grupo') = 'aditivos');

  select v_supressoes_acum + coalesce(sum((x.elem->>'valorCentavos')::bigint), 0)
    into v_supressoes_acum
  from jsonb_array_elements(v_lanc_novos) as x(elem)
  where (x.elem->>'tipo') = 'supressao';

  v_contratado_total := p_obra.valor_contratado_centavos + v_aditivos_acum - v_supressoes_acum;
  if v_contratado_total > 0 then
    v_pct_pago := round((v_pago_acum::numeric / v_contratado_total::numeric) * 100)::int;
  else
    v_pct_pago := 0;
  end if;
  v_saldo := v_contratado_total - v_pago_acum;

  select coalesce(sum(d.dias), 0) into v_dias_total
  from public.dias_aditivados d where d.obra_id = p_obra.id;
  select v_dias_total + coalesce(sum((x.elem->>'dias')::int), 0)
    into v_dias_total
  from jsonb_array_elements(v_prazo_novos) as x(elem);
  v_nova_data := p_obra.termino_contratual + v_dias_total;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'data', cs.data,
      'condicao', cs.condicao,
      'probChuva', cs.prob_chuva
    ) order by cs.data
  ), '[]'::jsonb)
  into v_clima
  from public.clima_snapshots cs
  where cs.obra_id = p_obra.id
    and cs.data >= (current_date - 7)
    and cs.data <= current_date;

  return jsonb_build_object(
    'versao', 1,
    'numero', p_relatorio.numero,
    'enviadoEm', to_jsonb(p_enviado_em),
    'obra', jsonb_build_object(
      'nome', p_obra.nome,
      'endereco', p_obra.endereco,
      'clienteNome', p_obra.cliente_nome,
      'construtora', p_obra.construtora,
      'engenheiro', p_obra.engenheiro,
      'escritorioArquitetura', p_obra.escritorio_arquitetura,
      'arquiteto', p_obra.arquiteto,
      'projetistaEstruturas', p_obra.projetista_estruturas,
      'projetistaInstalacoes', p_obra.projetista_instalacoes,
      'inicioContratual', p_obra.inicio_contratual,
      'terminoContratual', p_obra.termino_contratual
    ),
    'avancoFisico', jsonb_build_object(
      'geralAntes', p_geral_antes,
      'geralDepois', v_geral_depois,
      'etapas', v_etapas_snap
    ),
    'financeiro', jsonb_build_object(
      'valorContratadoCentavos', p_obra.valor_contratado_centavos,
      'aditivosAcumuladoCentavos', v_aditivos_acum,
      'supressoesAcumuladoCentavos', v_supressoes_acum,
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
end;
$$;

-- Grupo contábil do estorno, derivado do tipo do lançamento de origem.
create or replace function private.grupo_do_estorno(p_tipo public.lancamento_tipo)
returns public.lancamento_grupo
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'aditivo' then 'aditivos'::public.lancamento_grupo
    when 'material' then 'materiais'::public.lancamento_grupo
    else 'medicoes'::public.lancamento_grupo
  end;
$$;

-- ===== efeitos do envio (sem modo retificação) =====
drop function if exists private.aplicar_efeitos_envio(
  public.obras, public.relatorios, public.relatorio_versoes, jsonb, boolean, jsonb
);

create or replace function private.aplicar_efeitos_envio(
  p_obra public.obras,
  p_relatorio public.relatorios,
  p_versao public.relatorio_versoes,
  p_rascunho jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_pct int;
  v_pct_ant int;
  v_max_medicao int;
  v_max_aditivo int;
  v_max_supressao int;
  v_idx int;
  v_num int;
  v_rotulo text;
  v_origem public.lancamentos%rowtype;
  v_atividade_id uuid;
  v_foto_path text;
  v_foto_ordem int;
  v_etapa_id uuid;
begin
  for v_item in select * from jsonb_array_elements(p_rascunho->'etapas') loop
    v_etapa_id := (v_item->>'etapaId')::uuid;
    v_pct := (v_item->>'pct')::int;
    select e.pct_atual into v_pct_ant
    from public.etapas e where e.id = v_etapa_id and e.obra_id = p_obra.id;

    if v_pct < v_pct_ant then
      raise exception 'PCT_REGREDIU';
    end if;

    update public.etapas set pct_atual = v_pct where id = v_etapa_id;

    insert into public.relatorio_etapas (relatorio_id, etapa_id, pct, obra_id, versao_id)
    values (p_relatorio.id, v_etapa_id, v_pct, p_obra.id, p_versao.id);
  end loop;

  select coalesce(max(l.numero) filter (where l.tipo = 'medicao'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'aditivo'), 0),
         coalesce(max(l.numero) filter (where l.tipo = 'supressao'), 0)
    into v_max_medicao, v_max_aditivo, v_max_supressao
  from public.lancamentos l where l.obra_id = p_obra.id;

  -- O sinal da criação da obra entra no primeiro relatório enviado.
  update public.lancamentos
  set relatorio_id = p_relatorio.id, versao_id = p_versao.id
  where obra_id = p_obra.id and tipo = 'sinal' and relatorio_id is null;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'medicoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_medicao + v_idx;
    v_rotulo := 'Medição ' || lpad(v_num::text, 2, '0');
    insert into public.lancamentos (
      obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'medicao', 'medicoes', v_num, v_rotulo,
      (v_item->>'valorCentavos')::bigint
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'materiais', '[]'::jsonb)) loop
    insert into public.lancamentos (
      obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'material', 'materiais',
      v_item->>'rotulo', (v_item->>'valorCentavos')::bigint
    );
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'aditivos', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_aditivo + v_idx;
    v_rotulo := 'Aditivo ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    insert into public.lancamentos (
      obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'aditivo', 'aditivos', v_num, v_rotulo,
      (v_item->>'valorCentavos')::bigint
    );
  end loop;

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'supressoes', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_num := v_max_supressao + v_idx;
    v_rotulo := 'Supressão ' || lpad(v_num::text, 2, '0') || ' — ' || (v_item->>'descricao');
    insert into public.lancamentos (
      obra_id, relatorio_id, versao_id, tipo, grupo, numero, rotulo, valor_centavos
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'supressao', 'supressoes', v_num, v_rotulo,
      (v_item->>'valorCentavos')::bigint
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'financeiro'->'estornos', '[]'::jsonb)) loop
    select * into v_origem from public.lancamentos o
    where o.id = (v_item->>'origemId')::uuid and o.obra_id = p_obra.id;
    insert into public.lancamentos (
      obra_id, relatorio_id, versao_id, tipo, grupo, rotulo, valor_centavos,
      lancamento_origem_id
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id, 'estorno',
      private.grupo_do_estorno(v_origem.tipo),
      'Estorno — ' || (v_item->>'descricao'),
      -abs((v_item->>'valorCentavos')::bigint),
      v_origem.id
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'prazo', '[]'::jsonb)) loop
    insert into public.dias_aditivados (
      obra_id, relatorio_id, versao_id, motivo, descricao, dias
    ) values (
      p_obra.id, p_relatorio.id, p_versao.id,
      (v_item->>'motivo')::public.motivo_aditivo,
      v_item->>'descricao',
      (v_item->>'dias')::int
    );
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_rascunho->'atividades', '[]'::jsonb)) loop
    insert into public.atividades (relatorio_id, etapa_id, nota, obra_id, versao_id)
    values (
      p_relatorio.id, (v_item->>'etapaId')::uuid, coalesce(v_item->>'nota', ''),
      p_obra.id, p_versao.id
    )
    returning id into v_atividade_id;

    v_foto_ordem := 0;
    for v_foto_path in select jsonb_array_elements_text(coalesce(v_item->'fotosPaths', '[]'::jsonb)) loop
      v_foto_ordem := v_foto_ordem + 1;
      update public.fotos
      set atividade_id = v_atividade_id,
          versao_id = p_versao.id,
          estado = 'publicada',
          ordem = v_foto_ordem
      where storage_path = v_foto_path
        and obra_id = p_obra.id
        and relatorio_id = p_relatorio.id
        and estado = 'reservada'
        and versao_id is null;
    end loop;
  end loop;
end;
$$;

-- ===== preparar / finalizar envio =====
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
  v_contratado bigint;
  v_pago bigint;
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

  -- valida valores > 0, origem e teto dos estornos
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

  -- invariantes no estado final do relatório
  v_contratado := (v_snapshot#>>'{financeiro,contratadoTotalCentavos}')::bigint;
  v_pago := (v_snapshot#>>'{financeiro,pagoAcumuladoCentavos}')::bigint;
  if v_contratado <= 0 then raise exception 'CONTRATADO_INVALIDO'; end if;
  if v_pago < 0 then raise exception 'PAGO_NEGATIVO'; end if;
  if v_pago > v_contratado then raise exception 'PAGO_ACIMA_CONTRATADO'; end if;

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
    v_obra, v_rel, v_versao, v_versao.dados_aplicacao
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

-- ===== rede de segurança: revalida os totais no fim da transação =====
create or replace function private.checar_totais_obra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contratado bigint;
  v_pago bigint;
  v_origem public.lancamentos%rowtype;
  v_estornado bigint;
begin
  select t.contratado, t.pago into v_contratado, v_pago
  from private.totais_obra(new.obra_id) t;

  if v_contratado <= 0 then raise exception 'CONTRATADO_INVALIDO'; end if;
  if v_pago < 0 then raise exception 'PAGO_NEGATIVO'; end if;
  if v_pago > v_contratado then raise exception 'PAGO_ACIMA_CONTRATADO'; end if;

  if new.tipo = 'estorno' then
    select * into v_origem from public.lancamentos o
    where o.id = new.lancamento_origem_id;
    if not found
       or v_origem.obra_id <> new.obra_id
       or v_origem.tipo not in ('sinal', 'medicao', 'material', 'aditivo') then
      raise exception 'ESTORNO_ORIGEM_INVALIDA';
    end if;
    select coalesce(-sum(e.valor_centavos), 0) into v_estornado
    from public.lancamentos e where e.lancamento_origem_id = v_origem.id;
    if v_estornado > v_origem.valor_centavos then
      raise exception 'ESTORNO_ACIMA_ORIGEM';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger trg_lancamentos_totais
  after insert on public.lancamentos
  deferrable initially deferred
  for each row execute function private.checar_totais_obra();

-- ===== remoção da retificação =====
drop function if exists public.fn_preparar_retificacao(uuid, text, jsonb);
drop function if exists public.fn_finalizar_retificacao(uuid, text, text);
drop function if exists private.montar_snapshot_retificacao(
  public.obras, public.relatorios, public.relatorio_versoes, jsonb, timestamptz
);
drop function if exists private.aplicar_deltas_retificacao(
  public.obras, public.relatorios, public.relatorio_versoes,
  public.relatorio_versoes, jsonb
);

alter table public.relatorio_versoes
  add constraint relatorio_versoes_somente_original
  check (tipo = 'original') not valid;

-- ===== privilégios =====
revoke execute on function private.totais_obra(uuid) from public, anon, authenticated;
revoke execute on function private.validar_estornos_rascunho(uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.grupo_do_estorno(public.lancamento_tipo) from public, anon, authenticated;
revoke execute on function private.checar_totais_obra() from public, anon, authenticated;
revoke execute on function private.aplicar_efeitos_envio(
  public.obras, public.relatorios, public.relatorio_versoes, jsonb
) from public, anon, authenticated;
revoke execute on function private.montar_snapshot(
  public.obras, public.relatorios, jsonb, int, timestamptz
) from public, anon, authenticated;
revoke execute on function private.validar_rascunho(uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;

revoke execute on function public.fn_saldo_estornavel(uuid) from public, anon;
grant execute on function public.fn_saldo_estornavel(uuid) to authenticated;
revoke execute on function public.fn_finalizar_envio_relatorio(uuid, text, text)
  from public, anon, authenticated;
