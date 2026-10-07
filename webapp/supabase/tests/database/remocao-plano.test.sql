-- pgTAP: fim do modelo de planos por faixa (E5, 07/10/2026)

begin;
select plan(7);

select hasnt_column('public', 'assinaturas', 'plano', 'assinaturas não tem mais a coluna plano');
select hasnt_column('public', 'assinaturas', 'limite_obras', 'assinaturas não tem mais limite_obras');
select hasnt_type('public', 'plano_tipo', 'o enum plano_tipo foi removido');
select hasnt_function('private', 'assinatura_permite_escrita', array['uuid'],
  'private.assinatura_permite_escrita foi removida');

-- novo usuário nasce em trial de 14 dias
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000a901', 'novo-e5@example.com', '{"nome": "Novo"}', '{"provider": "email"}', now());

select is((select status::text from public.assinaturas where user_id = '00000000-0000-0000-0000-00000000a901'),
  'trial', 'novo usuário nasce em trial');
select ok((select trial_fim > now() + interval '13 days' from public.assinaturas where user_id = '00000000-0000-0000-0000-00000000a901'),
  'trial de 14 dias');

-- conta com status ativo (modelo antigo) e sem cobrança da obra não cria obra
update public.assinaturas set status = 'ativa' where user_id = '00000000-0000-0000-0000-00000000a901';
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a901", "role": "authenticated"}';
select throws_ok(
  $$select public.fn_criar_obra('Obra', 'Rua 1', 'Cliente', date '2026-01-01', date '2026-12-01',
      100000::bigint, 10000::bigint, null, null, null, null, null, null, null, null, null,
      '[{"nome": "Estrutura", "peso": 100}]'::jsonb)$$,
  'P0001', 'ASSINATURA_INATIVA',
  'status ativo do modelo antigo, sem cobrança por obra, não cria obra'
);

select * from finish();
rollback;
