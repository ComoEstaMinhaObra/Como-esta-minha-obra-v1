-- O service_role não lê public.cobrancas_obra diretamente (privilégios mínimos, só por funções).
-- O webhook do Mercado Pago precisa saber se a assinatura já está registrada; descoberto no teste
-- ponta a ponta de 11/10/2026, em que o SELECT direto voltava vazio por falta de permissão.
create or replace function public.fn_cobranca_por_assinatura(p_subscription_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', c.id, 'obraId', c.obra_id, 'userId', c.user_id, 'status', c.status
  )
  from public.cobrancas_obra c
  where c.provedor_assinatura_id = p_subscription_id;
$$;

revoke all on function public.fn_cobranca_por_assinatura(text) from public, anon, authenticated;
grant execute on function public.fn_cobranca_por_assinatura(text) to service_role;
