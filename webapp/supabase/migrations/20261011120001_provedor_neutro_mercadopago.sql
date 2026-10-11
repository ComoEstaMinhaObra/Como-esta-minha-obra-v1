-- Fase 3 do plano de migração do billing para o Mercado Pago (10/10/2026).
-- plano-migracao-mercadopago-2026-10-10.md, seções 3.2 e 3.4. Sem assinantes reais nos planos antigos
-- (decisões de 28/09), então é uma troca direta, sem expand/contract.
--
-- 1. Nomes neutros nas colunas do provedor e recriação das funções que as citam.
-- 2. webhooks_log passa a guardar o provedor por parâmetro (fn_claim_webhook_evento).
-- 3. fn_cobranca_renovar aceita o fim do período informado pelo provedor (next_payment_date).
-- 4. fn_cobranca_marcar_inadimplente: o Mercado Pago avisa a recusa da parcela.
-- 5. O job diário devolve as assinaturas canceladas por inadimplência para o app cancelar no provedor.
-- 6. Fim do relançamento mensal do e-mail adicional: no Mercado Pago o valor da assinatura é
--    persistente (record-usage do AbacatePay valia só para a próxima parcela).
-- 7. Sai fn_registrar_customer_id: o Mercado Pago não usa cliente (só payer_email).

-- ===== 1. colunas =====
alter table public.cobrancas_obra rename column abacatepay_subscription_id to provedor_assinatura_id;
alter table public.cobrancas_obra rename column abacatepay_checkout_id to provedor_checkout_id;
alter table public.assinaturas rename column abacatepay_subscription_id to provedor_assinatura_id;
alter table public.assinaturas rename column abacatepay_customer_id to provedor_cliente_id;
alter table public.assinatura_usos rename column abacatepay_usage_id to provedor_uso_id;
alter table private.billing_outbox rename column abacatepay_usage_id to provedor_uso_id;

alter table public.webhooks_log alter column provedor set default 'mercadopago';

drop function if exists public.fn_registrar_customer_id(text);
drop function if exists public.fn_enfileirar_renovacao_emails_obra(text, text);

-- ===== funções que só precisam do novo nome das colunas =====
-- private.assinatura_provedor_da_obra: só renomeia as colunas
CREATE OR REPLACE FUNCTION private.assinatura_provedor_da_obra(p_obra uuid, p_exige_ativa boolean)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.provedor_assinatura_id
  from public.cobrancas_obra c
  where c.obra_id = p_obra
    and (
      c.status = 'ativa'
      or (
        not p_exige_ativa
        and c.status in ('inadimplente', 'cancelamento_agendado')
      )
    )
  order by (c.status = 'ativa') desc, c.criado_em desc
  limit 1;
$function$;

