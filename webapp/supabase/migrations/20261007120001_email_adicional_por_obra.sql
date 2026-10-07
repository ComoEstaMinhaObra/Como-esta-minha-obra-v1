-- E-mail adicional na assinatura DA OBRA (revisão de 07/10/2026).
--
-- Até aqui o adicional de R$ 29,90 era lançado (record-usage) na assinatura da CONTA
-- (assinaturas.abacatepay_subscription_id), que no modelo por obra nunca existe: o 2º e-mail de
-- qualquer obra paga caía em PRECISA_ASSINAR. O record-usage funciona na assinatura da obra
-- (verificado no dev mode em 07/10/2026: unitPrice 2990, entra na próxima parcela).
--
-- Mudanças:
--   1. private.assinatura_provedor_da_obra: assinatura do provedor que cobra a obra.
--   2. fn_solicitar_acesso_obra, fn_claim_outbox, fn_revogar_acesso_obra e fn_arquivar_obra passam
--      a usá-la no lugar da assinatura da conta.
--   3. fn_enfileirar_renovacao_emails_obra: a cada subscription.renewed, relança o adicional dos
--      acessos pagos da obra (o uso entra só na próxima parcela, então precisa ser repetido).

create or replace function private.assinatura_provedor_da_obra(
  p_obra uuid,
  p_exige_ativa boolean
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.abacatepay_subscription_id
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
$$;

revoke all on function private.assinatura_provedor_da_obra(uuid, boolean) from public, anon, authenticated;

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

  -- O adicional é lançado na assinatura DA OBRA (cobrancas_obra), não na da conta.
  if private.assinatura_provedor_da_obra(p_obra, true) is null then
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

create or replace function public.fn_claim_outbox(p_outbox uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.fn_revogar_acesso_obra(p_obra uuid, p_acesso uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_promo public.obra_acessos%rowtype;
  v_outbox uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;
  select * into v_acesso from public.obra_acessos a where a.id = p_acesso and a.obra_id = p_obra for update;
  if not found or v_acesso.status = 'revogado' then
    raise exception 'NAO_ENCONTRADO';
  end if;

  update private.billing_outbox
  set status = 'cancelado',
      proximo_retry = null,
      erro_sanitizado = 'ACESSO_REVOGADO',
      atualizado_em = pg_catalog.now()
  where obra_acesso_id = v_acesso.id
    and operacao = 'add'
    and status in ('pendente', 'falhou');

  update public.obra_acessos
  set status = 'revogado',
      revogado_em = pg_catalog.now(),
      revogado_por = v_user
  where id = p_acesso;

  if v_acesso.cobrado_extra
     and v_acesso.status in ('convidado', 'ativo')
     and private.assinatura_provedor_da_obra(p_obra, false) is not null then
    v_outbox := private.enfileirar_subtract(v_ass.id, v_acesso.id, p_obra);
  elsif not v_acesso.cobrado_extra then
    select * into v_promo
    from public.obra_acessos a
    where a.obra_id = p_obra
      and a.cobrado_extra
      and a.status in ('convidado', 'ativo')
    order by a.criado_em
    limit 1;
    if found then
      update public.obra_acessos set cobrado_extra = false where id = v_promo.id;
      if private.assinatura_provedor_da_obra(p_obra, false) is not null then
        v_outbox := private.enfileirar_subtract(v_ass.id, v_promo.id, p_obra);
      end if;
    end if;
  end if;

  return jsonb_build_object('acessoId', p_acesso, 'outboxId', v_outbox);
end;
$$;

create or replace function public.fn_arquivar_obra(p_obra uuid, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obra public.obras%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_outboxes uuid[] := array[]::uuid[];
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  select * into v_obra from public.obras o where o.id = p_obra for update;
  if not found or v_obra.owner_id <> v_user then
    raise exception 'SEM_PERMISSAO';
  end if;
  if v_obra.arquivada_em is not null then
    raise exception 'JA_ARQUIVADA';
  end if;
  if btrim(p_nome) is distinct from v_obra.nome then
    raise exception 'NOME_NAO_CONFERE';
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_user for update;

  for v_acesso in
    select * from public.obra_acessos a
    where a.obra_id = p_obra and a.status in ('convidado', 'ativo', 'pendente_cobranca')
    for update
  loop
    update private.billing_outbox
    set status = 'cancelado',
        proximo_retry = null,
        erro_sanitizado = 'OBRA_ARQUIVADA',
        atualizado_em = pg_catalog.now()
    where obra_acesso_id = v_acesso.id
      and operacao = 'add'
      and status in ('pendente', 'falhou');

    update public.obra_acessos
    set status = 'revogado',
        revogado_em = pg_catalog.now(),
        revogado_por = v_user
    where id = v_acesso.id;
    if v_acesso.cobrado_extra and v_acesso.status in ('convidado', 'ativo')
       and private.assinatura_provedor_da_obra(p_obra, false) is not null then
      v_id := private.enfileirar_subtract(v_ass.id, v_acesso.id, p_obra);
      v_outboxes := v_outboxes || v_id;
    end if;
  end loop;

  update public.obras set arquivada_em = pg_catalog.now() where id = p_obra;
  return jsonb_build_object('obraId', p_obra, 'outboxIds', to_jsonb(v_outboxes));
end;
$$;

-- Relança o adicional dos acessos pagos da obra cuja assinatura acabou de renovar. Chamada pelo
-- webhook (service_role); a chave por evento torna a repetição do webhook idempotente. O cron da
-- outbox processa as linhas pendentes.
create or replace function public.fn_enfileirar_renovacao_emails_obra(
  p_subscription_id text,
  p_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cobranca public.cobrancas_obra%rowtype;
  v_ass public.assinaturas%rowtype;
  v_acesso public.obra_acessos%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
begin
  select * into v_cobranca from public.cobrancas_obra c
  where c.abacatepay_subscription_id = p_subscription_id;
  if not found or v_cobranca.status <> 'ativa' then
    return jsonb_build_object('outboxIds', '[]'::jsonb);
  end if;
  select * into v_ass from public.assinaturas s where s.user_id = v_cobranca.user_id;
  if not found then
    return jsonb_build_object('outboxIds', '[]'::jsonb);
  end if;
  if exists (select 1 from public.obras o where o.id = v_cobranca.obra_id and o.arquivada_em is not null) then
    return jsonb_build_object('outboxIds', '[]'::jsonb);
  end if;

  for v_acesso in
    select a.* from public.obra_acessos a
    where a.obra_id = v_cobranca.obra_id
      and a.cobrado_extra
      and a.status in ('convidado', 'ativo')
  loop
    insert into private.billing_outbox (
      chave_interna, assinatura_id, obra_acesso_id, obra_id, operacao, status
    ) values (
      'renew:' || coalesce(p_event_id, '') || ':' || v_acesso.id::text,
      v_ass.id, v_acesso.id, v_acesso.obra_id, 'add', 'pendente'
    )
    on conflict (chave_interna) do nothing
    returning id into v_id;
    if v_id is not null then
      v_ids := v_ids || v_id;
    end if;
  end loop;
  return jsonb_build_object('outboxIds', to_jsonb(v_ids));
end;
$$;

revoke all on function public.fn_enfileirar_renovacao_emails_obra(text, text) from public, anon, authenticated;
grant execute on function public.fn_enfileirar_renovacao_emails_obra(text, text) to service_role;
