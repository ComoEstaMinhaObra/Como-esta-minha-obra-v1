-- pgTAP: programa de afiliados (links, atribuição, comissão, saque e admin)

begin;
select plan(92);

-- ===== privilégios =====
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'fn\_afiliado%' or p.proname like 'fn\_admin\_afiliado%'
          or p.proname in ('fn_sou_afiliado', 'fn_admin_buscar_usuario', 'fn_admin_saques',
                           'fn_admin_saque_pagar', 'fn_admin_saque_recusar'))) >= 16,
  'as RPCs de afiliados existem'
);
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'fn\_afiliado%' or p.proname like 'fn\_admin\_afiliado%'
          or p.proname in ('fn_sou_afiliado', 'fn_admin_buscar_usuario', 'fn_admin_saques',
                           'fn_admin_saque_pagar', 'fn_admin_saque_recusar'))
     and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint,
  'anon não executa nenhuma RPC de afiliados'
);
select ok(not has_function_privilege('authenticated', 'public.fn_afiliado_registrar_pagamento(uuid, text, int, timestamptz)', 'execute'),
  'authenticated não executa fn_afiliado_registrar_pagamento');
select ok(has_function_privilege('service_role', 'public.fn_afiliado_registrar_pagamento(uuid, text, int, timestamptz)', 'execute'),
  'service_role executa fn_afiliado_registrar_pagamento');
select ok(not has_function_privilege('authenticated', 'public.fn_afiliado_link_publico(text)', 'execute'),
  'authenticated não executa fn_afiliado_link_publico');
select ok(has_function_privilege('service_role', 'public.fn_afiliado_link_publico(text)', 'execute'),
  'service_role executa fn_afiliado_link_publico');
select ok(has_function_privilege('authenticated', 'public.fn_afiliado_painel()', 'execute'),
  'authenticated executa fn_afiliado_painel');
select ok(not has_table_privilege('authenticated', 'private.afiliado_lancamentos', 'select'),
  'authenticated sem SELECT no ledger');
select ok(not has_table_privilege('authenticated', 'private.afiliado_saques', 'select'),
  'authenticated sem SELECT nos saques (chave Pix)');
select ok(not has_table_privilege('anon', 'private.afiliado_links', 'select'),
  'anon sem SELECT nos links');

-- ===== fixtures =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000af001', 'afiliada@example.com', '{"nome": "Afiliada"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-0000000af002', 'admin-afil@example.com', '{"nome": "Admin"}', '{"provider": "email"}', now()),
  ('00000000-0000-0000-0000-0000000af003', 'comum-afil@example.com', '{"nome": "Comum"}', '{"provider": "email"}', now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000af002');

-- ===== admin: permissão =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af003", "role": "authenticated"}';
select throws_ok($$select public.fn_admin_afiliados()$$, 'P0001', 'SEM_PERMISSAO',
  'usuário comum não lê o painel de afiliados');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af001', 'x-codigo', 'x', 1000, true, 0, null)$$,
  'P0001', 'SEM_PERMISSAO', 'usuário comum não cria link');
select throws_ok($$select public.fn_admin_saques()$$, 'P0001', 'SEM_PERMISSAO',
  'usuário comum não lê os saques');
select throws_ok($$select public.fn_admin_buscar_usuario('afiliada@example.com')$$, 'P0001', 'SEM_PERMISSAO',
  'usuário comum não busca usuários');
select throws_ok($$select public.fn_admin_afiliado_config_salvar(30, 5000)$$, 'P0001', 'SEM_PERMISSAO',
  'usuário comum não altera a configuração');

-- ===== admin: links =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select is((public.fn_admin_buscar_usuario('Afiliada@Example.com'))->>'id',
  '00000000-0000-0000-0000-0000000af001', 'admin encontra o usuário por e-mail (sem diferenciar caixa)');
select is((public.fn_admin_buscar_usuario('ninguem@example.com'))->>'encontrado', 'false',
  'e-mail desconhecido volta encontrado=false');

create temp table t_l as
select (public.fn_admin_afiliado_criar_link(
  '00000000-0000-0000-0000-0000000af001', ' Promo-Joao ', 'Instagram do João', 2000, true, 1000, 'primeira_fatura'
))->>'id' as id;
create temp table t_l2 as
select (public.fn_admin_afiliado_criar_link(
  '00000000-0000-0000-0000-0000000af001', 'so-primeira', '', 1000, false, 0, 'permanente'
))->>'id' as id;

select is((select codigo from private.afiliado_links where id = (select id::uuid from t_l)), 'promo-joao',
  'o código é normalizado para minúsculas');
select is((select desconto_duracao from private.afiliado_links where id = (select id::uuid from t_l2)), null,
  'sem desconto, a duração é descartada');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af001', 'ab', '', 1000, true, 0, null)$$,
  'P0001', 'CODIGO_INVALIDO', 'código curto demais');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af001', 'PROMO-JOAO', '', 1000, true, 0, null)$$,
  'P0001', 'CODIGO_EM_USO', 'código repetido (sem diferenciar caixa)');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af001', 'sem-duracao', '', 1000, true, 500, null)$$,
  'P0001', 'DESCONTO_INVALIDO', 'desconto exige duração');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af001', 'comissao-alta', '', 10001, true, 0, null)$$,
  'P0001', 'COMISSAO_INVALIDA', 'comissão acima de 100%');
