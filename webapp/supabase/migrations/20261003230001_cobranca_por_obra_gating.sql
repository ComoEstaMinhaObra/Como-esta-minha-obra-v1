-- E3 do plano da tela de Cobrança (03/10/2026): cobrança por obra, gating e gravação.
-- Decisões: planos-cursor-pre-lançamento/decisoes-financeiras-2026-09-28.md (2.1, 2.2, 2.6, 2.7, 2.9).
-- Plano: planos-cursor-pre-lançamento/plano-tela-assinatura-2026-10-01.md (5.3 a 5.8).
--
-- 1) Funções de gravação da cobrança (webhook e job, só service_role; cancelar, só o dono).
-- 2) Gating por obra nas funções existentes (private.obra_permite_escrita).
-- 3) Criar obra sem limite para quem paga; trial continua com uma obra.
-- plano e limite_obras permanecem na tabela assinaturas, sem uso, até a E5.

-- Ajuste da E2: obra com histórico de cobrança sem cobrança vigente fica somente leitura, e o trial
-- vale só para quem nunca teve cobrança (quem já pagou uma obra deixou o trial para trás).
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
  if v_ass.status = 'trial' then
    return v_ass.trial_fim is not null and pg_catalog.now() <= v_ass.trial_fim
      and not exists (select 1 from public.cobrancas_obra c where c.user_id = v_owner);
  end if;

  -- legado (fase expandir): conta ativa do modelo antigo; sai na E5
  return v_ass.status = 'ativa';
end;
$$;

revoke all on function private.obra_permite_escrita(uuid) from public, anon, authenticated;

-- O usuário tem alguma cobrança vigente? (cria obras sem limite)
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
  select exists (
    select 1
    from public.cobrancas_obra c
    where c.user_id = p_user
      and (
        c.status = 'ativa'
        or (c.status = 'cancelamento_agendado' and p_agora <= c.acesso_ate)
      )
  );
$$;

revoke all on function private.usuario_tem_cobranca_vigente(uuid, timestamptz) from public, anon, authenticated;

-- ===== gravação pelo webhook (somente service_role) =====

-- Assinatura confirmada (subscription.completed / subscription.trial_started). Idempotente por assinatura.
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

  return pg_catalog.jsonb_build_object('id', v_id, 'criada', true, 'status', 'ativa');
end;
$$;

