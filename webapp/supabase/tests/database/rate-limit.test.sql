-- pgTAP: rate limit atômico e backfill de versão 1 em banco vazio

begin;
select plan(3);

select lives_ok(
  $$ select private.consumir_rate_limit('00000000-0000-0000-0000-000000000001'::uuid, 'convite', 2, interval '1 hour') $$,
  'primeiro consumo de rate limit passa'
);

select lives_ok(
  $$ select private.consumir_rate_limit('00000000-0000-0000-0000-000000000001'::uuid, 'convite', 2, interval '1 hour') $$,
  'segundo consumo de rate limit passa'
);

select throws_ok(
  $$ select private.consumir_rate_limit('00000000-0000-0000-0000-000000000001'::uuid, 'convite', 2, interval '1 hour') $$,
  'P0001',
  'RATE_LIMITED',
  'terceiro consumo estoura o limite'
);

select * from finish();
rollback;
