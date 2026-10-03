-- pgTAP: período pago aproveitável (regra Q1, E4)

begin;
select plan(12);

select ok(has_function_privilege('authenticated', 'public.fn_vaga_paga_disponivel()', 'execute'),
  'authenticated executa fn_vaga_paga_disponivel');
select ok(not has_function_privilege('anon', 'public.fn_vaga_paga_disponivel()', 'execute'),
  'anon não executa fn_vaga_paga_disponivel');
select has_column('public', 'cobrancas_obra', 'periodo_aproveitado_por_obra_id',
  'cobrancas_obra guarda qual obra aproveitou o período');

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000e001', 'vaga1@example.com', '{"nome": "Vaga 1"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000e002', 'vaga2@example.com', '{"nome": "Vaga 2"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000e001", "role": "authenticated"}';
create temp table t_a as
select public.fn_criar_obra('Obra A', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select public.fn_cobranca_registrar((select id from t_a), 'subs_va', 'bill_va', 12990,
  now() - interval '20 days', now() + interval '10 days');

-- sem arquivar nem cancelar: nada aproveitável
select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'false',
  'cobrança ativa de obra em uso não gera período aproveitável'
);

-- cancelamento pedido, mas a obra continua ativa: ainda não há período aproveitável
select public.fn_cobranca_solicitar_cancelamento((select id from t_a));
select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'false',
  'cancelamento sem arquivar a obra não gera período aproveitável'
);

-- obra arquivada com cancelamento agendado: período aproveitável
update public.obras set arquivada_em = now() where id = (select id from t_a);

select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'true',
  'obra arquivada com cancelamento agendado gera período aproveitável'
);
select ok(
  ((public.fn_vaga_paga_disponivel())->>'dias')::int between 10 and 11,
  'dias é o tempo restante do período pago, arredondado para cima'
);

-- outro usuário não vê o período do primeiro
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000e002", "role": "authenticated"}';
select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'false',
  'o período aproveitável é só do dono'
);

-- a obra nova (B) abre assinatura com primeira cobrança no fim do período da arquivada
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000e001", "role": "authenticated"}';
create temp table t_b as
select public.fn_criar_obra('Obra B', 'Rua 2', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select public.fn_cobranca_registrar((select id from t_b), 'subs_vb', 'bill_vb', 12990,
  now(),
  (select date_trunc('day', acesso_ate) + interval '23 hours 59 minutes 59 seconds'
   from public.cobrancas_obra where abacatepay_subscription_id = 'subs_va'),
  (select date_trunc('day', acesso_ate) + interval '23 hours 59 minutes 59 seconds'
   from public.cobrancas_obra where abacatepay_subscription_id = 'subs_va'));

select is(
  (select periodo_aproveitado_por_obra_id::text from public.cobrancas_obra
   where abacatepay_subscription_id = 'subs_va'),
  (select id::text from t_b),
  'a assinatura com primeira cobrança adiada marca o período aproveitado'
);

select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'false',
  'o período já aproveitado não vale para outra obra'
);

-- obra C com primeira cobrança adiada sem período disponível não marca nada
create temp table t_c as
select public.fn_criar_obra('Obra C', 'Rua 3', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select public.fn_cobranca_registrar((select id from t_c), 'subs_vc', 'bill_vc', 12990,
  now(), now() + interval '30 days', now() + interval '30 days');

select is(
  (select count(*) from public.cobrancas_obra where periodo_aproveitado_por_obra_id = (select id from t_c)),
  0::bigint,
  'primeira cobrança adiada sem período disponível não marca aproveitamento'
);

-- período já vencido não é aproveitável
update public.cobrancas_obra
set periodo_aproveitado_por_obra_id = null, acesso_ate = now() - interval '1 day'
where abacatepay_subscription_id = 'subs_va';
select is(
  (public.fn_vaga_paga_disponivel())->>'disponivel',
  'false',
  'período já vencido não é aproveitável'
);

select * from finish();
rollback;
