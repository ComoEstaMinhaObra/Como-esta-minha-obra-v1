-- pgTAP: grants, RLS, helpers e invariantes de segurança

begin;
select plan(34);

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
  not has_function_privilege('authenticated', 'public.fn_finalizar_retificacao(uuid,text,text)', 'execute'),
  'authenticated não executa finalizar retificação'
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

select * from finish();
rollback;
