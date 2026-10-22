-- pgTAP: desconto do link de afiliado (permanente e só na 1ª fatura)

begin;
select plan(44);

-- ===== privilégios =====
select ok(not has_function_privilege('authenticated', 'public.fn_afiliado_desconto_obra(uuid, uuid, int, boolean)', 'execute'),
  'authenticated não executa fn_afiliado_desconto_obra');
select ok(has_function_privilege('service_role', 'public.fn_afiliado_desconto_obra(uuid, uuid, int, boolean)', 'execute'),
  'service_role executa fn_afiliado_desconto_obra');
select ok(not has_function_privilege('anon', 'public.fn_afiliado_desconto_obra(uuid, uuid, int, boolean)', 'execute'),
  'anon não executa fn_afiliado_desconto_obra');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'fn\_afiliado\_desconto%'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  0::bigint, 'nenhuma função de desconto é chamável por authenticated ou anon');
select ok(has_function_privilege('service_role', 'public.fn_afiliado_desconto_assinatura(text, int)', 'execute')
  and has_function_privilege('service_role', 'public.fn_afiliado_desconto_reversao_alvo(uuid, int)', 'execute')
  and has_function_privilege('service_role', 'public.fn_afiliado_desconto_revertido(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.fn_afiliado_desconto_liberar(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.fn_afiliado_descontos_a_reverter(int)', 'execute'),
  'service_role executa as demais funções de desconto');

-- ===== fixtures =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000af101', 'afil-desc@example.com', '{"nome": "Afiliada"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-0000000af102', 'admin-desc@example.com', '{"nome": "Admin"}', '{"provider": "email"}', now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000af102');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af102", "role": "authenticated"}';
select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af101', 'desc-primeira', '', 1000, true, 2000, 'primeira_fatura');
select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af101', 'desc-sempre', '', 500, false, 1000, 'permanente');

reset role;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000af111', 'u1@example.com', '{"ref": "desc-primeira"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-0000000af112', 'u2@example.com', '{"ref": "desc-sempre"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-0000000af113', 'u3@example.com', '{}', '{"provider": "email"}', now());

-- o trial limita a uma obra; a conta livre cria sem limite
update public.assinaturas set conta_livre = true
where user_id in ('00000000-0000-0000-0000-0000000af111', '00000000-0000-0000-0000-0000000af112', '00000000-0000-0000-0000-0000000af113');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af111", "role": "authenticated"}';
create temp table t_o1 as select public.fn_criar_obra('O1', 'Rua 1', 'C', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null, '[{"nome": "E", "peso": 100}]'::jsonb) as id;
create temp table t_o2 as select public.fn_criar_obra('O2', 'Rua 2', 'C', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null, '[{"nome": "E", "peso": 100}]'::jsonb) as id;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af112", "role": "authenticated"}';
create temp table t_p1 as select public.fn_criar_obra('P1', 'Rua 3', 'C', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null, '[{"nome": "E", "peso": 100}]'::jsonb) as id;
create temp table t_p2 as select public.fn_criar_obra('P2', 'Rua 4', 'C', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null, '[{"nome": "E", "peso": 100}]'::jsonb) as id;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af113", "role": "authenticated"}';
create temp table t_q1 as select public.fn_criar_obra('Q1', 'Rua 5', 'C', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null, '[{"nome": "E", "peso": 100}]'::jsonb) as id;
reset role;

-- ===== sem indicação / sem dono =====
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af113', (select id from t_q1), 12990, true))->>'descontoCentavos',
  '0', 'quem não foi indicado não tem desconto');
select throws_ok(
  format($$select public.fn_afiliado_desconto_obra(%L::uuid, %L::uuid, 12990, false)$$,
    '00000000-0000-0000-0000-0000000af111', (select id from t_q1)),
  'P0001', 'SEM_PERMISSAO', 'a obra precisa ser do usuário');
select throws_ok(
  format($$select public.fn_afiliado_desconto_obra(%L::uuid, %L::uuid, 0, false)$$,
    '00000000-0000-0000-0000-0000000af111', (select id from t_o1)),
  'P0001', 'VALOR_INVALIDO', 'preço inválido');

-- ===== primeira fatura: reserva numa única obra =====
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o1), 12990, false))->>'descontoCentavos',
  '2598', '20% de R$ 129,90 na prévia');
select is((select desconto_obra_id from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af111'),
  null, 'a prévia não reserva');

select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o1), 12990, true))->>'descontoCentavos',
  '2598', 'reservar devolve o desconto');
select is((select desconto_obra_id::text from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af111'),
  (select id::text from t_o1), 'a reserva fica na primeira obra');
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o2), 12990, true))->>'descontoCentavos',
  '0', 'a segunda obra não tem desconto');
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o1), 12990, true))->>'descontoCentavos',
  '2598', 'repetir para a mesma obra mantém o desconto (retentativa do cartão)');

-- cartão recusado: libera e a outra obra pode reservar
select lives_ok(
  format($$select public.fn_afiliado_desconto_liberar(%L::uuid, %L::uuid)$$,
    '00000000-0000-0000-0000-0000000af111', (select id from t_o1)),
  'liberar a reserva');
