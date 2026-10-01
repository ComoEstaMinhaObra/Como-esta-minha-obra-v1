-- pgTAP: grants, RLS, helpers e invariantes de segurança

begin;
select plan(56);

select has_schema('private');

select ok(
  (select nspacl is not null from pg_namespace where nspname = 'private'),
  'schema private existe'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
  ),
  'nenhuma policy FOR ALL no schema public'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
      and c.relname not in ('schema_migrations')
  ),
  'RLS habilitada em tabelas public do produto'
);

select ok(
  (select relrowsecurity from pg_class where relname = 'relatorio_versoes' and relnamespace = 'public'::regnamespace),
  'RLS em relatorio_versoes'
);

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'is_admin'),
  'private.is_admin é SECURITY DEFINER'
);

select ok(
  (
    select prosecdef and array_to_string(proconfig, ',') like '%search_path=%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_criar_obra'
    limit 1
  ),
  'fn_criar_obra tem search_path seguro'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'private')
      and (
        proconfig is null
        or array_to_string(proconfig, ',') not like '%search_path=""%'
      )
  ),
  'todas as SECURITY DEFINER usam search_path vazio'
);

select ok(
  not has_table_privilege('anon', 'public.obras', 'select'),
  'anon sem SELECT em obras'
);

select ok(
  not has_table_privilege('anon', 'public.relatorios', 'insert'),
  'anon sem INSERT em relatorios'
);

select ok(
  not has_function_privilege(
    'anon',
    (
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'fn_criar_obra'
      limit 1
    ),
    'execute'
  ),
  'anon sem execute em fn_criar_obra'
);

select ok(
  not has_function_privilege('anon', 'public.fn_enviar_relatorio(uuid)', 'execute'),
  'anon sem execute na RPC legada de envio'
);

select ok(
  not has_function_privilege('authenticated', 'public.fn_enviar_relatorio(uuid)', 'execute'),
  'authenticated sem execute na RPC legada de envio'
);

select ok(
  not has_function_privilege('service_role', 'public.fn_enviar_relatorio(uuid)', 'execute'),
  'backend sem execute na RPC legada de envio'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated pode SELECT profiles'
);

select ok(
  not has_table_privilege('authenticated', 'public.obras', 'insert'),
  'authenticated sem INSERT direto em obras'
);

select ok(
  not has_table_privilege('authenticated', 'public.obras', 'update'),
  'authenticated sem UPDATE direto em obras'
);

select ok(
  not has_table_privilege('authenticated', 'public.obras', 'delete'),
  'authenticated sem DELETE direto em obras'
);

select ok(
  not has_table_privilege('authenticated', 'public.obra_acessos', 'insert'),
  'authenticated sem INSERT direto em obra_acessos'
);

select ok(
  not has_table_privilege('authenticated', 'public.relatorios', 'insert'),
  'authenticated sem INSERT direto em relatorios'
);

select ok(
  not has_table_privilege('authenticated', 'public.webhooks_log', 'select'),
  'authenticated sem SELECT em webhooks_log'
);

select ok(
  has_function_privilege('authenticated', 'public.fn_salvar_rascunho(uuid,uuid,jsonb)', 'execute'),
  'authenticated executa fn_salvar_rascunho'
);

select ok(
  not has_function_privilege('authenticated', 'public.fn_finalizar_envio_relatorio(uuid,text,text)', 'execute'),
  'authenticated não executa finalizar envio'
);

select ok(
  not exists (
    select 1 from pg_proc
    where proname in (
      'fn_preparar_retificacao', 'fn_finalizar_retificacao',
      'montar_snapshot_retificacao', 'aplicar_deltas_retificacao'
    )
  ),
  'funções de retificação foram removidas'
);

