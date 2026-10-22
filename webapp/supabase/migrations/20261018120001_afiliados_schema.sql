-- Programa de afiliados (v1): esquema.
--
-- Links de divulgação com comissão (vitalícia ou só na 1ª fatura) e desconto opcional, indicações
-- (termos congelados no cadastro), ledger de comissões e solicitações de saque via Pix.
--
-- Tudo em `private`: dinheiro e chave Pix nunca ficam expostos ao PostgREST. O acesso é só por RPC
-- `security definer` (migrations seguintes). Valores em centavos; percentuais em basis points
-- (2000 = 20,00%). Texto + CHECK no lugar de enum, para evoluir sem migration de tipo.

-- ===== configuração (singleton) =====
create table private.afiliados_config (
  id boolean primary key default true check (id),
  carencia_dias int not null default 30 check (carencia_dias between 0 and 365),
  saque_minimo_centavos int not null default 5000 check (saque_minimo_centavos >= 0),
  atualizado_em timestamptz not null default now()
);
insert into private.afiliados_config default values;

-- ===== links =====
create table private.afiliado_links (
  id uuid primary key default gen_random_uuid(),
  afiliado_id uuid not null references public.profiles(id) on delete restrict,
  codigo text not null,
  rotulo text not null default '',
  comissao_bps int not null check (comissao_bps between 0 and 10000),
  comissao_vitalicia boolean not null,
  desconto_bps int not null default 0 check (desconto_bps between 0 and 9000),
  desconto_duracao text check (desconto_duracao in ('primeira_fatura', 'permanente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint afiliado_links_codigo_ck check (codigo ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  constraint afiliado_links_desconto_ck check (
    (desconto_bps = 0 and desconto_duracao is null)
    or (desconto_bps > 0 and desconto_duracao is not null)
  )
);
create unique index afiliado_links_codigo_uidx on private.afiliado_links (codigo);
create index afiliado_links_afiliado_idx on private.afiliado_links (afiliado_id);

-- ===== indicações =====
-- Um indicado tem no máximo uma indicação, para sempre. Os termos do link são copiados aqui no
-- cadastro: editar o link depois só vale para novos cadastros.
create table private.indicacoes (
  indicado_id uuid primary key references public.profiles(id) on delete cascade,
  link_id uuid not null references private.afiliado_links(id) on delete restrict,
  afiliado_id uuid not null references public.profiles(id) on delete restrict,
  comissao_bps int not null check (comissao_bps between 0 and 10000),
  comissao_vitalicia boolean not null,
  desconto_bps int not null default 0 check (desconto_bps between 0 and 9000),
  desconto_duracao text check (desconto_duracao in ('primeira_fatura', 'permanente')),
  origem text not null check (origem in ('cadastro', 'callback')),
  criado_em timestamptz not null default now(),
  primeiro_pagamento_id text,
  primeiro_pagamento_em timestamptz,
  -- desconto de 1ª fatura: reservado a uma obra e revertido ao preço cheio após o 1º pagamento dela
  desconto_obra_id uuid references public.obras(id) on delete set null,
  desconto_centavos int check (desconto_centavos is null or desconto_centavos > 0),
  desconto_revertido_em timestamptz,
  -- valor absoluto da assinatura ao voltar ao preço cheio, gravado antes da chamada ao provedor:
  -- repetir a reversão (retry do webhook) manda sempre o mesmo valor, sem somar duas vezes
  desconto_reversao_alvo_centavos int check (
    desconto_reversao_alvo_centavos is null or desconto_reversao_alvo_centavos > 0
  ),
  constraint indicacoes_autoindicacao_ck check (afiliado_id <> indicado_id)
);
create index indicacoes_link_idx on private.indicacoes (link_id);
create index indicacoes_afiliado_idx on private.indicacoes (afiliado_id);

-- ===== saques =====
create table private.afiliado_saques (
  id uuid primary key default gen_random_uuid(),
  afiliado_id uuid not null references public.profiles(id) on delete restrict,
  valor_centavos int not null check (valor_centavos > 0),
  tipo_chave text not null check (tipo_chave in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  chave_pix text not null check (char_length(chave_pix) between 3 and 140),
  status text not null default 'solicitado' check (status in ('solicitado', 'pago', 'recusado')),
  solicitado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  observacao text,
  constraint afiliado_saques_resolvido_ck check ((status = 'solicitado') = (resolvido_em is null))
);
-- uma solicitação aberta por afiliado
create unique index afiliado_saques_aberto_uidx on private.afiliado_saques (afiliado_id)
  where status = 'solicitado';
create index afiliado_saques_afiliado_idx on private.afiliado_saques (afiliado_id, solicitado_em desc);

-- ===== ledger =====
-- Append-only. Saldo = soma dos valores; "disponível" quando disponivel_em já passou.
-- indicado_id e criado_por são só informativos (sem FK): o registro financeiro não pode ser
-- alterado por uma exclusão de conta.
create table private.afiliado_lancamentos (
  id uuid primary key default gen_random_uuid(),
  afiliado_id uuid not null references public.profiles(id) on delete restrict,
  tipo text not null check (tipo in ('comissao', 'estorno', 'saque', 'saque_devolvido')),
  valor_centavos int not null,
  disponivel_em timestamptz not null,
  link_id uuid references private.afiliado_links(id) on delete restrict,
  indicado_id uuid,
  provedor_pagamento_id text,
  valor_base_centavos int,
  comissao_bps int,
  ref_lancamento_id uuid references private.afiliado_lancamentos(id) on delete restrict,
  saque_id uuid references private.afiliado_saques(id) on delete restrict,
  motivo text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  constraint afiliado_lancamentos_sinal_ck check (
    (tipo in ('comissao', 'saque_devolvido') and valor_centavos > 0)
    or (tipo in ('estorno', 'saque') and valor_centavos < 0)
  ),
  constraint afiliado_lancamentos_comissao_ck check (
    tipo <> 'comissao' or (provedor_pagamento_id is not null and link_id is not null)
  ),
  constraint afiliado_lancamentos_estorno_ck check (
    tipo <> 'estorno' or ref_lancamento_id is not null
  ),
  constraint afiliado_lancamentos_saque_ck check (
    tipo not in ('saque', 'saque_devolvido') or saque_id is not null
  )
);
-- idempotência por pagamento do provedor e no máximo um estorno por comissão
create unique index afiliado_lancamentos_pagamento_uidx
  on private.afiliado_lancamentos (provedor_pagamento_id) where tipo = 'comissao';
create unique index afiliado_lancamentos_estorno_uidx
  on private.afiliado_lancamentos (ref_lancamento_id) where tipo = 'estorno';
-- um saque reserva o saldo uma vez e devolve no máximo uma vez
create unique index afiliado_lancamentos_saque_uidx
  on private.afiliado_lancamentos (saque_id, tipo) where tipo in ('saque', 'saque_devolvido');
create index afiliado_lancamentos_afiliado_idx
  on private.afiliado_lancamentos (afiliado_id, disponivel_em);
create index afiliado_lancamentos_link_idx on private.afiliado_lancamentos (link_id);

-- ===== invariantes =====
create or replace function private.afiliado_lancamentos_imutavel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'IMUTAVEL';
end;
$$;

create trigger trg_afiliado_lancamentos_imutavel
  before update or delete on private.afiliado_lancamentos
  for each row execute function private.afiliado_lancamentos_imutavel();

-- Saque: só sai de "solicitado" uma vez; os dados do pedido nunca mudam.
create or replace function private.afiliado_saques_protege()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMUTAVEL';
  end if;
  if old.status <> 'solicitado' then
    raise exception 'IMUTAVEL';
  end if;
  if new.afiliado_id is distinct from old.afiliado_id
     or new.valor_centavos is distinct from old.valor_centavos
     or new.tipo_chave is distinct from old.tipo_chave
     or new.chave_pix is distinct from old.chave_pix
     or new.solicitado_em is distinct from old.solicitado_em then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create trigger trg_afiliado_saques_protege
  before update or delete on private.afiliado_saques
  for each row execute function private.afiliado_saques_protege();

-- Indicação: o vínculo (indicado, link, afiliado, termos) nunca muda depois de gravado; só os
-- controles de pagamento e desconto andam.
create or replace function private.indicacoes_protege()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.indicado_id is distinct from old.indicado_id
     or new.link_id is distinct from old.link_id
     or new.afiliado_id is distinct from old.afiliado_id
     or new.comissao_bps is distinct from old.comissao_bps
     or new.comissao_vitalicia is distinct from old.comissao_vitalicia
     or new.desconto_bps is distinct from old.desconto_bps
     or new.desconto_duracao is distinct from old.desconto_duracao
     or new.criado_em is distinct from old.criado_em then
    raise exception 'IMUTAVEL';
  end if;
  return new;
end;
$$;

create trigger trg_indicacoes_protege
  before update on private.indicacoes
  for each row execute function private.indicacoes_protege();

-- ===== acesso =====
alter table private.afiliados_config enable row level security;
alter table private.afiliado_links enable row level security;
alter table private.indicacoes enable row level security;
alter table private.afiliado_saques enable row level security;
alter table private.afiliado_lancamentos enable row level security;

revoke all on private.afiliados_config from public, anon, authenticated;
revoke all on private.afiliado_links from public, anon, authenticated;
revoke all on private.indicacoes from public, anon, authenticated;
revoke all on private.afiliado_saques from public, anon, authenticated;
revoke all on private.afiliado_lancamentos from public, anon, authenticated;

revoke all on function private.afiliado_lancamentos_imutavel() from public, anon, authenticated;
revoke all on function private.afiliado_saques_protege() from public, anon, authenticated;
revoke all on function private.indicacoes_protege() from public, anon, authenticated;
