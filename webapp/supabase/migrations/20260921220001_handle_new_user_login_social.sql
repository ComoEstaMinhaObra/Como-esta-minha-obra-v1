-- Login social (Google/Microsoft): o nome vem de full_name/name (não de `nome`,
-- que só o cadastro por e-mail preenche) e o convite de proprietário só é
-- ativado quando o e-mail está confirmado. Cadastro por e-mail e senha segue
-- como antes: o usuário nasce sem confirmação e o convite é vinculado no insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'nome'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data->>'name'), ''),
      ''
    )
  );

  insert into public.assinaturas (user_id, status, plano, limite_obras, trial_fim)
  values (new.id, 'trial', 'trial', 1, pg_catalog.now() + interval '14 days');

  if new.email_confirmed_at is not null
     or coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then
    update public.obra_acessos
    set user_id = new.id,
        status = 'ativo'
    where lower(email::text) = lower(new.email)
      and user_id is null
      and status = 'convidado';
  end if;

  return new;
end;
$$;
