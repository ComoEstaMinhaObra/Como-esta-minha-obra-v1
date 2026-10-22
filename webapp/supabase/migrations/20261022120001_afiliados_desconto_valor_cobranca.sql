-- Programa de afiliados: valor exibido da cobrança depois da reversão do desconto de 1ª fatura.
--
-- Achado na validação em staging (22/10/2026): a cobrança é registrada com o valor cobrado na 1ª
-- fatura (com desconto) e, depois do 1º pagamento, o app devolve a assinatura ao preço cheio no
-- Mercado Pago. Nada atualizava `cobrancas_obra.valor_centavos`, então "Cobrança" e "Conta"
-- seguiam mostrando (e somando) o valor com desconto, embora as próximas faturas saíssem a preço
-- cheio. Agora marcar o desconto como revertido também devolve o valor da cobrança vigente da obra
-- ao preço cheio, na mesma transação e uma única vez (a marcação só acontece uma vez por indicação).

create or replace function public.fn_afiliado_desconto_revertido(p_obra uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desconto int;
begin
  update private.indicacoes i
  set desconto_revertido_em = pg_catalog.now()
  from public.obras o
  where o.id = p_obra
    and i.indicado_id = o.owner_id
    and i.desconto_obra_id = p_obra
    and i.desconto_revertido_em is null
  returning i.desconto_centavos into v_desconto;

  -- Só na transição (found): repetir a reversão não soma o desconto duas vezes.
  if found and v_desconto is not null then
    update public.cobrancas_obra c
    set valor_centavos = c.valor_centavos + v_desconto
    where c.obra_id = p_obra
      and c.status <> 'cancelada';
  end if;
end;
$$;

revoke all on function public.fn_afiliado_desconto_revertido(uuid) from public, anon, authenticated;
grant execute on function public.fn_afiliado_desconto_revertido(uuid) to service_role;