-- Cobrança do ciclo paga (subscription.renewed). Volta de inadimplente para ativa.
-- Assinatura cancelada ou com cancelamento agendado ignora a renovação.
create or replace function public.fn_cobranca_renovar(
  p_subscription_id text,
  p_agora timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.cobrancas_obra%rowtype;
begin
  select * into v
  from public.cobrancas_obra c
  where c.abacatepay_subscription_id = p_subscription_id
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;

  if v.status in ('ativa', 'inadimplente') then
    update public.cobrancas_obra
    set status = 'ativa',
        inadimplente_desde = null,
        periodo_inicio = p_agora,
        periodo_fim = p_agora + interval '1 month'
    where id = v.id;
    return pg_catalog.jsonb_build_object(
      'id', v.id, 'alterada', true, 'status', 'ativa', 'estavaInadimplente', v.status = 'inadimplente'
    );
  end if;

  return pg_catalog.jsonb_build_object('id', v.id, 'alterada', false, 'status', v.status);
end;
$$;

-- Assinatura cancelada no provedor (subscription.cancelled). O payload não traz o motivo:
-- cancelamento pedido pelo app já está como cancelamento_agendado (no-op); sem pedido do app
-- (tentativas esgotadas ou cancelamento direto no painel) vira cancelada e o admin é alertado.
create or replace function public.fn_cobranca_cancelada_webhook(
  p_subscription_id text,
  p_agora timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.cobrancas_obra%rowtype;
begin
  select * into v
  from public.cobrancas_obra c
  where c.abacatepay_subscription_id = p_subscription_id
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;

  if v.status = 'cancelamento_agendado' then
    return pg_catalog.jsonb_build_object('id', v.id, 'resultado', 'ja_agendado');
  end if;
  if v.status = 'cancelada' then
    return pg_catalog.jsonb_build_object('id', v.id, 'resultado', 'ja_cancelada');
  end if;

  if v.cancelamento_solicitado_em is not null then
    update public.cobrancas_obra
    set status = 'cancelamento_agendado',
        acesso_ate = coalesce(v.acesso_ate, v.periodo_fim)
    where id = v.id;
    return pg_catalog.jsonb_build_object('id', v.id, 'resultado', 'agendado_pelo_app');
  end if;

  update public.cobrancas_obra
  set status = 'cancelada', acesso_ate = p_agora
  where id = v.id;
  return pg_catalog.jsonb_build_object('id', v.id, 'resultado', 'cancelada_sem_pedido');
end;
$$;

-- ===== cancelamento pelo dono da obra =====

-- Grava a intenção ANTES de chamar o provedor (que cancela na hora). Mantém os recursos até o
-- fim do período já pago (acesso_ate = periodo_fim). Só cancela cobrança ativa.
create or replace function public.fn_cobranca_solicitar_cancelamento(p_obra uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v public.cobrancas_obra%rowtype;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v
  from public.cobrancas_obra c
  where c.obra_id = p_obra and c.user_id = v_user and c.status <> 'cancelada'
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;
  if v.status <> 'ativa' then
    raise exception 'COBRANCA_NAO_CANCELAVEL';
  end if;

  update public.cobrancas_obra
  set status = 'cancelamento_agendado',
      cancelamento_solicitado_em = pg_catalog.now(),
      acesso_ate = v.periodo_fim
  where id = v.id;

  return pg_catalog.jsonb_build_object(
    'cobrancaId', v.id,
    'subscriptionId', v.abacatepay_subscription_id,
    'acessoAte', v.periodo_fim
  );
end;
$$;

-- Desfaz o cancelamento quando a chamada ao provedor falha. Só vale logo depois do pedido.
create or replace function public.fn_cobranca_desfazer_cancelamento(p_obra uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v public.cobrancas_obra%rowtype;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v
  from public.cobrancas_obra c
  where c.obra_id = p_obra and c.user_id = v_user and c.status = 'cancelamento_agendado'
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;
  if v.cancelamento_solicitado_em is null
     or v.cancelamento_solicitado_em < pg_catalog.now() - interval '10 minutes' then
    raise exception 'COBRANCA_NAO_DESFAZIVEL';
  end if;

  update public.cobrancas_obra
  set status = 'ativa', cancelamento_solicitado_em = null, acesso_ate = null
  where id = v.id;
end;
$$;

-- ===== job diário (somente service_role) =====
-- O AbacatePay não avisa falha de pagamento; o app infere pelo período vencido.
create or replace function public.fn_cobranca_job_diario(
  p_agora timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novas jsonb;
  v_agendadas int;
  v_inadimplencia int;
begin
  -- ativa com o período vencido há mais de um dia e sem renovação -> inadimplente
  with t as (
    update public.cobrancas_obra
    set status = 'inadimplente', inadimplente_desde = p_agora
    where status = 'ativa' and periodo_fim + interval '1 day' < p_agora
    returning id, user_id, obra_id
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('cobrancaId', id, 'userId', user_id, 'obraId', obra_id)
    ), '[]'::jsonb)
  into v_novas from t;

  -- cancelamento agendado com o período pago encerrado -> cancelada
  with t as (
    update public.cobrancas_obra
    set status = 'cancelada'
    where status = 'cancelamento_agendado' and acesso_ate < p_agora
    returning id
  )
  select count(*) into v_agendadas from t;

  -- retaguarda: inadimplente há mais de 14 dias -> cancelada (o provedor também cancela ao esgotar as tentativas)
  with t as (
    update public.cobrancas_obra
    set status = 'cancelada', acesso_ate = coalesce(acesso_ate, p_agora)
    where status = 'inadimplente' and inadimplente_desde + interval '14 days' < p_agora
    returning id
  )
  select count(*) into v_inadimplencia from t;

  return pg_catalog.jsonb_build_object(
    'novasInadimplentes', v_novas,
    'canceladasPorFimDoPeriodo', v_agendadas,
    'canceladasPorInadimplencia', v_inadimplencia
  );
end;
$$;

revoke all on function public.fn_cobranca_registrar(uuid, text, text, int, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.fn_cobranca_renovar(text, timestamptz) from public, anon, authenticated;
revoke all on function public.fn_cobranca_cancelada_webhook(text, timestamptz) from public, anon, authenticated;
revoke all on function public.fn_cobranca_job_diario(timestamptz) from public, anon, authenticated;
revoke all on function public.fn_cobranca_solicitar_cancelamento(uuid) from public, anon;
revoke all on function public.fn_cobranca_desfazer_cancelamento(uuid) from public, anon;
grant execute on function public.fn_cobranca_registrar(uuid, text, text, int, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.fn_cobranca_renovar(text, timestamptz) to service_role;
grant execute on function public.fn_cobranca_cancelada_webhook(text, timestamptz) to service_role;
grant execute on function public.fn_cobranca_job_diario(timestamptz) to service_role;
grant execute on function public.fn_cobranca_solicitar_cancelamento(uuid) to authenticated;
grant execute on function public.fn_cobranca_desfazer_cancelamento(uuid) to authenticated;

-- ===== funções existentes: gating por obra =====

CREATE OR REPLACE FUNCTION public.fn_atualizar_capa_obra(p_obra uuid, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.obra_permite_escrita(p_obra) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if p_path is distinct from (p_obra::text || '/capa.webp') then
    raise exception 'PATH_INVALIDO';
  end if;
  if not private.eh_dono_obra_ativa(p_obra) then
    raise exception 'SEM_PERMISSAO';
  end if;
  update public.obras set foto_capa_path = p_path where id = p_obra;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_reservar_foto(p_obra uuid, p_relatorio uuid, p_etapa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_rel public.relatorios%rowtype;
  v_count int;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.obra_permite_escrita(p_obra) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if not private.eh_dono_obra_ativa(p_obra) then
    raise exception 'SEM_PERMISSAO';
  end if;

  select * into v_rel
  from public.relatorios r
  where r.id = p_relatorio
  for update;
  if not found or v_rel.obra_id <> p_obra
     or v_rel.status not in ('rascunho', 'enviado') then
    raise exception 'RELATORIO_INVALIDO';
  end if;
  if v_rel.status = 'enviado' and exists (
    select 1 from public.relatorios r
    where r.obra_id = p_obra and r.status = 'enviado' and r.numero > v_rel.numero
  ) then
    raise exception 'NAO_E_ULTIMO';
  end if;
  if not exists (
    select 1 from public.etapas e where e.id = p_etapa and e.obra_id = p_obra
  ) then
    raise exception 'ETAPA_INVALIDA';
  end if;

  select count(*) into v_count
  from public.fotos f
  where f.relatorio_id = p_relatorio
    and f.etapa_id = p_etapa
    and f.estado = 'reservada'
    and f.versao_id is null;
  if v_count >= 12 then
    raise exception 'LIMITE_FOTOS';
  end if;

  v_path := p_obra::text || '/' || p_relatorio::text || '/rascunho/'
    || p_etapa::text || '/' || v_id::text || '.webp';
  insert into public.fotos (
    obra_id, relatorio_id, etapa_id, storage_path, ordem, estado
  ) values (
    p_obra, p_relatorio, p_etapa, v_path, v_count + 1, 'reservada'
  );

  return jsonb_build_object('storagePath', v_path);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_salvar_rascunho(p_obra uuid, p_relatorio uuid, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_rel public.relatorios%rowtype;
  v_num int;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  perform private.consumir_rate_limit(v_user, 'salvar_rascunho', 120, interval '1 hour');

  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if not private.obra_permite_escrita(p_obra) then
    raise exception 'ASSINATURA_INATIVA';
  end if;

  perform private.validar_rascunho(p_obra, coalesce(p_relatorio, '00000000-0000-0000-0000-000000000000'::uuid), p_dados, p_relatorio is not null);

  if p_relatorio is not null then
    select * into v_rel from public.relatorios r where r.id = p_relatorio for update;
    if not found or v_rel.obra_id <> p_obra or v_rel.status <> 'rascunho' then
      raise exception 'RELATORIO_INVALIDO';
    end if;
    update public.relatorios
    set dados_rascunho = p_dados
    where id = p_relatorio;
    return jsonb_build_object('relatorioId', p_relatorio, 'numero', v_rel.numero);
  end if;

  select coalesce(max(r.numero), 0) + 1 into v_num
  from public.relatorios r where r.obra_id = p_obra;

  if exists (
    select 1 from public.relatorios r
    where r.obra_id = p_obra and r.numero = v_num and r.status = 'rascunho'
  ) then
    raise exception 'RASCUNHO_DUPLICADO';
  end if;

  insert into public.relatorios (obra_id, numero, status, dados_rascunho)
  values (p_obra, v_num, 'rascunho', p_dados)
  returning * into v_rel;

  return jsonb_build_object('relatorioId', v_rel.id, 'numero', v_rel.numero);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_solicitar_acesso_obra(p_obra uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_email text;
  v_existentes int;
  v_acesso_id uuid;
  v_outbox_id uuid;
  v_alvo uuid;
  v_proprio text;
  v_status public.acesso_status;
  v_cobrado boolean;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if not private.obra_permite_escrita(p_obra) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  perform private.consumir_rate_limit(v_user, 'convite', 10, interval '1 hour');

  v_email := lower(btrim(p_email))::text;
  if v_email is null or position('@' in v_email::text) = 0 then
    raise exception 'EMAIL_INVALIDO';
  end if;
  v_proprio := private.email_do_usuario(v_user);
  if v_proprio is not null and v_email = lower(v_proprio) then
    raise exception 'EMAIL_PROPRIO';
  end if;

  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user or v_obra.arquivada_em is not null then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;

  perform 1 from public.obra_acessos a where a.obra_id = p_obra for update;

  if exists (
    select 1 from public.obra_acessos a
    where a.obra_id = p_obra
      and a.email = v_email
      and a.status in ('convidado', 'ativo', 'pendente_cobranca')
  ) then
    raise exception 'EMAIL_DUPLICADO';
  end if;

  select count(*) into v_existentes
  from public.obra_acessos a
  where a.obra_id = p_obra
    and a.status in ('convidado', 'ativo', 'pendente_cobranca');

  v_cobrado := v_existentes >= 1;
  v_alvo := private.user_id_por_email(v_email);

  if not v_cobrado then
    v_status := case when v_alvo is null then 'convidado'::public.acesso_status else 'ativo'::public.acesso_status end;
    insert into public.obra_acessos (obra_id, owner_id, email, user_id, status, cobrado_extra)
    values (p_obra, v_obra.owner_id, v_email, v_alvo, v_status, false)
    returning id into v_acesso_id;
    return jsonb_build_object(
      'acessoId', v_acesso_id,
      'cobradoExtra', false,
      'status', v_status,
      'enviarEmail', true
    );
  end if;

  if v_ass.status <> 'ativa' or v_ass.abacatepay_subscription_id is null
     or length(btrim(v_ass.abacatepay_subscription_id)) = 0 then
    raise exception 'PRECISA_ASSINAR';
  end if;

  insert into public.obra_acessos (obra_id, owner_id, email, user_id, status, cobrado_extra)
  values (p_obra, v_obra.owner_id, v_email, v_alvo, 'pendente_cobranca', true)
  returning id into v_acesso_id;

  insert into private.billing_outbox (
    chave_interna, assinatura_id, obra_acesso_id, obra_id, operacao, status
  ) values (
    'add:' || v_acesso_id::text, v_ass.id, v_acesso_id, p_obra, 'add', 'pendente'
  ) returning id into v_outbox_id;

  return jsonb_build_object(
    'acessoId', v_acesso_id,
    'cobradoExtra', true,
    'status', 'pendente_cobranca',
    'outboxId', v_outbox_id,
    'enviarEmail', false
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_preparar_envio_relatorio(p_relatorio uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.obra_permite_escrita(v_obra.id) then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  if v_ass.status = 'trial' and v_ass.relatorios_enviados_trial >= 1
     and not private.obra_cobranca_vigente(v_obra.id) then
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_finalizar_envio_relatorio(p_versao uuid, p_pdf_path text, p_pdf_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.obra_permite_escrita(v_obra.id) then
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

  if v_ass.status = 'trial' and not private.obra_cobranca_vigente(v_obra.id) then
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
$function$;

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
  -- Cobrança por obra (E3): quem tem cobrança vigente (ou conta ativa do modelo antigo) cria
  -- obras sem limite; cada obra só aceita escrita com a própria cobrança
  -- (private.obra_permite_escrita). Sem cobrança, vale o trial: uma obra, dentro do prazo.
  v_paga := v_assinatura.status = 'ativa' or private.usuario_tem_cobranca_vigente(v_user);
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


-- ===== política de upload de fotos: gating pela obra da foto =====
drop policy if exists storage_fotos_insert on storage.objects;
create policy storage_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and exists (
      select 1
      from public.fotos f
      join public.relatorios r on r.id = f.relatorio_id
      where f.storage_path = name
        and f.estado = 'reservada'
        and f.versao_id is null
        and r.status in ('rascunho', 'enviado')
        and private.eh_dono_obra_ativa(f.obra_id)
        and private.obra_permite_escrita(f.obra_id)
    )
  );
