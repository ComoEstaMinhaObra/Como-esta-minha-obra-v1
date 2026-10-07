-- pgTAP: regularização de pagamento pendente (D3), 07/10/2026

begin;
select plan(16);

select ok(not has_function_privilege('anon', 'public.fn_cobranca_solicitar_regularizacao(uuid)', 'execute'),
  'anon não executa fn_cobranca_solicitar_regularizacao');
select ok(has_function_privilege('authenticated', 'public.fn_cobranca_solicitar_regularizacao(uuid)', 'execute'),
  'authenticated executa fn_cobranca_solicitar_regularizacao');

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000f001', 'dono-reg@example.com', '{"nome": "Dono"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000f002', 'outro-reg@example.com', '{"nome": "Outro"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated"}';
create temp table t_o as
select public.fn_criar_obra('Obra R', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
select public.fn_cobranca_registrar((select id from t_o), 'subs_reg_1', 'bill_reg_1', 12990,
  now() - interval '40 days', now() - interval '10 days');

-- ativa não é regularizável
select throws_ok(
  format($$select public.fn_cobranca_solicitar_regularizacao(%L)$$, (select id from t_o)),
  'P0001', 'COBRANCA_NAO_REGULARIZAVEL',
  'cobrança ativa não pode ser regularizada'
);

-- o job a transforma em inadimplente
select is(((public.fn_cobranca_job_diario())->'novasInadimplentes')->0->>'obraId', (select id::text from t_o),
  'job marca a obra com período vencido como inadimplente');
select ok(not private.obra_permite_escrita((select id from t_o)), 'obra inadimplente é somente leitura');

-- outro usuário não regulariza a obra alheia
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated"}';
select throws_ok(
  format($$select public.fn_cobranca_solicitar_regularizacao(%L)$$, (select id from t_o)),
  'P0001', 'COBRANCA_NAO_REGULARIZAVEL',
  'outro usuário não regulariza a obra alheia'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated"}';

-- concluir sem pedido não faz nada
select throws_ok(
  format($$select public.fn_cobranca_concluir_regularizacao(%L)$$, (select id from t_o)),
  'P0001', 'COBRANCA_NAO_REGULARIZAVEL',
  'concluir sem ter solicitado é recusado'
);

-- solicitar devolve a assinatura e grava a intenção
select is(
  (public.fn_cobranca_solicitar_regularizacao((select id from t_o)))->>'subscriptionId',
  'subs_reg_1',
  'solicitar devolve a assinatura a cancelar no provedor'
);
select ok(
  (select cancelamento_solicitado_em is not null from public.cobrancas_obra where abacatepay_subscription_id = 'subs_reg_1'),
  'solicitar grava a intenção antes do provedor'
);
select is((select status::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_reg_1'), 'inadimplente',
  'solicitar ainda não muda o status');

-- falha do provedor: desfazer limpa a intenção
select public.fn_cobranca_desfazer_regularizacao((select id from t_o));
select ok(
  (select cancelamento_solicitado_em is null from public.cobrancas_obra where abacatepay_subscription_id = 'subs_reg_1'),
  'desfazer limpa a intenção quando o provedor falha'
);

-- caminho feliz, com o webhook de cancelamento chegando ANTES do passo 2
select public.fn_cobranca_solicitar_regularizacao((select id from t_o));
select is(
  (public.fn_cobranca_cancelada_webhook('subs_reg_1'))->>'resultado',
  'agendado_pelo_app',
  'webhook que chega antes do passo 2 não gera alerta de cancelamento sem pedido'
);
select lives_ok(
  format($$select public.fn_cobranca_concluir_regularizacao(%L)$$, (select id from t_o)),
  'concluir aceita cancelamento_agendado criado pelo webhook'
);
select is((select status::text from public.cobrancas_obra where abacatepay_subscription_id = 'subs_reg_1'), 'cancelada',
  'a cobrança com falha fica cancelada');

-- depois da regularização a obra aceita nova cobrança
select is(
  (public.fn_cobranca_registrar((select id from t_o), 'subs_reg_2', 'bill_reg_2', 12990,
     now(), now() + interval '1 month'))->>'criada',
  'true',
  'o novo checkout registra uma nova cobrança para a obra'
);
select ok(private.obra_permite_escrita((select id from t_o)), 'a obra volta a aceitar escrita depois de pagar');

select * from finish();
rollback;
