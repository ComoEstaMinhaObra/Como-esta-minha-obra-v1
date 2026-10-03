-- E5 do plano da tela de Cobrança (03/10/2026): painel de admin da cobrança por obra (decisões 2.1, 2.6).
-- Só adiciona: o MRR deixa de depender dos planos por faixa e passa a somar as cobranças por obra.

create or replace function public.fn_admin_cobranca()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  return pg_catalog.jsonb_build_object(
    -- cobranças que ainda serão cobradas (ativa e inadimplente); cancelamento agendado não entra
    'mrrCentavos', coalesce((
      select sum(c.valor_centavos)
      from public.cobrancas_obra c
      where c.status in ('ativa', 'inadimplente')
    ), 0),
    'porStatus', coalesce((
      select pg_catalog.jsonb_object_agg(t.status, t.n)
      from (
        select c.status::text as status, count(*) as n
        from public.cobrancas_obra c
        group by c.status
      ) t
    ), '{}'::jsonb),
    'inadimplentes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'obraNome', left(o.nome, 80),
          'responsavel', left(coalesce(p.nome, ''), 80),
          'desde', c.inadimplente_desde
        )
        order by c.inadimplente_desde
      )
      from public.cobrancas_obra c
      join public.obras o on o.id = c.obra_id
      join public.profiles p on p.id = c.user_id
      where c.status = 'inadimplente'
    ), '[]'::jsonb),
    -- cancelamento sem pedido do app: tentativas esgotadas ou cancelamento direto no painel
    'canceladasSemPedido30d', (
      select count(*)
      from public.webhooks_log w
      where w.erro = 'CANCELADA_SEM_PEDIDO'
        and w.recebido_em >= pg_catalog.now() - interval '30 days'
    ),
    'eventosComErro30d', (
      select count(*)
      from public.webhooks_log w
      where w.evento like 'subscription.%'
        and w.processado = false
        and w.erro is not null
        and w.recebido_em >= pg_catalog.now() - interval '30 days'
    )
  );
end;
$$;

revoke all on function public.fn_admin_cobranca() from public, anon;
grant execute on function public.fn_admin_cobranca() to authenticated;
