-- pgTAP: cobrança por obra (E2 do plano da tela de Cobrança)

begin;
select plan(30);

-- ===== estrutura, RLS e grants =====
select has_table('public', 'cobrancas_obra', 'tabela cobrancas_obra existe');

select ok(
  (select relrowsecurity from pg_class
   where relname = 'cobrancas_obra' and relnamespace = 'public'::regnamespace),
  'RLS habilitada em cobrancas_obra'
);

select is(
  (select string_agg(cmd, ',' order by cmd) from pg_policies
   where schemaname = 'public' and tablename = 'cobrancas_obra'),
  'SELECT',
  'cobrancas_obra só tem policy de SELECT'
);

select ok(has_table_privilege('authenticated', 'public.cobrancas_obra', 'select'),
  'authenticated pode SELECT em cobrancas_obra');
select ok(not has_table_privilege('authenticated', 'public.cobrancas_obra', 'insert'),
  'authenticated sem INSERT em cobrancas_obra');
select ok(not has_table_privilege('authenticated', 'public.cobrancas_obra', 'update'),
  'authenticated sem UPDATE em cobrancas_obra');
select ok(not has_table_privilege('authenticated', 'public.cobrancas_obra', 'delete'),
  'authenticated sem DELETE em cobrancas_obra');
select ok(not has_table_privilege('anon', 'public.cobrancas_obra', 'select'),
  'anon sem SELECT em cobrancas_obra');

select ok(
  not has_function_privilege('authenticated', 'private.obra_permite_escrita(uuid)', 'execute'),
  'authenticated não executa private.obra_permite_escrita'
);
select ok(
  not has_function_privilege('authenticated', 'private.obra_cobranca_vigente(uuid, timestamptz)', 'execute'),
  'authenticated não executa private.obra_cobranca_vigente'
);

-- ===== fixtures: três donos, uma obra cada =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000c001', 'trial@example.com', '{"nome": "Trial"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000c002', 'legado@example.com', '{"nome": "Legado"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000c003', 'cobrado@example.com', '{"nome": "Cobrado"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated"}';
create temp table t_a as
select public.fn_criar_obra('Obra A', 'Rua 1', 'Cliente', date '2026-01-01',
  date '2026-12-01', 100000::bigint, 10000::bigint, null, null, null, null, null,
  null, null, null, null, '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c002", "role": "authenticated"}';
create temp table t_b as
select public.fn_criar_obra('Obra B', 'Rua 2', 'Cliente', date '2026-01-01',
  date '2026-12-01', 100000::bigint, 10000::bigint, null, null, null, null, null,
  null, null, null, null, '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c003", "role": "authenticated"}';
create temp table t_c as
select public.fn_criar_obra('Obra C', 'Rua 3', 'Cliente', date '2026-01-01',
  date '2026-12-01', 100000::bigint, 10000::bigint, null, null, null, null, null,
  null, null, null, null, '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

-- ===== permissão por obra: trial =====
select ok(
  private.obra_permite_escrita((select id from t_a)),
  'trial dentro do prazo: a obra do trial aceita escrita'
);

update public.assinaturas set trial_fim = now() - interval '1 day'
where user_id = '00000000-0000-0000-0000-00000000c001';

select ok(
  not private.obra_permite_escrita((select id from t_a)),
  'trial vencido sem cobrança: a obra fica somente leitura'
);

-- ===== permissão por obra: a conta ativa do modelo antigo não vale mais (E5) =====
update public.assinaturas set status = 'ativa'
where user_id = '00000000-0000-0000-0000-00000000c002';

select ok(
  not private.obra_permite_escrita((select id from t_b)),
  'conta ativa do modelo antigo, sem cobrança da obra: somente leitura (sem ramo legado)'
);

-- primeira cobrança da obra B: inadimplente
insert into public.cobrancas_obra
  (user_id, obra_id, abacatepay_subscription_id, status, valor_centavos,
   periodo_inicio, periodo_fim, inadimplente_desde)
values ('00000000-0000-0000-0000-00000000c002', (select id from t_b), 'subs_b1', 'inadimplente',
        12990, now() - interval '40 days', now() - interval '10 days', now() - interval '9 days');

select ok(
  not private.obra_permite_escrita((select id from t_b)),
  'obra inadimplente: somente leitura'
);

update public.cobrancas_obra set status = 'ativa', inadimplente_desde = null,
  periodo_fim = now() + interval '20 days'
where abacatepay_subscription_id = 'subs_b1';

select ok(
  private.obra_permite_escrita((select id from t_b)),
  'cobrança ativa: a obra aceita escrita'
);

update public.cobrancas_obra set status = 'cancelamento_agendado',
  cancelamento_solicitado_em = now(), acesso_ate = now() + interval '5 days'
where abacatepay_subscription_id = 'subs_b1';

select ok(
  private.obra_permite_escrita((select id from t_b)),
  'cancelamento agendado antes de acesso_ate: a obra mantém os recursos'
);

update public.cobrancas_obra set acesso_ate = now() - interval '1 day'
where abacatepay_subscription_id = 'subs_b1';

select ok(
  not private.obra_permite_escrita((select id from t_b)),
  'cancelamento agendado depois de acesso_ate: somente leitura'
);

-- ===== uma cobrança não cancelada por obra =====
select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c002', (select id from t_b), 'subs_b2', 12990,
            now() + interval '30 days')$$,
  '23505',
  null,
  'não permite segunda cobrança não cancelada para a mesma obra'
);

update public.cobrancas_obra set status = 'cancelada'
where abacatepay_subscription_id = 'subs_b1';

select ok(
  not private.obra_permite_escrita((select id from t_b)),
  'cobrança cancelada: somente leitura (sem cair no legado)'
);

select lives_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c002', (select id from t_b), 'subs_b2', 12990,
            now() + interval '30 days')$$,
  'depois de cancelada, a obra aceita uma nova cobrança (reativação)'
);

select ok(
  private.obra_permite_escrita((select id from t_b)),
  'reativação: a nova cobrança ativa libera a escrita'
);

-- ===== constraints =====
select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, status, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c003', (select id from t_c), 'subs_c0',
            'inadimplente', 12990, now() + interval '30 days')$$,
  '23514', null,
  'inadimplente exige inadimplente_desde'
);