select is((select desconto_obra_id from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af111'),
  null, 'reserva liberada');
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o2), 12990, true))->>'descontoCentavos',
  '2598', 'a outra obra reserva depois da liberação');

-- assinatura registrada (cobrada com desconto) e desconto em vigor
select public.fn_cobranca_registrar((select id from t_o2), 'mp_sub_o2', null, 10392,
  now() - interval '1 day', now() + interval '10 days');
select is(public.fn_afiliado_desconto_assinatura('mp_sub_o2', 12990), 2598,
  'desconto em vigor na assinatura da obra reservada');
select is(public.fn_afiliado_desconto_assinatura('mp_inexistente', 12990), 0,
  'assinatura desconhecida não tem desconto');

-- 1º pagamento: devolve o que reverter
create temp table t_pg as
select public.fn_afiliado_registrar_pagamento((select id from t_o2), '9001', 10392) as r;
select is((select r->'reverter'->>'descontoCentavos' from t_pg), '2598', 'o pagamento da obra com desconto pede a reversão');
select is((select r->'reverter'->>'alvoCentavos' from t_pg), null, 'ainda sem valor-alvo gravado');
select is((select r->>'comissaoCentavos' from t_pg), '1039', 'a comissão é sobre o valor cobrado com desconto (10% de 103,92)');

select is(public.fn_afiliado_desconto_reversao_alvo((select id from t_o2), 12990), 12990, 'grava o valor-alvo');
select is(public.fn_afiliado_desconto_reversao_alvo((select id from t_o2), 15980), 12990,
  'o valor-alvo gravado não muda (retentativa manda o mesmo valor)');
select is((public.fn_afiliado_registrar_pagamento((select id from t_o2), '9001', 10392))->'reverter'->>'alvoCentavos',
  '12990', 'a repetição do pagamento ainda pede a reversão, com o mesmo alvo');
select ok(exists (select 1 from jsonb_array_elements(public.fn_afiliado_descontos_a_reverter()) i where i->>'subscriptionId' = 'mp_sub_o2'),
  'o job diário enxerga a reversão pendente');

select is((select valor_centavos from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_o2'), 10392,
  'antes da reversão a cobrança guarda o valor com desconto');
select lives_ok(format($$select public.fn_afiliado_desconto_revertido(%L::uuid)$$, (select id from t_o2)),
  'marcar como revertido');
select is((select valor_centavos from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_o2'), 12990,
  'a reversão devolve o valor da cobrança ao preço cheio (Cobrança e Conta passam a mostrar R$ 129,90)');
select lives_ok(format($$select public.fn_afiliado_desconto_revertido(%L::uuid)$$, (select id from t_o2)),
  'repetir a marcação é inofensivo');
select is((select valor_centavos from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_o2'), 12990,
  'repetir a reversão não soma o desconto duas vezes');
select is((public.fn_afiliado_registrar_pagamento((select id from t_o2), '9001', 10392))->>'reverter', null,
  'depois de revertido, nada mais a reverter');
select is(public.fn_afiliado_desconto_assinatura('mp_sub_o2', 12990), 0, 'sem desconto em vigor depois da reversão');
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af111', (select id from t_o2), 12990, true))->>'descontoCentavos',
  '0', 'o desconto de 1ª fatura não volta');
select ok(not exists (select 1 from jsonb_array_elements(public.fn_afiliado_descontos_a_reverter()) i where i->>'subscriptionId' = 'mp_sub_o2'),
  'nada pendente para a obra revertida no job diário');

-- depois do pagamento, liberar não mexe (o desconto foi usado)
select lives_ok(
  format($$select public.fn_afiliado_desconto_liberar(%L::uuid, %L::uuid)$$,
    '00000000-0000-0000-0000-0000000af111', (select id from t_o2)),
  'liberar depois de pago é inofensivo');
select is((select desconto_obra_id::text from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af111'),
  (select id::text from t_o2), 'a reserva de uma obra paga permanece');

-- ===== permanente =====
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af112', (select id from t_p1), 12990, true))->>'descontoCentavos',
  '1299', '10% permanente na primeira obra');
select is((public.fn_afiliado_desconto_obra('00000000-0000-0000-0000-0000000af112', (select id from t_p2), 12990, true))->>'descontoCentavos',
  '1299', '10% permanente também na segunda obra');
select is((select desconto_obra_id from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af112'),
  null, 'desconto permanente não reserva obra');
select public.fn_cobranca_registrar((select id from t_p1), 'mp_sub_p1', null, 11691,
  now() - interval '1 day', now() + interval '10 days');
select is(public.fn_afiliado_desconto_assinatura('mp_sub_p1', 12990), 1299, 'desconto permanente vale na assinatura');
select is((public.fn_afiliado_registrar_pagamento((select id from t_p1), '9101', 11691))->>'reverter', null,
  'desconto permanente nunca é revertido');
select is((select valor_centavos from public.cobrancas_obra where provedor_assinatura_id = 'mp_sub_p1'), 11691,
  'desconto permanente mantém o valor da cobrança com desconto');
select is((select valor_centavos from private.afiliado_lancamentos where provedor_pagamento_id = '9101'), 585,
  'link de 5% só na 1ª fatura: o 1º pagamento rende comissão sobre o valor com desconto (arredondada)');

select * from finish();
rollback;