select throws_ok(
  $$select public.fn_admin_afiliado_criar_link('00000000-0000-0000-0000-0000000af999', 'sem-afiliado', '', 1000, true, 0, null)$$,
  'P0001', 'AFILIADO_NAO_ENCONTRADO', 'afiliado inexistente');

-- ===== atribuição no cadastro =====
reset role;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000af010', 'ind1@example.com', '{"nome": "Indicado 1", "ref": " PROMO-Joao "}', '{"provider": "email"}', null),
  ('00000000-0000-0000-0000-0000000af011', 'ind-invalido@example.com', '{"ref": "nao-existe"}', '{"provider": "email"}', null),
  ('00000000-0000-0000-0000-0000000af012', 'ind-numero@example.com', '{"ref": 123}', '{"provider": "email"}', null),
  ('00000000-0000-0000-0000-0000000af013', 'ind-objeto@example.com', '{"ref": {"a": 1}}', '{"provider": "email"}', null),
  ('00000000-0000-0000-0000-0000000af014', 'ind-primeira@example.com', '{"ref": "so-primeira"}', '{"provider": "email"}', null);

select is((select link_id::text from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af010'),
  (select id from t_l), 'o cadastro com ref grava a indicação (código normalizado)');
select is((select comissao_bps from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af010'),
  2000, 'os termos de comissão ficam congelados na indicação');
select is((select desconto_bps || '/' || desconto_duracao from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af010'),
  '1000/primeira_fatura', 'os termos de desconto ficam congelados na indicação');
select is((select count(*) from private.indicacoes where indicado_id in (
    '00000000-0000-0000-0000-0000000af011', '00000000-0000-0000-0000-0000000af012', '00000000-0000-0000-0000-0000000af013')),
  0::bigint, 'ref desconhecido, numérico ou objeto não gera indicação');
select is((select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-0000000af011', '00000000-0000-0000-0000-0000000af012', '00000000-0000-0000-0000-0000000af013')),
  3::bigint, 'o cadastro nunca quebra por causa do ref');

-- editar o link não muda quem já se cadastrou
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select lives_ok(
  format($$select public.fn_admin_afiliado_atualizar_link(%L::uuid, 'Instagram', 3500, true, 0, null, true)$$, (select id from t_l)),
  'admin edita o link');
select is((select comissao_bps from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af010'),
  2000, 'editar o link não altera a indicação existente');
select throws_ok(
  format($$update private.indicacoes set comissao_bps = 9999 where indicado_id = %L$$, '00000000-0000-0000-0000-0000000af010'),
  'P0001', 'IMUTAVEL', 'os termos da indicação não mudam');

-- link inativo não recebe novos cadastros
select lives_ok(
  format($$select public.fn_admin_afiliado_atualizar_link(%L::uuid, 'Inativo', 1000, false, 0, null, false)$$, (select id from t_l2)),
  'admin desativa um link');
reset role;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-0000000af015', 'ind-inativo@example.com', '{"ref": "so-primeira"}', '{"provider": "email"}', null);
select is((select count(*) from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af015'),
  0::bigint, 'link inativo não recebe novos cadastros');
select is((public.fn_afiliado_link_publico('PROMO-joao'))->>'valido', 'true', 'link público válido');
select is((public.fn_afiliado_link_publico('so-primeira'))->>'valido', 'false', 'link inativo não é público');
-- reativa para os testes de pagamento
update private.afiliado_links set ativo = true where id = (select id::uuid from t_l2);

-- ===== atribuição pelo callback (login social) =====
-- created_at não tem default em auth.users (o GoTrue preenche); aqui vai explícito
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at)
values
  ('00000000-0000-0000-0000-0000000af020', 'social-ind@example.com', '{"full_name": "Social"}', '{"provider": "google"}', now(), now()),
  ('00000000-0000-0000-0000-0000000af021', 'social-antigo@example.com', '{"full_name": "Antigo"}', '{"provider": "google"}', now(), now()),
  ('00000000-0000-0000-0000-0000000af022', 'social-invalido@example.com', '{"full_name": "Inválido"}', '{"provider": "google"}', now(), now());
update auth.users set created_at = now() - interval '2 hours'
where id = '00000000-0000-0000-0000-0000000af021';

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af020", "role": "authenticated"}';
select is((public.fn_afiliado_registrar_indicacao('promo-joao'))->>'atribuida', 'true',
  'conta nova do login social é atribuída pelo callback');
select is((select origem from private.indicacoes where indicado_id = '00000000-0000-0000-0000-0000000af020'),
  'callback', 'a origem fica registrada');
select is((public.fn_afiliado_registrar_indicacao('so-primeira'))->>'motivo', 'JA_INDICADO',
  'a indicação não troca (idempotente)');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af021", "role": "authenticated"}';
select is((public.fn_afiliado_registrar_indicacao('promo-joao'))->>'motivo', 'CONTA_ANTIGA',
  'conta com mais de 1h não é indicada');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af022", "role": "authenticated"}';
select is((public.fn_afiliado_registrar_indicacao('nao-existe'))->>'motivo', 'LINK_INVALIDO', 'código desconhecido');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
select is((public.fn_afiliado_registrar_indicacao('promo-joao'))->>'motivo', 'AUTOINDICACAO',
  'o afiliado não indica a si mesmo');

-- ===== comissão por pagamento =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af010", "role": "authenticated"}';
create temp table t_o1 as
select public.fn_criar_obra('Obra Ind 1', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af014", "role": "authenticated"}';
create temp table t_o2 as
select public.fn_criar_obra('Obra Ind 2', 'Rua 2', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af013", "role": "authenticated"}';
create temp table t_o3 as
select public.fn_criar_obra('Obra Sem Ind', 'Rua 3', 'Cliente', date '2026-01-01', date '2026-12-01',
  100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
  '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;
reset role;

-- 1º pagamento já fora da carência (40 dias atrás), 20% de 129,90
create temp table t_p1 as
select public.fn_afiliado_registrar_pagamento((select id from t_o1), '1001', 12990, now() - interval '40 days') as r;
select is((select r->>'comissaoCentavos' from t_p1), '2598', 'comissão = 20% do valor pago');
select is((select r->>'primeiraFatura' from t_p1), 'true', 'identifica a primeira fatura');
select is((select r->>'reverter' from t_p1), null, 'sem desconto reservado, nada a reverter');
select is(
  (select disponivel_em <= now() from private.afiliado_lancamentos where provedor_pagamento_id = '1001'),
  true, 'a carência de 30 dias já passou para um pagamento de 40 dias atrás');

select is((public.fn_afiliado_registrar_pagamento((select id from t_o1), '1001', 12990))->>'motivo', 'JA_REGISTRADO',
  'o mesmo pagamento não gera comissão duas vezes');
select is((select count(*) from private.afiliado_lancamentos where tipo = 'comissao' and indicado_id = '00000000-0000-0000-0000-0000000af010'), 1::bigint,
  'um único lançamento para o pagamento repetido');

-- 2º pagamento (vitalícia) agora: fica em carência; arredonda 33,33 * 20%
select is((public.fn_afiliado_registrar_pagamento((select id from t_o1), '1002', 3333))->>'comissaoCentavos', '667',
  'arredonda para o centavo mais próximo');
select is((select disponivel_em > now() + interval '29 days' from private.afiliado_lancamentos where provedor_pagamento_id = '1002'),
  true, 'pagamento novo entra em carência de 30 dias');

-- 1ª fatura apenas: só o primeiro pagamento rende
select is((public.fn_afiliado_registrar_pagamento((select id from t_o2), '2001', 10000))->>'comissaoCentavos', '1000',
  'link de 1ª fatura paga na primeira fatura');
select is((public.fn_afiliado_registrar_pagamento((select id from t_o2), '2002', 10000))->>'registrada', 'false',
  'link de 1ª fatura não paga a segunda');
select is((select count(*) from private.afiliado_lancamentos where indicado_id = '00000000-0000-0000-0000-0000000af014'),
  1::bigint, 'um único lançamento para o indicado de 1ª fatura');

select is((public.fn_afiliado_registrar_pagamento((select id from t_o3), '3001', 10000))->>'motivo', 'SEM_INDICACAO',
  'quem não foi indicado não gera comissão');
select is((public.fn_afiliado_registrar_pagamento(gen_random_uuid(), '4001', 10000))->>'motivo', 'OBRA_AUSENTE',
  'obra inexistente');
select throws_ok($$select public.fn_afiliado_registrar_pagamento(gen_random_uuid(), '4002', 0)$$,
  'P0001', 'PAGAMENTO_INVALIDO', 'valor inválido');

select throws_ok($$update private.afiliado_lancamentos set valor_centavos = 1$$,
  'P0001', 'IMUTAVEL', 'o ledger não aceita UPDATE');
select throws_ok($$delete from private.afiliado_lancamentos$$,
  'P0001', 'IMUTAVEL', 'o ledger não aceita DELETE');

-- ===== painel do afiliado =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af003", "role": "authenticated"}';
select is((public.fn_afiliado_painel())->>'afiliado', 'false', 'quem não é afiliado vê afiliado=false');
select is(public.fn_sou_afiliado(), false, 'fn_sou_afiliado falso para usuário comum');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
select is(public.fn_sou_afiliado(), true, 'fn_sou_afiliado verdadeiro para quem tem link');
select is((public.fn_afiliado_painel())->'saldo'->>'disponivelCentavos', '2598', 'saldo disponível');
select is((public.fn_afiliado_painel())->'saldo'->>'pendenteCentavos', '1667', 'saldo a liberar (667 + 1000)');
select is((select (l->>'cadastros') || '/' || (l->>'assinantes')
          from jsonb_array_elements((public.fn_afiliado_painel())->'links') l where l->>'codigo' = 'promo-joao'),
  '2/1', 'link: 2 cadastros (e-mail + callback) e 1 assinante');

-- ===== saque =====
select throws_ok($$select public.fn_afiliado_solicitar_saque('cpf', '123')$$, 'P0001', 'CHAVE_PIX_INVALIDA',
  'chave Pix inválida');
select throws_ok($$select public.fn_afiliado_solicitar_saque('outro', 'x@y.com')$$, 'P0001', 'CHAVE_PIX_INVALIDA',
  'tipo de chave inválido');
select throws_ok($$select public.fn_afiliado_solicitar_saque('email', 'afiliada@example.com')$$, 'P0001', 'SAQUE_MINIMO',
  'saldo abaixo do mínimo (R$ 50,00)');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select lives_ok($$select public.fn_admin_afiliado_config_salvar(30, 1000)$$, 'admin baixa o mínimo para R$ 10,00');
select throws_ok($$select public.fn_admin_afiliado_config_salvar(-1, 1000)$$, 'P0001', 'CONFIG_INVALIDA',
  'configuração inválida');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
create temp table t_s1 as select public.fn_afiliado_solicitar_saque('email', ' Afiliada@Example.com ') as r;
select is((select r->>'valorCentavos' from t_s1), '2598', 'o saque leva todo o saldo disponível');
select is((select chave_pix from private.afiliado_saques where id = (select (r->>'saqueId')::uuid from t_s1)),
  'afiliada@example.com', 'a chave é normalizada');
select is((public.fn_afiliado_painel())->'saldo'->>'disponivelCentavos', '0', 'o saldo fica reservado no pedido');
select throws_ok($$select public.fn_afiliado_solicitar_saque('email', 'afiliada@example.com')$$, 'P0001', 'SAQUE_EM_ABERTO',
  'só uma solicitação aberta por vez');
select isnt((public.fn_afiliado_painel())->'saques'->0->>'chaveMascarada', 'afiliada@example.com',
  'o painel mostra a chave mascarada');

-- ===== admin: pagar e recusar =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af003", "role": "authenticated"}';
select throws_ok(format($$select public.fn_admin_saque_pagar(%L::uuid, 'x')$$, (select r->>'saqueId' from t_s1)),
  'P0001', 'SEM_PERMISSAO', 'usuário comum não paga saque');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select is((select s->>'chavePix' from jsonb_array_elements(public.fn_admin_saques()) s where s->>'afiliadoId' = '00000000-0000-0000-0000-0000000af001' limit 1),
  'afiliada@example.com', 'o admin vê a chave Pix completa');
select is((public.fn_admin_saque_pagar((select (r->>'saqueId')::uuid from t_s1), 'PIX E2E123'))->>'alterada', 'true',
  'admin marca o saque como pago');
select is((public.fn_admin_saque_pagar((select (r->>'saqueId')::uuid from t_s1), 'PIX E2E123'))->>'alterada', 'false',
  'marcar pago duas vezes é idempotente');
select throws_ok(format($$select public.fn_admin_saque_recusar(%L::uuid, 'motivo')$$, (select r->>'saqueId' from t_s1)),
  'P0001', 'SAQUE_JA_RESOLVIDO', 'saque pago não pode ser recusado');
select throws_ok($$select public.fn_admin_saque_pagar(gen_random_uuid(), 'x')$$, 'P0001', 'SAQUE_NAO_ENCONTRADO',
  'saque inexistente');

-- novo pagamento já liberado, saque novo e recusa devolve o saldo
reset role;
select public.fn_afiliado_registrar_pagamento((select id from t_o1), '1003', 12990, now() - interval '40 days');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
create temp table t_s2 as select public.fn_afiliado_solicitar_saque('cpf', '529.982.247-25') as r;
select is((select chave_pix from private.afiliado_saques where id = (select (r->>'saqueId')::uuid from t_s2)),
  '52998224725', 'CPF é guardado só com dígitos');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select throws_ok(format($$select public.fn_admin_saque_recusar(%L::uuid, '  ')$$, (select r->>'saqueId' from t_s2)),
  'P0001', 'MOTIVO_OBRIGATORIO', 'recusar exige motivo');
select is((public.fn_admin_saque_recusar((select (r->>'saqueId')::uuid from t_s2), 'Chave não confere'))->>'alterada', 'true',
  'admin recusa o saque');
select is((public.fn_admin_saque_recusar((select (r->>'saqueId')::uuid from t_s2), 'Chave não confere'))->>'alterada', 'false',
  'recusar duas vezes é idempotente');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
select is((public.fn_afiliado_painel())->'saldo'->>'disponivelCentavos', '2598', 'a recusa devolve o saldo');
select is((public.fn_afiliado_painel())->'saldo'->>'recebidoCentavos', '2598', 'só o saque pago conta como recebido');

-- ===== estorno de comissão =====
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af002", "role": "authenticated"}';
select throws_ok(format($$select public.fn_admin_afiliado_estornar(%L::uuid, '')$$, (select id from private.afiliado_lancamentos where provedor_pagamento_id = '1002')),
  'P0001', 'MOTIVO_OBRIGATORIO', 'estorno exige motivo');
select throws_ok(format($$select public.fn_admin_afiliado_estornar(%L::uuid, 'x')$$, (select id from private.afiliado_lancamentos where tipo = 'saque' limit 1)),
  'P0001', 'LANCAMENTO_NAO_ENCONTRADO', 'só comissão pode ser estornada');
select is((public.fn_admin_afiliado_estornar((select id from private.afiliado_lancamentos where provedor_pagamento_id = '1002'), 'Reembolso no MP'))->>'alterada',
  'true', 'admin estorna uma comissão em carência');
select is((public.fn_admin_afiliado_estornar((select id from private.afiliado_lancamentos where provedor_pagamento_id = '1002'), 'Reembolso no MP'))->>'alterada',
  'false', 'estornar duas vezes é idempotente');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000af001", "role": "authenticated"}';
select is((public.fn_afiliado_painel())->'saldo'->>'pendenteCentavos', '1000',
  'o estorno tira a comissão do saldo a liberar');
select is((select c->>'status' from jsonb_array_elements((public.fn_afiliado_painel())->'comissoes') c
           where (c->>'valorCentavos') = '667'), 'estornada', 'o extrato marca a comissão como estornada');

select * from finish();
rollback;
