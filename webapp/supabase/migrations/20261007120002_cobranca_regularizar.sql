-- Regularização de pagamento pendente (D3), revisão de 07/10/2026.
--
-- O AbacatePay não tem API para trocar o cartão de uma assinatura, então regularizar é encerrar a
-- assinatura que falhou e abrir um novo checkout da obra. Dois passos, para gravar a intenção ANTES
-- de chamar o provedor (que cancela na hora), como no cancelamento comum:
--   1. fn_cobranca_solicitar_regularizacao: só cobrança inadimplente do dono; devolve a assinatura.
--   2. fn_cobranca_concluir_regularizacao: depois do cancelamento no provedor, vira cancelada.
--      Aceita também cancelamento_agendado, caso o webhook subscription.cancelled chegue primeiro.
-- Se o provedor falhar entre os dois passos, fn_cobranca_desfazer_regularizacao limpa a intenção.

create or replace function public.fn_cobranca_solicitar_regularizacao(p_obra uuid)
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
    'subscriptionId', v.abacatepay_subscription_id
  );
end;
$$;

create or replace function public.fn_cobranca_concluir_regularizacao(p_obra uuid)
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
  where c.obra_id = p_obra and c.user_id = v_user
    and c.status in ('inadimplente', 'cancelamento_agendado')
    and c.cancelamento_solicitado_em is not null
    and c.cancelamento_solicitado_em >= pg_catalog.now() - interval '10 minutes'
  for update;
  if not found then
    raise exception 'COBRANCA_NAO_REGULARIZAVEL';
  end if;

  update public.cobrancas_obra
  set status = 'cancelada', acesso_ate = pg_catalog.now()
  where id = v.id;
end;
$$;

create or replace function public.fn_cobranca_desfazer_regularizacao(p_obra uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  update public.cobrancas_obra
  set cancelamento_solicitado_em = null
  where obra_id = p_obra
    and user_id = v_user
    and status = 'inadimplente';
end;
$$;

revoke all on function public.fn_cobranca_solicitar_regularizacao(uuid) from public, anon;
revoke all on function public.fn_cobranca_concluir_regularizacao(uuid) from public, anon;
revoke all on function public.fn_cobranca_desfazer_regularizacao(uuid) from public, anon;
grant execute on function public.fn_cobranca_solicitar_regularizacao(uuid) to authenticated;
grant execute on function public.fn_cobranca_concluir_regularizacao(uuid) to authenticated;
grant execute on function public.fn_cobranca_desfazer_regularizacao(uuid) to authenticated;