select ok(
  not has_function_privilege(
    'anon',
    (
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'fn_avanco_geral'
      limit 1
    ),
    'execute'
  ),
  'anon não executa fn_avanco_geral'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.etapas'::regclass
      and contype = 'u'
      and conname = 'etapas_id_obra_key'
  ),
  'unicidade composta etapas(id, obra_id)'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.relatorios'::regclass
      and conname = 'relatorios_id_obra_key'
  ),
  'unicidade composta relatorios(id, obra_id)'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.relatorio_versoes'::regclass
      and contype = 'u'
      and array_length(conkey, 1) = 3
  ),
  'unicidade composta relatorio_versoes(id, relatorio_id, obra_id)'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'webhooks_log_provedor_event_uidx'
  ),
  'índice único de webhook (provedor, event_id)'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_versoes_imutavel'
  ),
  'trigger de imutabilidade de versões'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_fotos_imutavel'
  ),
  'trigger de imutabilidade de fotos'
);

select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'rate_limits'
  ),
  'tabela privada de rate limit'
);

select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'billing_outbox'
  ),
  'outbox privada de billing'
);

select ok(
  not has_table_privilege('authenticated', 'private.billing_outbox', 'select'),
  'authenticated sem SELECT na outbox privada'
);

-- handle_new_user: nome do cadastro por e-mail e do login social
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values
  ('00000000-0000-0000-0000-00000000a001', 'social-nome@example.com',
   '{"full_name": "Maria Social"}', '{"provider": "google"}', now()),
  ('00000000-0000-0000-0000-00000000a002', 'email-nome@example.com',
   '{"nome": "João Email"}', '{"provider": "email"}', null),
  ('00000000-0000-0000-0000-00000000a003', 'azure-sem-nome@example.com',
   '{}', '{"provider": "azure"}', null);

select is(
  (select nome from public.profiles where id = '00000000-0000-0000-0000-00000000a001'),
  'Maria Social',
  'handle_new_user usa full_name do login social'
);

select is(
  (select nome from public.profiles where id = '00000000-0000-0000-0000-00000000a002'),
  'João Email',
  'handle_new_user continua usando nome do cadastro por e-mail'
);

select is(
  (select nome from public.profiles where id = '00000000-0000-0000-0000-00000000a003'),
  '',
  'handle_new_user cria perfil mesmo sem nome nem e-mail confirmado'
);


-- ===== financeiro da obra: contrato > 0, supressão, estornos e invariantes =====
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000b001', 'financeiro@example.com',
        '{"nome": "Financeiro"}', '{"provider": "email"}', now());

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated"}';

select throws_ok(
  $$select public.fn_criar_obra('Obra', 'Rua 1', 'Cliente', date '2026-01-01',
      date '2026-12-01', 0::bigint, 0::bigint, null, null, null, null, null, null,
      null, null, null, '[{"nome": "Estrutura", "peso": 100}]'::jsonb)$$,
  'P0001',
  'DADOS_INVALIDOS',
  'fn_criar_obra rejeita contrato zero'
);

create temp table t_obra as
select public.fn_criar_obra('Obra', 'Rua 1', 'Cliente', date '2026-01-01',
  date '2026-12-01', 100000::bigint, 60000::bigint, null, null, null, null, null,
  null, null, null, null, '[{"nome": "Estrutura", "peso": 100}]'::jsonb) as id;

select is(
  (select rotulo from public.lancamentos l, t_obra o
   where l.obra_id = o.id and l.tipo = 'sinal'),
  'Sinal',
  'lançamento do sinal usa o rótulo Sinal'
);

select ok(
  (select relatorio_id is null from public.lancamentos l, t_obra o
   where l.obra_id = o.id and l.tipo = 'sinal'),
  'sinal fica sem relatório até o primeiro envio'
);

