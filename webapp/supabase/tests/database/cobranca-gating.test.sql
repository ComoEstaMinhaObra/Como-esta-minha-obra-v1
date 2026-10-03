-- pgTAP: gravação da cobrança, cancelamento, job e gating por obra (E3)

begin;
select plan(44);

-- ===== privilégios =====
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_registrar(uuid, text, text, int, timestamptz, timestamptz, timestamptz)', 'execute'),
  'authenticated não executa fn_cobranca_registrar');
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_renovar(text, timestamptz)', 'execute'),
  'authenticated não executa fn_cobranca_renovar');
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_cancelada_webhook(text, timestamptz)', 'execute'),
  'authenticated não executa fn_cobranca_cancelada_webhook');
select ok(not has_function_privilege('authenticated', 'public.fn_cobranca_job_diario(timestamptz)', 'execute'),
  'authenticated não executa o job diário');
select ok(has_function_privilege('service_role', 'public.fn_cobranca_registrar(uuid, text, text, int, timestamptz, timestamptz, timestamptz)', 'execute'),
  'service_role executa fn_cobranca_registrar');
select ok(has_function_privilege('service_role', 'public.fn_cobranca_job_diario(timestamptz)', 'execute'),
  'service_role executa o job diário');
select ok(has_function_privilege('authenticated', 'public.fn_cobranca_solicitar_cancelamento(uuid)', 'execute'),
  'authenticated executa fn_cobranca_solicitar_cancelamento');
select ok(not has_function_privilege('anon', 'public.fn_cobranca_solicitar_cancelamento(uuid)', 'execute'),
  'anon não executa fn_cobranca_solicitar_cancelamento');

