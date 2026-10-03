-- pgTAP: painel de admin da cobrança por obra (E5)

begin;
select plan(4);

select ok(has_function_privilege('authenticated', 'public.fn_admin_cobranca()', 'execute'),
  'authenticated executa fn_admin_cobranca (a função confere se é admin)');
select ok(not has_function_privilege('anon', 'public.fn_admin_cobranca()', 'execute'),
  'anon não executa fn_admin_cobranca');

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000f001', 'naoadmin@example.com', '{"nome": "Comum"}',
        '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000f001", "role": "authenticated"}';
select throws_ok(
  $$select public.fn_admin_cobranca()$$,
  'P0001', 'SEM_PERMISSAO',
  'usuário comum não lê o painel de cobrança'
);

-- como admin (linha em public.admins), a função devolve a estrutura esperada
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000f001');

select ok(
  (public.fn_admin_cobranca()) ?& array['mrrCentavos', 'porStatus', 'inadimplentes', 'canceladasSemPedido30d', 'eventosComErro30d'],
  'quando admin, o painel traz MRR, status, inadimplentes e alertas'
);

select * from finish();
rollback;
