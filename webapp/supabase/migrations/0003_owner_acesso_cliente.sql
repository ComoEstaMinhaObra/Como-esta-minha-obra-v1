create or replace function public.tem_acesso_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from obras o
    where o.id = p_obra and o.owner_id = auth.uid()
  ) or exists (
    select 1 from obra_acessos a
    where a.obra_id = p_obra and a.user_id = auth.uid() and a.status = 'ativo'
  )
$$;

grant execute on function public.tem_acesso_obra to authenticated;