select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, status, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c003', (select id from t_c), 'subs_c0',
            'cancelamento_agendado', 12990, now() + interval '30 days')$$,
  '23514', null,
  'cancelamento agendado exige acesso_ate e cancelamento_solicitado_em'
);

select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c003', (select id from t_c), 'subs_c0', 0,
            now() + interval '30 days')$$,
  '23514', null,
  'valor da cobrança precisa ser maior que zero'
);

select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_inicio, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c003', (select id from t_c), 'subs_c0', 12990,
            now(), now() - interval '1 day')$$,
  '23514', null,
  'periodo_fim precisa ser depois de periodo_inicio'
);

select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c001', (select id from t_b), 'subs_x1', 12990,
            now() + interval '30 days')$$,
  'P0001', 'COBRANCA_DONO_INVALIDO',
  'a cobrança precisa pertencer ao dono da obra'
);

select throws_ok(
  $$update public.cobrancas_obra set obra_id = (select id from t_c)
    where abacatepay_subscription_id = 'subs_b2'$$,
  'P0001', 'COBRANCA_IMUTAVEL',
  'usuário e obra da cobrança não mudam depois de criada'
);

-- ===== id da assinatura único =====
insert into public.cobrancas_obra
  (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
values ('00000000-0000-0000-0000-00000000c003', (select id from t_c), 'subs_c1', 12990,
        now() + interval '30 days');

select throws_ok(
  $$insert into public.cobrancas_obra
      (user_id, obra_id, abacatepay_subscription_id, valor_centavos, periodo_fim)
    values ('00000000-0000-0000-0000-00000000c001', (select id from t_a), 'subs_c1', 12990,
            now() + interval '30 days')$$,
  '23505', null,
  'abacatepay_subscription_id é único'
);

-- ===== RLS: cada dono só vê as próprias cobranças =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c003", "role": "authenticated"}';

select is(
  (select count(*) from public.cobrancas_obra),
  1::bigint,
  'dono vê só a própria cobrança'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated"}';

select is(
  (select count(*) from public.cobrancas_obra),
  0::bigint,
  'outro usuário não vê cobranças alheias'
);

reset role;

select * from finish();
rollback;
