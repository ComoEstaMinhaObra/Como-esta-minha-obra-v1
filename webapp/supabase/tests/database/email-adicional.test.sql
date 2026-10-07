-- pgTAP: e-mail adicional lançado na assinatura DA OBRA (revisão de 07/10/2026)

begin;
select plan(23);

-- ===== privilégios =====
select ok(not has_function_privilege('authenticated', 'public.fn_enfileirar_renovacao_emails_obra(text, text)', 'execute'),
  'authenticated não executa fn_enfileirar_renovacao_emails_obra');
select ok(has_function_privilege('service_role', 'public.fn_enfileirar_renovacao_emails_obra(text, text)', 'execute'),
  'service_role executa fn_enfileirar_renovacao_emails_obra');

-- ===== fixtures: pagante (e001) com obra A paga e obra B sem cobrança; trial (e002) =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000e001', 'pagante-em@example.com', '{"nome": "Pagante"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-00000000e002', 'trial-em@example.com', '{"nome": "Trial"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000e001", "role": "authenticated"}';
create temp table t_a as
select public.fn_criar_obra('Obra A', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select public.fn_cobranca_registrar((select id from t_a), 'subs_em_a', 'bill_em_a', 12990,
  now(), now() + interval '1 month');

-- ===== 1º e-mail: grátis, sem outbox =====
select is(
  (public.fn_solicitar_acesso_obra((select id from t_a), 'cliente1@example.com'))->>'cobradoExtra',
  'false',
  'o 1º e-mail da obra paga é gratuito'
);

-- ===== 2º e-mail: cobrado na assinatura da obra =====
create temp table t_extra as
select public.fn_solicitar_acesso_obra((select id from t_a), 'cliente2@example.com') as r;

select is((select r->>'cobradoExtra' from t_extra), 'true',
  'o 2º e-mail da obra paga é cobrado (antes caía em PRECISA_ASSINAR)');
select is((select r->>'status' from t_extra), 'pendente_cobranca',
  'o 2º e-mail fica pendente até o provedor confirmar');
select is(
  (select count(*)::int from private.billing_outbox where id = ((select r->>'outboxId' from t_extra))::uuid and operacao = 'add'),
  1,
  'o 2º e-mail enfileira um add na outbox'
);

-- claim usa a assinatura da OBRA
create temp table t_claim as
select public.fn_claim_outbox(((select r->>'outboxId' from t_extra))::uuid) as c;
select is((select c->>'status' from t_claim), 'processando', 'claim marca o add como processando');
select is((select c->>'subscriptionId' from t_claim), 'subs_em_a',
  'o uso é lançado na assinatura da obra, não na da conta');
select is((select c->>'operacao' from t_claim), 'add', 'claim devolve a operação add');

-- confirmação libera o acesso e manda o convite
select is(
  (public.fn_confirmar_outbox(((select r->>'outboxId' from t_extra))::uuid, 'usgr_em_1', 2))->>'enviarEmail',
  'true',
  'confirmar o add libera o acesso e manda o convite'
);
select is(
  (select status::text from public.obra_acessos where id = ((select r->>'acessoId' from t_extra))::uuid),
  'convidado',
  'o acesso pago fica convidado depois da confirmação'
);

-- 3º e-mail: também cobrado
select is(
  (public.fn_solicitar_acesso_obra((select id from t_a), 'cliente3@example.com'))->>'cobradoExtra',
  'true',
  'o 3º e-mail também é cobrado'
);

-- ===== renovação mensal =====
select is(
  jsonb_array_length((public.fn_enfileirar_renovacao_emails_obra('subs_em_a', 'evt_renew_1'))->'outboxIds'),
  1,
  'a renovação relança só o adicional já confirmado (o 3º ainda está pendente)'
);
select is(
  jsonb_array_length((public.fn_enfileirar_renovacao_emails_obra('subs_em_a', 'evt_renew_1'))->'outboxIds'),
  0,
  'repetir o mesmo evento de renovação não duplica a cobrança'
);
select is(
  jsonb_array_length((public.fn_enfileirar_renovacao_emails_obra('subs_inexistente', 'evt_renew_2'))->'outboxIds'),
  0,
  'assinatura desconhecida não enfileira nada'
);
select is(
  (select c->>'subscriptionId' from (
    select public.fn_claim_outbox(o.id) as c
    from private.billing_outbox o
    where o.chave_interna like 'renew:evt_renew_1:%'
    order by o.criado_em limit 1) q),
  'subs_em_a',
  'o add de renovação também usa a assinatura da obra'
);

-- ===== revogar um e-mail pago desfaz a cobrança =====
create temp table t_rev as
select public.fn_revogar_acesso_obra((select id from t_a), ((select r->>'acessoId' from t_extra))::uuid) as r;
select ok((select r->>'outboxId' from t_rev) is not null,
  'revogar um e-mail pago enfileira o subtract');
select is(
  (select c->>'operacao' || ':' || (c->>'subscriptionId') from (
    select public.fn_claim_outbox(((select r->>'outboxId' from t_rev))::uuid) as c) q),
  'subtract:subs_em_a',
  'o subtract é lançado na assinatura da obra'
);

-- ===== obra sem cobrança: o 1º e-mail é grátis, o 2º pede a cobrança =====
create temp table t_b as
select public.fn_criar_obra('Obra B', 'Rua 2', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
-- obra B de um pagante, sem cobrança, é somente leitura: nem o 1º e-mail
select throws_ok(
  format($$select public.fn_solicitar_acesso_obra(%L, 'b1@example.com')$$, (select id from t_b)),
  'P0001', 'ASSINATURA_INATIVA',
  'obra sem cobrança não libera e-mail'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000e002", "role": "authenticated"}';
create temp table t_t as
select public.fn_criar_obra('Obra T', 'Rua 3', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
select is(
  (public.fn_solicitar_acesso_obra((select id from t_t), 'trial1@example.com'))->>'cobradoExtra',
  'false',
  'obra do trial: o 1º e-mail é gratuito'
);
select throws_ok(
  format($$select public.fn_solicitar_acesso_obra(%L, 'trial2@example.com')$$, (select id from t_t)),
  'P0001', 'PRECISA_ASSINAR',
  'obra do trial: o 2º e-mail exige contratar a cobrança da obra'
);

-- ===== helper =====
select is(private.assinatura_provedor_da_obra((select id from t_a), true), 'subs_em_a',
  'helper devolve a assinatura da obra ativa');
select is(private.assinatura_provedor_da_obra((select id from t_t), false), null,
  'helper devolve nulo para obra sem cobrança');

select * from finish();
rollback;