-- public.fn_claim_outbox: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_claim_outbox(p_outbox uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row private.billing_outbox%rowtype;
  v_sub text;
  v_acesso public.obra_acessos%rowtype;
  v_obra public.obras%rowtype;
  v_renovacao boolean;
begin
  select * into v_row from private.billing_outbox o where o.id = p_outbox for update;
  if not found then raise exception 'OUTBOX_AUSENTE'; end if;
  if v_row.status = 'confirmado' then
    return jsonb_build_object(
      'status', v_row.status, 'idempotente', true,
      'usageId', v_row.provedor_uso_id
    );
  end if;
  if v_row.status in ('incerto', 'cancelado', 'processando') then
    return jsonb_build_object(
      'status', v_row.status, 'repetirProvedor', false
    );
  end if;
  if v_row.status = 'falhou'
     and (v_row.proximo_retry is null or v_row.proximo_retry > pg_catalog.now()) then
    return jsonb_build_object('status', 'falhou', 'repetirProvedor', false);
  end if;

  select * into v_obra from public.obras o where o.id = v_row.obra_id;
  -- Adicionar exige cobrança ativa; compensar (subtract) aceita também inadimplente ou
  -- cancelamento agendado, que ainda têm a assinatura no provedor.
  v_sub := private.assinatura_provedor_da_obra(v_row.obra_id, v_row.operacao = 'add');
  if not found or v_sub is null then
    update private.billing_outbox
    set status = 'falhou', proximo_retry = null,
        erro_sanitizado = 'ASSINATURA_INVALIDA', atualizado_em = pg_catalog.now()
    where id = p_outbox;
    return jsonb_build_object('status', 'falhou', 'repetirProvedor', false);
  end if;

  v_renovacao := v_row.chave_interna like 'renew:%';
  if v_row.operacao = 'add' then
    select * into v_acesso from public.obra_acessos a
    where a.id = v_row.obra_acesso_id and a.obra_id = v_row.obra_id;
    if not found or v_obra.arquivada_em is not null
       or (not v_renovacao and v_acesso.status <> 'pendente_cobranca')
       or (v_renovacao and (
         not v_acesso.cobrado_extra or v_acesso.status not in ('convidado', 'ativo')
       )) then
      update private.billing_outbox
      set status = 'cancelado', proximo_retry = null,
          erro_sanitizado = 'OPERACAO_CANCELADA', atualizado_em = pg_catalog.now()
      where id = p_outbox;
      return jsonb_build_object('status', 'cancelado', 'repetirProvedor', false);
    end if;
  end if;

  update private.billing_outbox
  set status = 'processando', tentativas = tentativas + 1,
      proximo_retry = null, atualizado_em = pg_catalog.now()
  where id = p_outbox;
  return jsonb_build_object(
    'status', 'processando', 'operacao', v_row.operacao,
    'subscriptionId', v_sub,
    'obraId', v_row.obra_id,
    'obraAcessoId', v_row.obra_acesso_id,
    'assinaturaId', v_row.assinatura_id
  );
end;
$function$;

-- public.fn_cobranca_cancelada_webhook: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_cobranca_cancelada_webhook(p_subscription_id text, p_agora timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.cobrancas_obra%rowtype;
begin
  select * into v
  from public.cobrancas_obra c
  where c.provedor_assinatura_id = p_subscription_id
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
$function$;

-- public.fn_cobranca_registrar: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_cobranca_registrar(p_obra uuid, p_subscription_id text, p_checkout_id text, p_valor_centavos integer, p_periodo_inicio timestamp with time zone, p_periodo_fim timestamp with time zone, p_primeira_cobranca_em timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where c.provedor_assinatura_id = p_subscription_id
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
    user_id, obra_id, provedor_assinatura_id, provedor_checkout_id,
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
$function$;

-- public.fn_cobranca_solicitar_cancelamento: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_cobranca_solicitar_cancelamento(p_obra uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'subscriptionId', v.provedor_assinatura_id,
    'acessoAte', v.periodo_fim
  );
end;
$function$;

-- public.fn_cobranca_solicitar_regularizacao: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_cobranca_solicitar_regularizacao(p_obra uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v public.cobrancas_obra%rowtype;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v
  from public.cobrancas_obra c
  where c.obra_id = p_obra and c.user_id = v_user and c.status = 'inadimplente'
  for update;
  if not found then
    raise exception 'COBRANCA_NAO_REGULARIZAVEL';
  end if;

  update public.cobrancas_obra
  set cancelamento_solicitado_em = pg_catalog.now()
  where id = v.id;

  return pg_catalog.jsonb_build_object(
    'cobrancaId', v.id,
    'subscriptionId', v.provedor_assinatura_id
  );
end;
$function$;

-- public.fn_confirmar_outbox: só renomeia as colunas
CREATE OR REPLACE FUNCTION public.fn_confirmar_outbox(p_outbox uuid, p_usage_id text, p_installment integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row private.billing_outbox%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_obra public.obras%rowtype;
  v_status public.acesso_status;
  v_compensacao uuid;
begin
  if p_usage_id is null or length(btrim(p_usage_id)) = 0 then
    raise exception 'USAGE_ID_INVALIDO';
  end if;
  select * into v_row from private.billing_outbox o where o.id = p_outbox for update;
  if not found then raise exception 'OUTBOX_AUSENTE'; end if;
  if v_row.status = 'confirmado' then
    if v_row.provedor_uso_id is distinct from p_usage_id then
      raise exception 'USAGE_ID_CONFLITANTE';
    end if;
    return jsonb_build_object('status', 'confirmado', 'idempotente', true);
  end if;
  if v_row.status not in ('processando', 'incerto') then
    raise exception 'OUTBOX_INVALIDO';
  end if;

  insert into public.assinatura_usos (
    assinatura_id, obra_acesso_id, action, units,
    provedor_uso_id, installment_number
  ) values (
    v_row.assinatura_id, v_row.obra_acesso_id, v_row.operacao::text, 1,
    p_usage_id, p_installment
  );

  update private.billing_outbox
  set status = 'confirmado', provedor_uso_id = p_usage_id,
      installment_number = p_installment, atualizado_em = pg_catalog.now(),
      erro_sanitizado = null, proximo_retry = null
  where id = p_outbox;

  if v_row.operacao = 'add' then
    select * into v_acesso from public.obra_acessos a
    where a.id = v_row.obra_acesso_id for update;
    select * into v_obra from public.obras o where o.id = v_row.obra_id;

    if v_acesso.id is null or v_obra.id is null or v_obra.arquivada_em is not null
       or (
         v_row.chave_interna not like 'renew:%'
         and v_acesso.status <> 'pendente_cobranca'
       )
       or (
         v_row.chave_interna like 'renew:%'
         and (not v_acesso.cobrado_extra or v_acesso.status not in ('convidado', 'ativo'))
       ) then
      v_compensacao := private.enfileirar_subtract(
        v_row.assinatura_id, v_row.obra_acesso_id, v_row.obra_id
      );
      return jsonb_build_object(
        'status', 'confirmado', 'enviarEmail', false,
        'compensacaoOutboxId', v_compensacao
      );
    end if;

    if v_row.chave_interna like 'renew:%' then
      return jsonb_build_object(
        'status', 'confirmado', 'enviarEmail', false
      );
    end if;

    v_status := case when v_acesso.user_id is null
      then 'convidado'::public.acesso_status else 'ativo'::public.acesso_status end;
    update public.obra_acessos set status = v_status where id = v_acesso.id;
    return jsonb_build_object(
      'status', 'confirmado', 'acessoStatus', v_status,
      'enviarEmail', true, 'email', v_acesso.email
    );
  end if;
  return jsonb_build_object('status', 'confirmado', 'enviarEmail', false);
end;
$function$;

-- ===== 2. claim de webhook com provedor =====
drop function public.fn_claim_webhook_evento(text, text, jsonb, boolean);

create function public.fn_claim_webhook_evento(
  p_event_id text,
  p_evento text,
  p_payload jsonb,
  p_force boolean default false,
  p_provedor text default 'mercadopago'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log public.webhooks_log%rowtype;
begin
  if p_event_id is null or length(btrim(p_event_id)) = 0 then
    raise exception 'EVENTO_SEM_ID';
  end if;
  if p_provedor is null or length(btrim(p_provedor)) = 0 then
    raise exception 'PROVEDOR_INVALIDO';
  end if;

  insert into public.webhooks_log (
    provedor, event_id, evento, payload, processado, claim_em, tentativas
  ) values (
    p_provedor, p_event_id, p_evento, p_payload, false, pg_catalog.now(), 1
  )
  on conflict (provedor, event_id) do nothing
  returning * into v_log;
  if found then
    return jsonb_build_object(
      'logId', v_log.id, 'duplicado', false, 'emProcessamento', false
    );
  end if;

  select * into v_log from public.webhooks_log w
  where w.provedor = p_provedor and w.event_id = p_event_id
  for update;
  if v_log.processado and not p_force then
    return jsonb_build_object(
      'logId', v_log.id, 'duplicado', true,
      'processado', true, 'emProcessamento', false
    );
  end if;
  if not p_force and v_log.erro is null and v_log.claim_em is not null
     and v_log.claim_em > pg_catalog.now() - interval '10 minutes' then
    return jsonb_build_object(
      'logId', v_log.id, 'duplicado', true,
      'processado', false, 'emProcessamento', true
    );
  end if;

  update public.webhooks_log
  set evento = p_evento, payload = p_payload, processado = false,
      erro = null, processado_em = null, claim_em = pg_catalog.now(),
      tentativas = tentativas + 1
  where id = v_log.id;
  return jsonb_build_object(
    'logId', v_log.id, 'duplicado', false, 'emProcessamento', false
  );
end;
$$;

revoke all on function public.fn_claim_webhook_evento(text, text, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.fn_claim_webhook_evento(text, text, jsonb, boolean, text) to service_role;

-- ===== 3. renovação com o período informado pelo provedor =====
-- Cobrança do ciclo paga. Volta de inadimplente para ativa. p_periodo_fim é o next_payment_date
-- do provedor; sem ele (ou no passado) usa um mês a partir de p_agora. Repetir o mesmo evento
-- não muda nada além de periodo_inicio. Cancelada ou com cancelamento agendado ignora.
drop function public.fn_cobranca_renovar(text, timestamptz);

create function public.fn_cobranca_renovar(
  p_subscription_id text,
  p_agora timestamptz default pg_catalog.now(),
  p_periodo_fim timestamptz default null
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
  where c.provedor_assinatura_id = p_subscription_id
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;

  if v.status in ('ativa', 'inadimplente') then
    update public.cobrancas_obra
    set status = 'ativa',
        inadimplente_desde = null,
        periodo_inicio = p_agora,
        periodo_fim = case
          when p_periodo_fim is not null and p_periodo_fim > p_agora then p_periodo_fim
          else p_agora + interval '1 month'
        end
    where id = v.id;
    return pg_catalog.jsonb_build_object(
      'id', v.id, 'alterada', true, 'status', 'ativa', 'estavaInadimplente', v.status = 'inadimplente'
    );
  end if;

  return pg_catalog.jsonb_build_object('id', v.id, 'alterada', false, 'status', v.status);
end;
$$;

revoke all on function public.fn_cobranca_renovar(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_cobranca_renovar(text, timestamptz, timestamptz) to service_role;

-- ===== 4. parcela recusada =====
-- O Mercado Pago avisa a recusa da parcela (o AbacatePay não avisava): a obra passa a somente
-- leitura na hora, sem esperar o job diário. Só ativa vira inadimplente; o resto não muda.
create function public.fn_cobranca_marcar_inadimplente(
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
  where c.provedor_assinatura_id = p_subscription_id
  for update;
  if not found then
    raise exception 'COBRANCA_AUSENTE';
  end if;

  if v.status = 'ativa' then
    update public.cobrancas_obra
    set status = 'inadimplente', inadimplente_desde = p_agora
    where id = v.id;
    return pg_catalog.jsonb_build_object(
      'id', v.id, 'alterada', true, 'status', 'inadimplente',
      'userId', v.user_id, 'obraId', v.obra_id
    );
  end if;

  return pg_catalog.jsonb_build_object('id', v.id, 'alterada', false, 'status', v.status);
end;
$$;

revoke all on function public.fn_cobranca_marcar_inadimplente(text, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_cobranca_marcar_inadimplente(text, timestamptz) to service_role;

-- ===== 5. job diário devolve o que cancelar no provedor =====
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
  v_inadimplencia_subs jsonb;
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

  -- inadimplente há mais de 14 dias -> cancelada. O Mercado Pago só tenta cobrar por 10 dias e
  -- não cancela a assinatura sozinho, então o app cancela no provedor (devolvemos os ids).
  with t as (
    update public.cobrancas_obra
    set status = 'cancelada', acesso_ate = coalesce(acesso_ate, p_agora)
    where status = 'inadimplente' and inadimplente_desde + interval '14 days' < p_agora
    returning provedor_assinatura_id
  )
  select count(*),
         coalesce(pg_catalog.jsonb_agg(provedor_assinatura_id), '[]'::jsonb)
  into v_inadimplencia, v_inadimplencia_subs from t;

  return pg_catalog.jsonb_build_object(
    'novasInadimplentes', v_novas,
    'canceladasPorFimDoPeriodo', v_agendadas,
    'canceladasPorInadimplencia', v_inadimplencia,
    'assinaturasCanceladasPorInadimplencia', v_inadimplencia_subs
  );
end;
$$;
