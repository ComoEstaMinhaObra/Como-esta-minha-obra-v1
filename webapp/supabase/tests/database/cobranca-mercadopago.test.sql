-- pgTAP: funções da migração para o Mercado Pago (11/10/2026)

begin;
select plan(21);

-- ===== privilégios =====
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_marcar_inadimplente(text, timestamptz)', 'execute'),
  'authenticated não executa fn_cobranca_marcar_inadimplente');
select ok(has_function_privilege('service_role', 'public.fn_cobranca_marcar_inadimplente(text, timestamptz)', 'execute'),
  'service_role executa fn_cobranca_marcar_inadimplente');
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_renovar(text, timestamptz, timestamptz)', 'execute'),
  'authenticated não executa fn_cobranca_renovar');
select ok(not has_function_privilege('authenticated', 'public.fn_claim_webhook_evento(text, text, jsonb, boolean, text)', 'execute'),
  'authenticated não executa fn_claim_webhook_evento');
select ok(has_function_privilege('service_role', 'public.fn_claim_webhook_evento(text, text, jsonb, boolean, text)', 'execute'),
  'service_role executa fn_claim_webhook_evento');
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_por_assinatura(text)', 'execute'),
  'authenticated não executa fn_cobranca_por_assinatura');
select ok(has_function_privilege('service_role', 'public.fn_cobranca_por_assinatura(text)', 'execute'),
  'service_role executa fn_cobranca_por_assinatura');
select ok(to_regprocedure('public.fn_enfileirar_renovacao_emails_obra(text, text)') is null,
  'a renovação mensal do adicional saiu');
select ok(to_regprocedure('public.fn_registrar_customer_id(text)') is null,
  'o cliente do provedor saiu');

-- ===== claim com provedor =====
select is(
  (public.fn_claim_webhook_evento('evt-1', 'subscription_preapproval', '{}'::jsonb))->>'duplicado',
  'false', 'primeira entrega não é duplicada');
select is(
  (select provedor from public.webhooks_log where event_id = 'evt-1'),
  'mercadopago', 'o provedor padrão é mercadopago');
select is(
  (public.fn_claim_webhook_evento('evt-1', 'subscription_preapproval', '{}'::jsonb))->>'duplicado',
  'true', 'a mesma entrega do mesmo provedor é duplicada');
select is(
  (public.fn_claim_webhook_evento('evt-1', 'x', '{}'::jsonb, false, 'outro'))->>'duplicado',
  'false', 'o mesmo id em outro provedor é outra entrega');

-- ===== fixtures =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000a001', 'dono-mp@example.com', '{"nome": "Dono"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';
create temp table t_o as
select public.fn_criar_obra('Obra MP', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
reset role;
select public.fn_cobranca_registrar((select id from t_o), 'mp_sub_1', null, 12990,
  now() - interval '1 day', now() + interval '10 days');

-- ===== localizar a cobrança pela assinatura do provedor =====
select is((public.fn_cobranca_por_assinatura('mp_sub_1'))->>'obraId', (select id::text from t_o),
  'acha a cobrança pela assinatura do provedor');
select is(public.fn_cobranca_por_assinatura('mp_inexistente'), null,
  'assinatura desconhecida devolve nulo');

-- ===== parcela recusada =====
select is(
  (public.fn_cobranca_marcar_inadimplente('mp_sub_1'))->>'alterada', 'true',
  'ativa vira inadimplente quando a parcela é recusada');
select is(
  (select status::text from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_1'),
  'inadimplente', 'o status ficou inadimplente');
select ok(not private.obra_permite_escrita((select id from t_o)),
  'a obra inadimplente fica somente leitura');
select is(
  (public.fn_cobranca_marcar_inadimplente('mp_sub_1'))->>'alterada', 'false',
  'repetir a recusa não muda nada');
select throws_ok(
  $$select public.fn_cobranca_marcar_inadimplente('mp_inexistente')$$,
  'P0001', 'COBRANCA_AUSENTE', 'assinatura desconhecida é erro permanente');

-- ===== renovação com o período do provedor =====
select public.fn_cobranca_renovar('mp_sub_1', now(), now() + interval '30 days');
select ok(
  (select status::text = 'ativa' and periodo_fim > now() + interval '29 days' and periodo_fim <= now() + interval '30 days'
   from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_1'),
  'a renovação volta para ativa e usa o fim do período informado');

select * from finish();
rollback;