select throws_ok(
  $$update public.obras set valor_contratado_centavos = 0 where id = (select id from t_obra)$$,
  '23514',
  null,
  'obras rejeita valor contratado zero'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
    values ((select id from t_obra), 'medicao', 'medicoes', 1, 'Medição 01', 0)$$,
  '23514',
  null,
  'lançamento com valor zero é bloqueado'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos)
    values ((select id from t_obra), 'estorno', 'medicoes', 'Estorno', -100)$$,
  '23514',
  null,
  'estorno sem lançamento de origem é bloqueado'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
    values ((select id from t_obra), 'supressao', 'supressoes', 1, 'Supressão 01 — a', 50000);
    set constraints trg_lancamentos_totais immediate$$,
  'P0001',
  'PAGO_ACIMA_CONTRATADO',
  'supressão que deixa o contratado abaixo do pago é bloqueada'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
    values ((select id from t_obra), 'supressao', 'supressoes', 1, 'Supressão 01 — a', 100000);
    set constraints trg_lancamentos_totais immediate$$,
  'P0001',
  'CONTRATADO_INVALIDO',
  'supressão que zera o contratado é bloqueada'
);

select lives_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
    values ((select id from t_obra), 'supressao', 'supressoes', 1, 'Supressão 01 — a', 20000);
    set constraints trg_lancamentos_totais immediate$$,
  'supressão dentro do contratado e do pago é aceita'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
    values ((select id from t_obra), 'supressao', 'supressoes', 1, 'Supressão 01 — b', 1000)$$,
  '23505',
  null,
  'numeração de supressão é única por obra'
);

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos, lancamento_origem_id)
    values ((select id from t_obra), 'estorno', 'medicoes', 'Estorno — x', -70000,
            (select id from public.lancamentos where obra_id = (select id from t_obra) and tipo = 'sinal'));
    set constraints trg_lancamentos_totais immediate$$,
  'P0001',
  'PAGO_NEGATIVO',
  'estorno que torna o pago negativo é bloqueado'
);

insert into public.lancamentos (obra_id, tipo, grupo, numero, rotulo, valor_centavos)
select id, 'medicao', 'medicoes', 1, 'Medição 01', 20000 from t_obra;

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos, lancamento_origem_id)
    values ((select id from t_obra), 'estorno', 'medicoes', 'Estorno — x', -60001,
            (select id from public.lancamentos where obra_id = (select id from t_obra) and tipo = 'sinal'));
    set constraints trg_lancamentos_totais immediate$$,
  'P0001',
  'ESTORNO_ACIMA_ORIGEM',
  'soma dos estornos não pode superar o valor da origem'
);

insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos, lancamento_origem_id)
select o.id, 'estorno', 'medicoes', 'Estorno — parcial', -10000, l.id
from t_obra o join public.lancamentos l on l.obra_id = o.id and l.tipo = 'sinal';

select throws_ok(
  $$insert into public.lancamentos (obra_id, tipo, grupo, rotulo, valor_centavos, lancamento_origem_id)
    values ((select id from t_obra), 'estorno', 'medicoes', 'Estorno — x', -100,
            (select id from public.lancamentos
             where obra_id = (select id from t_obra) and tipo = 'estorno' limit 1));
    set constraints trg_lancamentos_totais immediate$$,
  'P0001',
  'ESTORNO_ORIGEM_INVALIDA',
  'estorno de estorno é bloqueado'
);

select lives_ok(
  $$set constraints trg_lancamentos_totais immediate$$,
  'estado final das inserções válidas respeita as invariantes'
);

select is(
  (select saldo_centavos from public.fn_saldo_estornavel((select id from t_obra))
   where tipo = 'sinal'),
  50000::bigint,
  'fn_saldo_estornavel desconta o estorno parcial do sinal'
);

select is(
  (public.fn_proximos_rotulos((select id from t_obra)))->>'proximaSupressao',
  'Supressão 02',
  'fn_proximos_rotulos devolve a próxima supressão'
);

select is(
  (select contratado from private.totais_obra((select id from t_obra))),
  80000::bigint,
  'contratado vigente = contrato - supressões'
);

select is(
  (select pago from private.totais_obra((select id from t_obra))),
  70000::bigint,
  'pago líquido = sinal + medições - estornos'
);

select ok(
  not has_function_privilege('authenticated', 'private.totais_obra(uuid)', 'execute'),
  'authenticated não executa private.totais_obra'
);

select * from finish();
rollback;