-- ===== fixtures: trial (d001), pagante (d002), trial vencido (d003) =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000d001', 'trial2@example.com', '{"nome": "Trial"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000d002', 'pagante@example.com', '{"nome": "Pagante"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000d003', 'vencido@example.com', '{"nome": "Vencido"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000d001", "role": "authenticated"}';
create temp table t_trial as
select public.fn_criar_obra('Trial', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

-- trial permite só uma obra
select throws_ok(
  $$select public.fn_criar_obra('Trial 2', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
      100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
      '[{"nome": "Estrutura", "peso": 100}]'::jsonb)$$,
  'P0001', 'LIMITE_OBRAS',
  'trial sem cobrança: a segunda obra é bloqueada'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';
create temp table t_x as
select public.fn_criar_obra('Obra X', 'Rua 2', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

-- ===== fn_cobranca_registrar =====
select is(
  (public.fn_cobranca_registrar((select id from t_x), 'subs_x1', 'bill_x1', 12990,
     now(), now() + interval '1 month'))->>'criada',
  'true',
  'registrar cria a cobrança da obra'
);

select is(
  (public.fn_cobranca_registrar((select id from t_x), 'subs_x1', 'bill_x1', 12990,
     now(), now() + interval '1 month'))->>'criada',
  'false',
  'registrar é idempotente por assinatura'
);

select is(
  (select user_id::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_x1'),
  '00000000-0000-0000-0000-00000000d002',
  'a cobrança fica com o dono da obra'
);

select throws_ok(
  $$select public.fn_cobranca_registrar((select id from t_x), 'subs_x2', 'bill_x2', 12990,
      now(), now() + interval '1 month')$$,
  'P0001', 'COBRANCA_DUPLICADA',
  'registrar rejeita segunda cobrança não cancelada da mesma obra'
);

select throws_ok(
  $$select public.fn_cobranca_registrar((select id from t_trial), 'subs_x1', 'bill_x1', 12990,
      now(), now() + interval '1 month')$$,
  'P0001', 'COBRANCA_OBRA_DIVERGENTE',
  'registrar rejeita a mesma assinatura em outra obra'
);

select throws_ok(
  $$select public.fn_cobranca_registrar(gen_random_uuid(), 'subs_zz', 'bill_zz', 12990,
      now(), now() + interval '1 month')$$,
  'P0001', 'OBRA_AUSENTE',
  'registrar rejeita obra inexistente'
);

-- ===== o pagante cria obras sem limite, mas cada obra precisa da própria cobrança =====
create temp table t_y as
select public.fn_criar_obra('Obra Y', 'Rua 3', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select ok(
  (select id from t_y) is not null,
  'quem tem cobrança vigente cria a segunda obra sem limite'
);

select ok(
  private.obra_permite_escrita((select id from t_x)),
  'obra com cobrança aceita escrita'
);
select ok(
  not private.obra_permite_escrita((select id from t_y)),
  'obra sem cobrança de um pagante não aceita escrita'
);

select lives_ok(
  format($$select public.fn_atualizar_capa_obra(%L, %L)$$, (select id from t_x), (select id from t_x) || '/capa.webp'),
  'fn_atualizar_capa_obra funciona na obra com cobrança'
);
select throws_ok(
  format($$select public.fn_atualizar_capa_obra(%L, %L)$$, (select id from t_y), (select id from t_y) || '/capa.webp'),
  'P0001', 'ASSINATURA_INATIVA',
  'fn_atualizar_capa_obra bloqueia a obra sem cobrança'
);

-- trial vencido sem cobrança não cria obra
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000d003", "role": "authenticated"}';
update public.assinaturas set trial_fim = now() - interval '1 day'
where user_id = '00000000-0000-0000-0000-00000000d003';
select throws_ok(
  $$select public.fn_criar_obra('Vencido', 'Rua 4', 'Cliente', date '2026-01-01', date '2026-12-01',
      100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
      '[{"nome": "Estrutura", "peso": 100}]'::jsonb)$$,
  'P0001', 'TRIAL_EXPIRADO',
  'trial vencido sem cobrança não cria obra'
);

-- ===== cancelamento pelo dono =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';

select is(
  (public.fn_cobranca_solicitar_cancelamento((select id from t_x)))->>'subscriptionId',
  'subs_x1',
  'solicitar cancelamento devolve a assinatura a cancelar no provedor'
);

select is(
  (select status::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_x1'),
  'cancelamento_agendado',
  'solicitar cancelamento agenda o fim do período'
);

select ok(
  (select acesso_ate = periodo_fim from public.cobrancas_obra where abacatepay_subscription_id = 'subs_x1'),
  'acesso_ate é o fim do período já pago'
);

select ok(
  private.obra_permite_escrita((select id from t_x)),
  'obra com cancelamento agendado mantém os recursos até acesso_ate'
);

select throws_ok(
  format($$select public.fn_cobranca_solicitar_cancelamento(%L)$$, (select id from t_x)),
  'P0001', 'COBRANCA_NAO_CANCELAVEL',
  'não cancela duas vezes'
);

select lives_ok(
  format($$select public.fn_cobranca_desfazer_cancelamento(%L)$$, (select id from t_x)),
  'desfazer cancelamento logo depois do pedido'
);

select is(
  (select status::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_x1'),
  'ativa',
  'desfazer volta a cobrança para ativa'
);

select lives_ok(
  format($$select public.fn_cobranca_solicitar_cancelamento(%L)$$, (select id from t_x)),
  'novo pedido de cancelamento'
);
update public.cobrancas_obra set cancelamento_solicitado_em = now() - interval '1 hour'
where abacatepay_subscription_id = 'subs_x1';
select throws_ok(
  format($$select public.fn_cobranca_desfazer_cancelamento(%L)$$, (select id from t_x)),
  'P0001', 'COBRANCA_NAO_DESFAZIVEL',
  'não desfaz cancelamento depois da janela'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000d001", "role": "authenticated"}';
select throws_ok(
  format($$select public.fn_cobranca_solicitar_cancelamento(%L)$$, (select id from t_x)),
  'P0001', 'COBRANCA_AUSENTE',
  'outro usuário não cancela a cobrança alheia'
);

-- ===== webhook de cancelamento e renovação =====
select is(
  (public.fn_cobranca_cancelada_webhook('subs_x1'))->>'resultado',
  'ja_agendado',
  'cancelamento do provedor depois do pedido do app não muda nada'
);

select is(
  (public.fn_cobranca_renovar('subs_x1'))->>'alterada',
  'false',
  'renovação de cobrança com cancelamento agendado é ignorada'
);

select throws_ok(
  $$select public.fn_cobranca_renovar('subs_inexistente')$$,
  'P0001', 'COBRANCA_AUSENTE',
  'renovar assinatura desconhecida falha'
);

-- assinatura sem pedido do app: cancelamento vira cancelada
select public.fn_cobranca_registrar((select id from t_y), 'subs_y1', 'bill_y1', 12990,
  now(), now() + interval '1 month');

select is(
  (public.fn_cobranca_cancelada_webhook('subs_y1'))->>'resultado',
  'cancelada_sem_pedido',
  'cancelamento sem pedido do app vira cancelada (alerta ao admin)'
);
select is(
  (public.fn_cobranca_cancelada_webhook('subs_y1'))->>'resultado',
  'ja_cancelada',
  'cancelamento repetido é idempotente'
);

-- ===== renovação tira da inadimplência =====
select public.fn_cobranca_registrar((select id from t_trial), 'subs_t1', 'bill_t1', 12990,
  now() - interval '40 days', now() - interval '10 days');
update public.cobrancas_obra set status = 'inadimplente', inadimplente_desde = now() - interval '9 days'
where abacatepay_subscription_id = 'subs_t1';

select is(
  (public.fn_cobranca_renovar('subs_t1'))->>'estavaInadimplente',
  'true',
  'renovar tira a obra da inadimplência'
);
select ok(
  (select status = 'ativa' and inadimplente_desde is null and periodo_fim > now()
   from public.cobrancas_obra where abacatepay_subscription_id = 'subs_t1'),
  'renovação zera a inadimplência e abre novo período'
);

-- ===== job diário =====
update public.cobrancas_obra
set periodo_inicio = now() - interval '40 days', periodo_fim = now() - interval '3 days'
where abacatepay_subscription_id = 'subs_t1';

select is(
  jsonb_array_length((public.fn_cobranca_job_diario())->'novasInadimplentes'),
  1,
  'job marca como inadimplente a ativa com o período vencido há mais de um dia'
);
select is(
  (select status::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_t1'),
  'inadimplente',
  'a cobrança vencida ficou inadimplente'
);

select is(
  (select (public.fn_cobranca_job_diario())->>'canceladasPorFimDoPeriodo'),
  '0',
  'job sem cancelamento vencido não cancela nada'
);

update public.cobrancas_obra set acesso_ate = now() - interval '1 day'
where abacatepay_subscription_id = 'subs_x1';
select is(
  (public.fn_cobranca_job_diario())->>'canceladasPorFimDoPeriodo',
  '1',
  'job cancela o cancelamento agendado cujo período pago terminou'
);

update public.cobrancas_obra set inadimplente_desde = now() - interval '15 days'
where abacatepay_subscription_id = 'subs_t1';
select is(
  (public.fn_cobranca_job_diario())->>'canceladasPorInadimplencia',
  '1',
  'job cancela a inadimplente há mais de 14 dias'
);

select ok(
  not private.obra_permite_escrita((select id from t_trial)),
  'obra inadimplente e depois cancelada fica somente leitura'
);

select * from finish();
rollback;
