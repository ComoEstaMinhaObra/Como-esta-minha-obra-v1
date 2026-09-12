-- Billing/outbox e webhook: idempotência, cancelamento e recuperação operacional.

create or replace function private.proteger_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMUTAVEL'; end if;
  if old.status = 'confirmado' then
    if new is distinct from old then raise exception 'IMUTAVEL'; end if;
    return new;
  end if;
  if old.status = 'cancelado' and new.status <> 'cancelado' then
    raise exception 'IMUTAVEL';
  end if;
  if old.status = 'incerto' and new.status not in ('incerto', 'confirmado') then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create or replace function public.fn_claim_outbox(p_outbox uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.billing_outbox%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_obra public.obras%rowtype;
  v_renovacao boolean;
begin
  select * into v_row from private.billing_outbox o where o.id = p_outbox for update;
  if not found then raise exception 'OUTBOX_AUSENTE'; end if;
  if v_row.status = 'confirmado' then
    return jsonb_build_object(
      'status', v_row.status, 'idempotente', true,
      'usageId', v_row.abacatepay_usage_id
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

  select * into v_ass from public.assinaturas s where s.id = v_row.assinatura_id;
  select * into v_obra from public.obras o where o.id = v_row.obra_id;
  if not found or v_ass.abacatepay_subscription_id is null
     or length(btrim(v_ass.abacatepay_subscription_id)) = 0 then
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
    'subscriptionId', v_ass.abacatepay_subscription_id,
    'obraId', v_row.obra_id,
    'obraAcessoId', v_row.obra_acesso_id,
    'assinaturaId', v_row.assinatura_id
  );
end;
$$;

create or replace function public.fn_confirmar_outbox(
  p_outbox uuid,
  p_usage_id text,
  p_installment int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    if v_row.abacatepay_usage_id is distinct from p_usage_id then
      raise exception 'USAGE_ID_CONFLITANTE';
    end if;
    return jsonb_build_object('status', 'confirmado', 'idempotente', true);
  end if;
  if v_row.status not in ('processando', 'incerto') then
    raise exception 'OUTBOX_INVALIDO';
  end if;

  insert into public.assinatura_usos (
    assinatura_id, obra_acesso_id, action, units,
    abacatepay_usage_id, installment_number
  ) values (
    v_row.assinatura_id, v_row.obra_acesso_id, v_row.operacao::text, 1,
    p_usage_id, p_installment
  );

  update private.billing_outbox
  set status = 'confirmado', abacatepay_usage_id = p_usage_id,
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
$$;

create or replace function public.fn_falhar_outbox(
  p_outbox uuid,
  p_erro text,
  p_incerto boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.billing_outbox
  set status = case when p_incerto
        then 'incerto'::public.outbox_status else 'falhou'::public.outbox_status end,
      erro_sanitizado = left(coalesce(p_erro, 'falha'), 180),
      atualizado_em = pg_catalog.now(),
      proximo_retry = null
  where id = p_outbox and status in ('processando', 'pendente');
end;
$$;

create or replace function public.fn_reagendar_outbox(p_outbox uuid, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.billing_outbox
  set status = 'falhou', erro_sanitizado = left(coalesce(p_erro, 'retry'), 180),
      atualizado_em = pg_catalog.now(),
      proximo_retry = pg_catalog.now()
        + least(interval '1 hour', interval '1 minute' * power(2, least(tentativas, 6)))
  where id = p_outbox and status = 'processando';
end;
$$;

create or replace function private.recuperar_outbox_travada()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update private.billing_outbox
  set status = 'incerto', proximo_retry = null,
      erro_sanitizado = 'CONFIRMACAO_LOCAL_PENDENTE', atualizado_em = pg_catalog.now()
  where status = 'processando'
    and atualizado_em < pg_catalog.now() - interval '10 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.fn_listar_outbox_pendente()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.recuperar_outbox_travada();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'operacao', o.operacao, 'status', o.status
  ) order by o.criado_em), '[]'::jsonb)
  into v_result
  from private.billing_outbox o
  where o.status = 'pendente'
     or (o.status = 'falhou' and o.proximo_retry <= pg_catalog.now());
  return v_result;
end;
$$;

create or replace function public.fn_admin_confirmar_outbox(
  p_outbox uuid,
  p_usage_id text,
  p_installment int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  return public.fn_confirmar_outbox(p_outbox, p_usage_id, p_installment);
end;
$$;

drop function if exists public.fn_claim_webhook_evento(text, text, jsonb);
create function public.fn_claim_webhook_evento(
  p_event_id text,
  p_evento text,
  p_payload jsonb,
  p_force boolean default false
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

  insert into public.webhooks_log (
    provedor, event_id, evento, payload, processado, claim_em, tentativas
  ) values (
    'abacatepay', p_event_id, p_evento, p_payload, false, pg_catalog.now(), 1
  )
  on conflict (provedor, event_id) do nothing
  returning * into v_log;
  if found then
    return jsonb_build_object(
      'logId', v_log.id, 'duplicado', false, 'emProcessamento', false
    );
  end if;

  select * into v_log from public.webhooks_log w
  where w.provedor = 'abacatepay' and w.event_id = p_event_id
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

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on all functions in schema public to postgres, service_role;
grant execute on all functions in schema private to postgres, service_role;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.eh_dono_obra_ativa(uuid) to authenticated;
grant execute on function private.eh_dono_obra(uuid) to authenticated;
grant execute on function private.tem_acesso_obra_ativa(uuid) to authenticated;

grant execute on function public.fn_admin_confirmar_outbox(uuid, text, int) to authenticated;

-- A RPC monolítica antiga publicava o relatório antes de existir um PDF
-- definitivo. Mantemos a assinatura apenas para produzir um erro explícito em
-- clientes desatualizados, sem deixar um caminho alternativo ao fluxo em duas
-- fases.
create or replace function public.fn_enviar_relatorio(p_relatorio uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'RPC_DESATIVADA_USE_FLUXO_DUAS_FASES'
    using errcode = '42501';
end;
$$;

revoke execute on function public.fn_enviar_relatorio(uuid)
  from public, anon, authenticated, service_role;
