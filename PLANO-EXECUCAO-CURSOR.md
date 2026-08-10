# PLANO DE EXECUÇÃO — Como Está Minha Obra

**v1.0 · 10/08/2026 · Plano operacional para agente de IA (Cursor)**
Autoria: Tech Lead (Estevão). Documento de requisitos: [BRIEFING.md](BRIEFING.md) (prevalece em conflito de regra de negócio). Spec visual de referência: [Context/explicacao-do-prototype.md](Context/explicacao-do-prototype.md) + protótipos em `design-system/`.

---

## 0. Regras para o agente (leia antes de qualquer tarefa)

1. **Execute as tarefas na ordem** (S0.1 → S5.6). Não pule, não reordene, não misture tarefas.
2. **Uma tarefa por vez.** Ao concluir: rodar `npm run typecheck && npm run lint && npm run test` (a partir de S0.9), marcar a tarefa em `PROGRESS.md` e commitar com a mensagem `SX.Y: <resumo>`.
3. **Não invente.** Se uma informação não está neste plano, no BRIEFING.md ou na documentação oficial linkada (Next.js, Supabase, AbacatePay em docs.abacatepay.com, Resend, Open-Meteo), **pare e registre a dúvida em `PROGRESS.md` na seção "Bloqueios"** em vez de supor. Nunca invente campos de API, endpoints, nomes de eventos de webhook ou variáveis de ambiente que não constem na seção 2.2.
4. **Não modifique** os diretórios `Context/` e `design-system/` nem os arquivos `BRIEFING.md`, `ANALISE-TECH-LEAD.md` e este plano (exceto `PROGRESS.md`).
5. **Nunca** escreva segredos em arquivo versionado. Segredos só em `.env.local` (gitignorado). O `.env.example` só tem placeholders.
6. **Não adicione dependências** fora da lista da seção 2.7 sem registrar justificativa em `PROGRESS.md`.
7. **Fora do escopo v1 (não implementar):** vídeo em relatórios, retificação formal de relatório, CMS de blog, login com senha/Google/Microsoft, apps móveis, i18n (produto é 100% pt-BR), dark mode.
8. Textos de UI em **português do Brasil**, seguindo o tom das copies do protótipo. Código (variáveis, funções, tabelas) em **português sem acentos** (ex.: `valorContratadoCentavos`, `obra_acessos`) — consistente com o domínio.
9. Se algo falhar 2 vezes seguidas (build, teste, API), pare, documente o erro real em `PROGRESS.md` e siga para a próxima tarefa **somente se ela não depender da travada**.
10. Datas/fusos: toda lógica de "dias corridos/restantes" usa o fuso **America/Bahia** via `date-fns-tz`. Dinheiro: **sempre inteiro em centavos** (`bigint` no banco, `number` no TS). Nunca usar float para dinheiro.

---

## 1. Pré-requisitos humanos (Estevão — o agente NÃO faz e NÃO simula)

- [ ] Renomear a pasta raiz para `como-esta-minha-obra` (remove o "?").
- [ ] Rotacionar a API key do AbacatePay no dashboard e colocar a nova em `webapp/.env.local`; remover credenciais do `Readme.md`.
- [ ] Conta Resend criada + domínio `comoestaminhaobra.com.br` verificado (DKIM/SPF).
- [ ] Projeto Supabase existente (`hxlrskcnsbmmotjmxxfd`) — obter a secret key (service role) e a connection string com senha para `supabase db push`.
- [ ] Projeto Vercel criado e conectado ao repositório GitHub; secrets configurados (lista na seção 2.2).
- [ ] SMTP customizado no Supabase Auth apontando para o Resend (S5.5).
- [ ] Registrar o webhook no dashboard AbacatePay apontando para a URL de produção (S5.5).

Quando um item acima faltar, o agente implementa o código normalmente e registra em `PROGRESS.md` o que não pôde ser verificado ao vivo.

---

## 2. Constantes do projeto (imutáveis — nunca "melhorar" sem autorização)

### 2.1 Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router, RSC), React 19, TypeScript `strict: true` |
| Estilo | Tailwind CSS v4 (tokens na seção 2.5) |
| Backend | Supabase: Auth (magic link), Postgres com RLS, Storage privado |
| Pagamentos | AbacatePay (cartão; assinaturas) — seção 5.4 |
| E-mail | Resend + @react-email/components |
| PDF | @react-pdf/renderer (gerado no envio do relatório) |
| Clima | Open-Meteo (sem chave) atrás de interface `WeatherProvider` (seção 5.3) |
| Deploy | Vercel (app + crons) |
| Testes | Vitest (unidade) + Playwright (e2e) |

### 2.2 Variáveis de ambiente — conteúdo EXATO do `webapp/.env.example`

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=xxx            # service role — NUNCA exposta ao cliente

# Preços (centavos) — fonte única de precificação (BRIEFING §3)
NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS=12990
NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS=31990
NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS=49990
NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS=2990

# Trial (BRIEFING §3)
NEXT_PUBLIC_TRIAL_DIAS=14
NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS=1

# AbacatePay
ABACATEPAY_API_KEY=abc_dev_xxx
ABACATEPAY_WEBHOOK_SECRET=xxx
ABACATEPAY_PROD_OBRA_1=prod_xxx      # preenchidos pelo script S4.2
ABACATEPAY_PROD_OBRA_3=prod_xxx
ABACATEPAY_PROD_OBRA_5=prod_xxx
ABACATEPAY_PROD_EMAIL_EXTRA=prod_xxx

# E-mail
RESEND_API_KEY=re_xxx
EMAIL_FROM="Como Está Minha Obra <relatorios@comoestaminhaobra.com.br>"

# Cron
CRON_SECRET=xxx
```

Regra: **todo** acesso a env passa por `src/config/env.ts` (zod, seção 5.1). Proibido `process.env` espalhado pelo código.

### 2.3 Planos e limites (BRIEFING §3)

| Plano (id interno) | Preço (env) | `limite_obras` | externalId AbacatePay |
|---|---|---|---|
| `trial` | grátis, 14 dias | 1 (e 1 envio de relatório no total) | — (trial é do app, sem cartão) |
| `obra_1` | PRECO_1_OBRA | 1 | `plano-1-obra-v1` |
| `obra_3` | PRECO_3_OBRAS | 3 | `plano-3-obras-v1` |
| `obra_5` | PRECO_5_OBRAS | 5 | `plano-5-obras-v1` |
| add-on e-mail extra | PRECO_EMAIL_EXTRA | por obra: 1º e-mail grátis, demais cobrados | `email-extra-v1` (produto avulso, `cycle: null`) |

Obra **arquivada não conta** no limite. Excluir/arquivar libera vaga imediatamente e revoga acesso do proprietário imediatamente.

### 2.4 Listas canônicas

**23 etapas padrão** (ordem e grafia EXATAS — BRIEFING §5.15):
Montagem do canteiro de obras · Demolições · Terraplanagem · Fundações · Estrutura · Alvenarias · Cobertura · Instalações elétricas e rede · Instalações hidrossanitárias · Instalações de ar condicionado · Rebocos e contrapisos · Impermeabilizações · Revestimentos de piso · Revestimentos de parede · Revestimentos de teto · Fachadas · Esquadrias (janelas) · Esquadrias (portas) · Acabamentos de granito · Acabamentos elétricos e luminárias · Louças e metais sanitários · Pintura · Limpeza final de obra

**Motivos de dias aditivados** (enum `motivo_aditivo`, BRIEFING §5.8):

| valor no banco | rótulo na UI |
|---|---|
| `chuvas` | Chuvas acima da média |
| `aditivo_escopo` | Aditivo de escopo |
| `atraso_materiais` | Atraso no fornecimento de materiais |
| `licencas` | Licenças e aprovações de órgãos públicos |
| `interferencias` | Interferências imprevistas |
| `forca_maior` | Caso fortuito ou força maior |
| `outro` | Outro (exige campo descrição) |

### 2.5 Design tokens — conteúdo do bloco `@theme` em `src/app/globals.css`

```css
@theme {
  --color-fundo: #FAFAF9;
  --color-tinta: #141414;
  --color-cinza-2: #8A8A85;   /* texto secundário */
  --color-cinza-3: #B5B5B0;   /* texto terciário  */
  --color-borda: #E4E4E0;
  --color-divisor: #ECECE9;
  --color-marca: #F25C1F;
  --color-marca-hover: #D94F16;
  --color-marca-clara: #FFB38A;
  --color-escuro-1: #1A1A1A;
  --color-escuro-2: #2E2B28;
  --color-escuro-3: #4A3327;
  --color-sucesso: #4C8055;
  --font-sans: var(--font-space-grotesk);
  --font-serif: var(--font-source-serif);
}
```

Utilitários de gradiente (CSS global): `.bg-cartao { background: linear-gradient(160deg,#FFFFFF,#F6F4F1); }` e `.bg-escuro { background: linear-gradient(135deg,#1A1A1A,#2E2B28 70%,#4A3327); }`.

Regras visuais (do protótipo — replicar, não reinterpretar): botões em pill (`rounded-full`; primário `bg-marca` texto branco, secundário contornado `border-borda`, terciário `bg-tinta`); cartões `rounded-[20px] border border-borda .bg-cartao`; barras de progresso 2–3px (âmbar parcial, preta em 100%); rótulos de seção em caixa alta `tracking-[0.18em] text-[10px] text-cinza-2`; títulos em serif 300/400; toast escuro flutuante centralizado no rodapé com auto-dismiss 2,8 s; ícones stroke 1.3–1.5 sem fill; breakpoint desktop ≥ 800px (`min-[800px]:`); fontes via `next/font/google` (`Space_Grotesk` 300/400/500, `Source_Serif_4` 300/400/500 + itálico) — **proibido** `<link>` para fonts.googleapis.com.

**Marca:** "Como Está Minha Obra" em toda a UI. **Proibido** usar "Demobra" (marca provisória do protótipo). Logo: quadrado âmbar com triângulo branco (placeholder, como no protótipo).

### 2.6 Convenções

- Commits: `SX.Y: descrição` (ex.: `S2.8: RPC enviar_relatorio + testes`).
- Componentes de UI compartilhados em `src/components/ui/`; componentes de feature junto da rota.
- Server Actions para mutações do app; Route Handlers apenas para webhook, cron e PDF.
- Todo acesso a dados do lado empreiteiro/proprietário usa o client **anon + sessão do usuário** (RLS decide). A secret key só é usada em: webhook AbacatePay, cron de clima, script de bootstrap e admin.
- Formatação: `formatarBRL(centavos)` → `R$ 1.033.000,00`; `formatarBRLCompacto(centavos)` → `< R$ 1.000` inteiro normal; `>= R$ 1.000` → `R$ 473 mil`; `>= R$ 1 mi` → `R$ 1,03 mi` (regra do protótipo).

### 2.7 Dependências permitidas (`webapp/package.json`)

Runtime: `next@15`, `react@19`, `react-dom@19`, `@supabase/supabase-js@2`, `@supabase/ssr`, `zod`, `resend`, `@react-email/components`, `@react-pdf/renderer`, `date-fns`, `date-fns-tz`, `browser-image-compression`, `gray-matter`, `next-mdx-remote`.
Dev: `typescript`, `tailwindcss@4`, `@tailwindcss/postcss`, `eslint` + `eslint-config-next`, `prettier`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`, `@playwright/test`, `supabase` (CLI local), `tsx`.
Usar a última versão estável dentro do major indicado. Nada além disso sem registrar em `PROGRESS.md`.

---

## 3. Mapa de rotas (completo — criar exatamente estas)

```
webapp/src/app/
├── (marketing)/
│   ├── page.tsx                       # Landing (S4.7)
│   ├── precos/page.tsx                # Preços (S4.7)
│   ├── blog/page.tsx                  # Lista de posts (S5.2)
│   ├── blog/[slug]/page.tsx           # Post MDX (S5.2)
│   ├── politica-de-privacidade/page.tsx  (S4.8)
│   └── termos/page.tsx                   (S4.8)
├── (auth)/
│   ├── entrar/page.tsx                # magic link (S1.1)
│   └── auth/callback/route.ts         # exchangeCodeForSession (S1.1)
├── (app)/            # empreiteiro — protegido (sessão + não-proprietário-puro)
│   ├── obras/page.tsx                 # dashboard (S1.3)
│   ├── obras/nova/page.tsx            # ficha (S1.4)
│   ├── obras/[obraId]/page.tsx        # detalhe + feed + modais relatório/compartilhar (S1.5, S2.*)
│   ├── planos/page.tsx                # planos + checkout + change-plan (S4.3, S4.6)
│   └── conta/page.tsx                 # dados, assinatura, sair (S1.6)
├── (cliente)/        # proprietário — protegido (obra_acessos)
│   └── c/[obraId]/
│       ├── page.tsx                   # Início (S3.2)
│       ├── informacoes/page.tsx       # acordeões (S3.3)
│       ├── galeria/page.tsx           # (S3.4)
│       ├── linha-do-tempo/page.tsx    # (S3.5)
│       └── perfil/page.tsx            # (S3.6)
├── (admin)/admin/
│   ├── page.tsx                       # KPIs (S5.1)
│   ├── contas/page.tsx                # (S5.1)
│   └── webhooks/page.tsx              # (S5.1)
├── api/
│   ├── webhooks/abacatepay/route.ts   # (S4.4)
│   ├── cron/clima/route.ts            # (S3.7)
│   └── relatorios/[relatorioId]/pdf/route.ts  # signed URL (S2.9)
├── sitemap.ts · robots.ts             # (S5.2)
└── globals.css · layout.tsx
```

Redirecionamento pós-login (S1.1): se o usuário tem `obra_acessos` ativo e **não** possui obras próprias → `/c/{obraId mais recente}`; caso contrário → `/obras`.

---

## 4. Banco de dados — migration `0001_schema.sql` (SQL de referência; aplicar via Supabase CLI)

O agente cria `webapp/supabase/migrations/0001_schema.sql` com o conteúdo abaixo (ajustes de sintaxe permitidos, semântica não):

```sql
create extension if not exists citext;

-- ===== enums =====
create type plano_tipo as enum ('trial','obra_1','obra_3','obra_5');
create type assinatura_status as enum ('trial','ativa','inadimplente','cancelada');
create type relatorio_status as enum ('rascunho','enviado');
create type lancamento_tipo as enum ('sinal','medicao','material','aditivo','estorno');
create type lancamento_grupo as enum ('medicoes','materiais','aditivos');
create type acesso_status as enum ('convidado','ativo');
create type motivo_aditivo as enum ('chuvas','aditivo_escopo','atraso_materiais','licencas','interferencias','forca_maior','outro');
create type clima_condicao as enum ('aberto','nublado','chuvoso');

-- ===== tabelas =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status assinatura_status not null default 'trial',
  plano plano_tipo not null default 'trial',
  limite_obras int not null default 1,
  trial_fim timestamptz,
  relatorios_enviados_trial int not null default 0,
  abacatepay_customer_id text,
  abacatepay_subscription_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  nome text not null,
  endereco text not null,
  lat double precision, lng double precision,
  cliente_nome text not null,
  construtora text, engenheiro text,
  escritorio_arquitetura text, arquiteto text,
  projetista_estruturas text, projetista_instalacoes text,
  foto_capa_path text,
  inicio_contratual date not null,
  termino_contratual date not null,
  valor_contratado_centavos bigint not null check (valor_contratado_centavos >= 0),
  sinal_centavos bigint not null default 0 check (sinal_centavos >= 0),
  arquivada_em timestamptz,          -- null = ativa; preenchida = arquivada (libera vaga)
  criado_em timestamptz not null default now()
);
create index on public.obras (owner_id) where arquivada_em is null;

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null,
  ordem int not null,
  peso numeric not null default 1 check (peso > 0),
  pct_atual int not null default 0 check (pct_atual between 0 and 100),
  unique (obra_id, ordem)
);

create table public.obra_acessos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  email citext not null,
  user_id uuid references public.profiles(id),
  status acesso_status not null default 'convidado',
  cobrado_extra boolean not null default false,  -- 1º acesso da obra = false; demais = true
  criado_em timestamptz not null default now(),
  unique (obra_id, email)
);

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  numero int not null,
  status relatorio_status not null default 'rascunho',
  dados_rascunho jsonb,          -- estado do formulário (só existe enquanto rascunho)
  snapshot jsonb,                -- imutável, preenchido no envio (contrato na seção 5.2)
  pdf_path text,
  geral_antes int, geral_depois int,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  unique (obra_id, numero)
);

-- linhas normalizadas: criadas SOMENTE no envio (rascunho vive só em dados_rascunho)
create table public.relatorio_etapas (
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  pct int not null check (pct between 0 and 100),
  primary key (relatorio_id, etapa_id)
);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid references public.relatorios(id),
  tipo lancamento_tipo not null,
  grupo lancamento_grupo not null,
  numero int,                       -- medicao/aditivo: sequência automática por obra
  rotulo text not null,             -- "Medição 04" | "Aditivo 03 — muro" | livre | "Sinal contratual" | "Estorno — x"
  valor_centavos bigint not null,   -- negativo APENAS quando tipo='estorno'
  criado_em timestamptz not null default now(),
  check (tipo = 'estorno' or valor_centavos >= 0)
);
create index on public.lancamentos (obra_id);

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  nota text not null default ''
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  etapa_id uuid not null references public.etapas(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete cascade,
  storage_path text not null,
  ordem int not null default 0
);

create table public.dias_aditivados (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  relatorio_id uuid not null references public.relatorios(id) on delete cascade,
  motivo motivo_aditivo not null,
  descricao text,                   -- obrigatória quando motivo='outro' (validar na app)
  dias int not null check (dias > 0)
);

create table public.clima_snapshots (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null,
  condicao clima_condicao not null,
  prob_chuva int check (prob_chuva between 0 and 100),
  fonte text not null default 'open-meteo',
  unique (obra_id, data)
);

create table public.assinatura_usos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas(id) on delete cascade,
  obra_acesso_id uuid references public.obra_acessos(id) on delete set null,
  action text not null check (action in ('add','subtract')),
  units int not null,
  abacatepay_usage_id text,
  installment_number int,
  criado_em timestamptz not null default now()
);

create table public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'abacatepay',
  evento text not null,
  payload jsonb not null,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

-- ===== funções =====
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- avanço geral ponderado (BRIEFING §5.1): round(Σ(peso*pct)/Σ(peso))
create or replace function public.fn_avanco_geral(p_obra uuid) returns int
language sql stable as $$
  select coalesce(round(sum(peso * pct_atual) / nullif(sum(peso), 0))::int, 0)
  from etapas where obra_id = p_obra
$$;

-- novo usuário: profile + assinatura trial (14 dias via app config; grava fim aqui com 14d)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  insert into assinaturas (user_id, status, plano, limite_obras, trial_fim)
    values (new.id, 'trial', 'trial', 1, now() + interval '14 days');
  update obra_acessos set user_id = new.id, status = 'ativo'
    where email = new.email::citext and user_id is null;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- monotonicidade defensiva no estado corrente (BRIEFING §5.2)
create or replace function public.check_pct_monotonico() returns trigger
language plpgsql as $$
begin
  if new.pct_atual < old.pct_atual then
    raise exception 'pct_atual nao pode regredir (etapa %)', old.id;
  end if;
  return new;
end $$;
create trigger trg_etapas_monotonico before update of pct_atual on public.etapas
  for each row execute function public.check_pct_monotonico();
```

**RLS (mesma migration).** Habilitar RLS em TODAS as tabelas públicas. Políticas (padrão — replicar para cada tabela-filha via join com `obras`):

```sql
alter table public.obras enable row level security;

create policy obras_owner_all on public.obras
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy obras_proprietario_select on public.obras
  for select using (exists (
    select 1 from obra_acessos a
    where a.obra_id = obras.id and a.user_id = auth.uid() and a.status = 'ativo'
  ) and arquivada_em is null);

create policy obras_admin_select on public.obras for select using (is_admin());
```

Regras específicas obrigatórias:
- `relatorios`: proprietário só enxerga `status = 'enviado'` (**rascunho jamais vaza**); dono enxerga tudo da própria obra; `dados_rascunho` nunca é exposto a proprietário (garantido pela policy de status).
- `etapas`, `lancamentos`, `atividades`, `fotos`, `dias_aditivados`, `clima_snapshots`, `relatorio_etapas`: dono = CRUD via posse da obra; proprietário = `select` via acesso ativo (e, quando ligada a relatório, só de relatório enviado — como essas linhas só nascem no envio, o join com `relatorios.status='enviado'` é redundância defensiva: incluir mesmo assim).
- `assinaturas`, `assinatura_usos`: `select` apenas do próprio usuário; escrita somente via service role (webhooks/actions server-side com secret key).
- `profiles`: usuário lê/edita o próprio; admin lê todos.
- `obra_acessos`: dono da obra = CRUD; o convidado lê a própria linha.
- `webhooks_log`, `admins`: apenas `is_admin()` (leitura); escrita via service role.

**Storage (S0.6):** buckets privados `capas`, `fotos`, `pdfs`. Policies: upload/leitura pelo dono da obra (prefixo do path = `obraId/`); leitura por proprietário com acesso ativo; nada público. Paths: `capas/{obraId}/capa.webp` · `fotos/{obraId}/{relatorioId}/{etapaId}/{uuid}.webp` · `pdfs/{obraId}/relatorio-{numero}.pdf`.

**RPCs (migration `0002_rpcs.sql`)** — assinatura e contrato de comportamento (implementar exatamente estes passos, em plpgsql, `security definer`):

`fn_enviar_relatorio(p_relatorio uuid) returns jsonb` — coração do produto (BRIEFING §5.6):
1. Trava a obra (`select ... for update` na linha de `obras` via relatório). Valida: relatório existe, pertence a obra do `auth.uid()`, `status='rascunho'`.
2. **Gating**: assinatura do dono com `status in ('trial','ativa')`; se `trial`: `now() <= trial_fim` **e** `relatorios_enviados_trial < 1`, senão `raise exception 'TRIAL_EXPIRADO'` / `'TRIAL_LIMITE'`. Se `inadimplente/cancelada`: `raise exception 'ASSINATURA_INATIVA'`.
3. Lê `dados_rascunho` (shape da seção 5.2). Para cada etapa: valida `pct >= etapas.pct_atual` (senão `raise exception 'PCT_REGREDIU'`) e `0..100`.
4. Numera medições novas: `numero = (max(numero) de lancamentos tipo 'medicao' da obra, ou 0) + posição na lista (1-based)`; rótulo `'Medição ' || lpad(numero::text, 2, '0')`. Aditivos: idem com tipo `aditivo` e rótulo `'Aditivo NN — ' || descricao`. Materiais: rótulo livre. Estornos: rótulo `'Estorno — ' || descricao`, valor negativo, grupo informado no rascunho. (O sinal NÃO entra aqui — é lançado 1× na criação da obra, S1.4.)
5. Insere `relatorio_etapas`, `lancamentos`, `atividades`, `fotos` (as fotos já estão no Storage; aqui viram linhas), `dias_aditivados`.
6. Atualiza `etapas.pct_atual` com os novos pcts.
7. Monta e grava `snapshot` (seção 5.2) com agregados calculados AGORA, `geral_antes`/`geral_depois` (via `fn_avanco_geral` antes/depois), `status='enviado'`, `enviado_em=now()`, `dados_rascunho=null`. Se trial, incrementa `relatorios_enviados_trial`.
8. Retorna o snapshot. (PDF e e-mail são feitos pela server action após o RPC — S2.9/S2.10; falha neles não desfaz o envio, e o PDF tem retry.)

`fn_criar_obra(...) returns uuid`: valida limite (`count(obras ativas) < assinaturas.limite_obras`, senão `raise exception 'LIMITE_OBRAS'`), cria obra + 23 etapas default (ordem 1..23, peso 1) ou etapas customizadas recebidas, lança o sinal como lançamento `tipo='sinal', grupo='medicoes', rotulo='Sinal contratual'` quando `sinal_centavos > 0`.

`fn_proximos_rotulos(p_obra uuid) returns jsonb`: retorna `{ "proximaMedicao": "Medição 04", "proximoAditivo": "Aditivo 03" }` considerando apenas lançamentos persistidos (a UI soma os pendentes do rascunho localmente — regra do protótipo: `max existente + novos no rascunho + 1`).

Após migrations: `supabase gen types typescript --linked > src/lib/database.types.ts` (regenerar a cada migration).

---

## 5. Contratos centrais (criar exatamente assim)

### 5.1 `src/config/env.ts` e `src/config/pricing.ts`

`env.ts`: schema zod parseando TODAS as variáveis da seção 2.2 (server e public separados); falha de parse = erro de build com mensagem clara. `pricing.ts`: exporta `PLANOS` (id, nome de exibição, precoCentavos vindo do env, limiteObras, externalId) e `EMAIL_EXTRA` — **única** fonte para landing, tela de planos e billing (BRIEFING §5.11 — nada de preço hardcoded em JSX).

### 5.2 Shapes JSON — `src/lib/relatorios/tipos.ts`

```ts
// dados_rascunho (estado do formulário; salvo a cada "Salvar rascunho")
export interface RelatorioRascunho {
  versao: 1;
  etapas: { etapaId: string; pct: number }[];                 // todas as etapas da obra
  financeiro: {
    medicoes: { valorCentavos: number }[];                    // rótulo é automático
    materiais: { rotulo: string; valorCentavos: number }[];
    aditivos: { descricao: string; valorCentavos: number }[];
    estornos: { grupo: 'medicoes'|'materiais'|'aditivos'; descricao: string; valorCentavos: number }[]; // valor positivo aqui; RPC grava negativo
  };
  atividades: { etapaId: string; nota: string; fotosPaths: string[] }[]; // max 12 paths cada
  prazo: { motivo: MotivoAditivo; descricao?: string; dias: number }[];
}

// snapshot (imutável, gravado pelo RPC no envio; PDF e telas históricas leem SÓ daqui)
export interface RelatorioSnapshot {
  versao: 1;
  numero: number;
  enviadoEm: string; // ISO
  obra: { nome: string; endereco: string; clienteNome: string; construtora?: string; engenheiro?: string;
          escritorioArquitetura?: string; arquiteto?: string; projetistaEstruturas?: string; projetistaInstalacoes?: string;
          inicioContratual: string; terminoContratual: string };
  avancoFisico: { geralAntes: number; geralDepois: number;
    etapas: { nome: string; peso: number; pctAnterior: number; pctNovo: number }[] };
  financeiro: {
    valorContratadoCentavos: number; aditivosAcumuladoCentavos: number; contratadoTotalCentavos: number;
    pagoAcumuladoCentavos: number; pctPago: number; saldoCentavos: number;
    lancamentosNovos: { tipo: string; grupo: string; rotulo: string; valorCentavos: number }[] };
  prazo: { novosDias: { motivo: string; descricao?: string; dias: number }[];
    totalDiasAditivados: number; novaDataTermino: string };
  atividades: { etapaNome: string; nota: string; fotosPaths: string[] }[];
  clima: { dias: { data: string; condicao: 'aberto'|'nublado'|'chuvoso'; probChuva: number|null }[] };
}
```

### 5.3 Clima — `src/lib/clima/`

Interface `WeatherProvider { buscarDias(lat: number, lng: number): Promise<DiaClima[]> }` com implementação `openMeteoProvider`:
- URL exata: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&daily=weather_code,precipitation_probability_max,precipitation_sum&past_days=7&forecast_days=1&timezone=America%2FBahia`
- Mapeamento WMO `weather_code` → `condicao`: `0–1 → aberto`; `2, 3, 45, 48 → nublado`; `>= 51 → chuvoso`. `prob_chuva` = `precipitation_probability_max` (quando `null` em dia passado: `precipitation_sum > 1.0mm → 80`, senão `10`).
- Geocodificação (1× na criação da obra, server action): `https://nominatim.openstreetmap.org/search?q={endereco urlencoded}&format=json&limit=1` com header `User-Agent: ComoEstaMinhaObra/1.0 (contato@comoestaminhaobra.com.br)`. Sem resultado → obra salva com lat/lng null e aviso na UI ("clima indisponível para este endereço"); nunca bloquear a criação.

### 5.4 AbacatePay — `src/lib/abacatepay.ts` (client tipado; server-only)

Base: `https://api.abacatepay.com/v2` · Auth: `Authorization: Bearer {ABACATEPAY_API_KEY}` · Docs: docs.abacatepay.com. Funções (somente estas; campos conforme docs — **não inventar campos**):

| Função | Endpoint | Uso |
|---|---|---|
| `criarProduto` | `POST /products/create` (`externalId`, `name`, `price` centavos, `currency:'BRL'`, `cycle:'MONTHLY'` ou omitido p/ avulso) | bootstrap S4.2 |
| `criarCliente` | `POST /client/create` | antes do 1º checkout |
| `criarAssinatura` | `POST /subscriptions/create` (`items:[{id, quantity:1}]`, `customerId`, `externalId` = id da nossa assinatura, `methods:['CARD']`, `returnUrl`, `completionUrl`) → retorna `data.url` (checkout) | S4.3 |
| `trocarPlano` | `POST /subscriptions/change-plan` (`id`, `productId`, `quantity:1`) — aplica no PRÓXIMO ciclo, sem pró-rata | S4.6 |
| `registrarUso` | `POST /subscriptions/record-usage` (`id`, `productId` avulso, `units`, `action:'add'|'subtract'`) — consolida na próxima parcela | S4.5 |
| `cancelarAssinatura` | `POST /subscriptions/cancel` | conta |

Webhook (S4.4): validar HMAC com `ABACATEPAY_WEBHOOK_SECRET` conforme docs.abacatepay.com/pages/webhooks/reference. Eventos tratados (ignorar e logar os demais): `subscription.completed`, `subscription.renewed`, `subscription.cancelled`.

**Algoritmo do add-on de e-mail extra (determinístico — BRIEFING §7):**
1. Por obra, o 1º `obra_acessos` é grátis (`cobrado_extra=false`); do 2º em diante `cobrado_extra=true`.
2. Ao criar acesso com `cobrado_extra=true` e assinatura `ativa`: `registrarUso(add, 1)` → grava em `assinatura_usos` (cobra na próxima parcela; sem pró-rata).
3. Ao remover acesso cobrado no MESMO ciclo (existe registro `add` com o mesmo `installment_number` pendente): `registrarUso(subtract, 1)`; senão, apenas remove (para de contar nos ciclos futuros).
4. No evento `subscription.renewed`: contar `obra_acessos` ativos com `cobrado_extra=true` de obras não arquivadas do dono → `registrarUso(add, N)` para a nova próxima parcela (se N > 0).
5. Durante `trial`: bloquear criação do 2º e-mail (modal: precisa assinar).

### 5.5 Gating — `src/lib/gating.ts` (única fonte; usado por UI e validado nos RPCs)

| Ação | trial | ativa | inadimplente | cancelada |
|---|---|---|---|---|
| Criar obra | ✅ se obras ativas < 1 | ✅ se < limite_obras | ❌ | ❌ |
| Criar/editar rascunho | ✅ | ✅ | ❌ | ❌ |
| **Enviar relatório** | ✅ se dentro dos 14 dias E envios < 1 | ✅ | ❌ | ❌ |
| Adicionar e-mail extra | ❌ (upsell) | ✅ | ❌ | ❌ |
| Ver/exportar PDF, ver obras | ✅ | ✅ | ✅ | ✅ (somente leitura) |
| Proprietário ver a obra | ✅ | ✅ | ✅ | ✅ |

Bloqueio sempre com modal de upsell apontando para `/planos` (nunca erro seco).

---

## 6. Fases e tarefas

> Formato: **Objetivo · Passos · Aceite**. Arquivos-alvo já indicados no mapa (seção 3) e nos contratos (seções 4–5).

### FASE S0 — Fundação

**S0.1 Git e higiene** · Na raiz (já renomeada pelo humano): criar `.gitignore` raiz (`.DS_Store`, `node_modules/`, `.env*`, `!.env.example`, `webapp/.next/`), `git init`, apagar `design-system/Como Está Minha Obra - prototype (frontend).zip` e `Context/Como Está Minha Obra - prototype (frontend).zip` (duplicatas; os descompactados ficam), apagar `design-system/.../uploads/Proposta Comercial - Estevão Moreira_assinado.pdf` (documento real em pasta de mock), remover a entrada `lifeplanner` de `.claude/launch.json`, remover o bloco de credenciais do `Readme.md` substituindo por "ver `webapp/.env.example`". Criar `PROGRESS.md` (checklist de todas as tarefas deste plano + seção "Bloqueios"). Commit inicial.
**Aceite:** `git log` com 1 commit; nenhum segredo em arquivo versionado (`git grep -i "abc_dev\|sb_publishable"` vazio, exceto `.env.example` placeholder).

**S0.2 Scaffold** · `npx create-next-app@latest webapp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack` (aceitar defaults restantes). Remover boilerplate visual. Configurar `tsconfig` `strict`. Scripts em `package.json`: `dev`, `build`, `typecheck` (`tsc --noEmit`), `lint`, `test` (vitest run), `test:e2e` (playwright).
**Aceite:** `npm run build` verde.

**S0.3 Dependências** · Instalar a lista 2.7.
**Aceite:** `npm run build` verde.

**S0.4 Tokens e fontes** · `globals.css` com `@theme` (2.5) + utilitários `.bg-cartao`/`.bg-escuro`; `layout.tsx` raiz com `Space_Grotesk` e `Source_Serif_4` via `next/font/google` expondo `--font-space-grotesk`/`--font-source-serif`; fundo `bg-fundo`, texto `text-tinta`, antialiased.
**Aceite:** página de teste renderiza tokens; nenhum request a `fonts.googleapis.com` em runtime.

**S0.5 Config** · `src/config/env.ts` + `src/config/pricing.ts` (5.1); criar `.env.example` (2.2) e `.env.local` (valores reais fornecidos pelo humano — não commitar).
**Aceite:** teste unitário: `pricing.ts` reflete envs; build falha com env obrigatória ausente.

**S0.6 Banco** · `supabase init` em `webapp/`; migrations `0001_schema.sql` e `0002_rpcs.sql` (seção 4); `supabase link` + `supabase db push`; criar buckets e policies de storage; gerar `database.types.ts`.
**Aceite:** push sem erro; tipos gerados; RLS habilitada em todas as tabelas (query em `pg_tables`/`pg_policies` confirmando).

**S0.7 Clients Supabase** · `src/lib/supabase/server.ts`, `client.ts` e `middleware.ts` conforme docs oficiais do `@supabase/ssr` (server client com cookies; middleware fazendo refresh de sessão e protegendo `(app)`, `(cliente)`, `(admin)` → redirect `/entrar`). `src/lib/supabase/admin.ts` (secret key; import proibido em client components — adicionar comentário e `server-only`).
**Aceite:** rota protegida redireciona anônimo para `/entrar`.

**S0.8 UI kit** · Em `src/components/ui/`: `Botao` (variantes primario/secundario/terciario, pill), `Cartao`, `CartaoEscuro`, `Selo` (status), `BarraProgresso` (2px, âmbar/preta em 100%), `AnelProgresso` (SVG circular do detalhe), `RotuloSecao` (caps + tracking), `CampoTexto`, `CampoMoeda` (máscara pt-BR → centavos), `CampoData`, `Slider` (range 0–100 com `min` travável), `Acordeao` (2 níveis), `Lightbox`, `Toast` (provider + `useToast()`, escuro, bottom-center, 2,8 s), `ModalBase`, `GradeFotos`, `Avatar` (iniciais). Página `/dev/ui` (somente `NODE_ENV=development`) exibindo todos.
**Aceite:** `/dev/ui` renderiza todos os componentes com paridade visual ao protótipo (conferir cores/raios/tamanhos com a seção 2.5).

**S0.9 Testes e CI** · Vitest configurado (jsdom p/ componentes, node p/ libs); Playwright com `webServer`; `.github/workflows/ci.yml`: jobs `typecheck`, `lint`, `test` em push/PR (e2e fica manual/local até S5.4).
**Aceite:** CI verde no primeiro push.

**S0.10 Shells de layout** · Layout `(app)`: sidebar desktop fixa 76px (logo, 3 ícones — Minhas obras/Nova obra/Planos — item ativo em pill preto, avatar no rodapé) + tab bar mobile <800px com blur (item ativo âmbar); conteúdo `max-w-[1240px]`. Layout `(cliente)`: mobile-first 390px de referência, tab bar inferior 4 abas (Início/Linha do tempo/Galeria/Perfil). Layout `(marketing)`: header simples + footer com links legais.
**Aceite:** navegação entre rotas placeholder funciona nos 3 grupos; breakpoint 800px alterna sidebar/tab bar.

### FASE S1 — Autenticação e Empreiteiro core

**S1.1 Magic link** · `/entrar`: campo e-mail + botão "Entrar" → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: env.NEXT_PUBLIC_APP_URL + '/auth/callback' } })` → tela "verifique seu e-mail". `/auth/callback/route.ts`: `exchangeCodeForSession` + redirect da regra da seção 3. Logout em `/conta`.
**Aceite:** e2e (com Supabase local ou mailpit): login por link entra em `/obras`.

**S1.2 Onboarding** · Confirmar que o trigger `handle_new_user` criou profile + assinatura trial; tela `/conta` mostra: nome (editável), e-mail, plano atual, dias restantes de trial, botão sair.
**Aceite:** usuário novo tem assinatura `trial` com `trial_fim ≈ now()+14d`.

**S1.3 Dashboard Minhas obras** · Busca em pill (filtro client-side por nome/cliente, case-insensitive, tempo real), botão "+ Nova obra", título com contagem ("X obras", singular/plural), grid `minmax(270px,1fr)` de cards: capa (signed URL; fallback cinza), selo de status **calculado** (`fn_avanco_geral`: 100 → "Concluída"; 0 → "A iniciar"; senão "Em obra"), nome (serif), cliente, barra + %, "X de Y etapas" (pct_atual=100), "N relatórios" (enviados) ou "sem relatórios". Obras arquivadas ficam fora (toggle "ver arquivadas" lista com selo "Arquivada", somente leitura).
**Aceite:** e2e: criar obra → aparece no grid com 0% "A iniciar"; busca filtra.

**S1.4 Ficha Nova obra** · 4 seções numeradas (spec §2.5 + deltas BRIEFING §6): (1) Informações — 9 campos + upload de capa (comprimir client-side p/ WebP ≤1600px via `browser-image-compression`, subir para `capas/`); (2) Prazos — início e término contratual (`CampoData`), nota "dias aditivados são registrados pelos relatórios"; (3) Financeiro — Valor contratado (`CampoMoeda`) + **Sinal (R$)** opcional; (4) Etapas — lista das 23 (2.4) numeradas, com remover, adicionar (input + Enter/botão) e **campo peso** por etapa (default 1, numérico > 0, tooltip "peso na média do avanço geral"). Submit chama `fn_criar_obra` → redirect ao detalhe + toast "Página de acompanhamento criada".
**Aceite:** unit: obra criada tem 23 etapas ordem 1..23 peso 1; sinal > 0 gera lançamento `sinal/medicoes/"Sinal contratual"`; e2e: remover 3 etapas e adicionar 1 própria persiste.

**S1.5 Detalhe da obra** · Header (nome serif 32px, endereço · cliente · entrega, botões "Ver página do cliente" [link `/c/{id}`], "Compartilhar", "Novo relatório" âmbar). Cartão escuro: `AnelProgresso` com avanço geral, barra linear, 3 números (etapas concluídas "X de Y", pago total compacto + "% do contrato", entrega prevista = término contratual + Σ dias_aditivados). Coluna "Avanço físico": todas as etapas com dot/nome/% /mini-barra (cores: 100 preto, >0 âmbar, 0 cinza) — dados de `etapas.pct_atual` ("atualizado pelo último relatório"). Coluna "Relatórios": feed desc por numero (S2.7 preenche).
**Aceite:** valores batem com o seed de teste (seção 7, caso F1); entrega prevista recalcula com dias aditivados.

**S1.6 Arquivar/excluir obra + limites** · Em `/conta` ou no detalhe: ação "Excluir página de acompanhamento" com modal de confirmação forte (digitar o nome da obra). Efeito: `arquivada_em = now()` (soft delete, BRIEFING §3), acessos do proprietário deixam de ver (policy já cobre), vaga liberada. Texto no modal: "Os dados serão mantidos por 30 dias e depois removidos definitivamente." (purga automática = tarefa futura registrada em PROGRESS.md, não implementar job agora). Criar obra respeita `fn_criar_obra` (erro `LIMITE_OBRAS` → modal upsell `/planos`).
**Aceite:** e2e: com trial (limite 1), 2ª obra abre upsell; arquivar a 1ª permite criar a 2ª.

**S1.7 Compartilhamento** · Modal (spec §2.9): input e-mail + "Liberar acesso" → cria `obra_acessos` (1º grátis; 2º+ marca `cobrado_extra=true` e segue gating 5.5 — em trial bloqueia com upsell) + envia e-mail de convite (Resend, template S2.10) com link `/entrar`. Lista "Com acesso": iniciais, e-mail, status ("convite enviado · aguardando login" âmbar / "acesso ativo · já fez login" verde), remover (aplica passo 3 do algoritmo 5.4 quando cobrado). Bloco "Link de visualização": `{APP_URL}/c/{obraId}` + copiar (toast "Link copiado") + nota "Só abre para e-mails com acesso liberado, após login.".
**Aceite:** e2e: convidar e-mail → linha "aguardando login"; login do convidado ativa acesso e abre `/c/{obraId}`; e-mail duplicado → toast "Este e-mail já tem acesso".

### FASE S2 — Relatórios (núcleo do produto)

**S2.1 Modal do relatório + rascunho** · Botão "Novo relatório" abre modal fullscreen-overlay (mobile: tela cheia). Cabeçalho: nome da obra, "Relatório nº {N}" (N = maior numero da obra + 1; ao editar rascunho, preserva), data de hoje, "ao publicar, o cliente recebe por e-mail". Estado do formulário = `RelatorioRascunho` (5.2). Botão único "**Salvar rascunho do relatório nº N**" (preto) + microcopy "Nada é enviado ainda...". Salvar: server action grava/atualiza `relatorios` (`status='rascunho'`, `dados_rascunho`) — editar substitui o MESMO registro/numero.
**Aceite:** salvar → card de rascunho no feed; reabrir → formulário idêntico ao salvo; salvar de novo não cria 2º registro.

**S2.2 Seção 1 · Avanço físico** · Uma linha por etapa: nome, `Slider` com **`min` = `pct_atual`** (nunca regride — regra §5.2) e valor do rascunho, % à direita. Etapa alterada: nome e % em âmbar. Topo: "geral: X% → Y%" ao vivo com **média ponderada** (função compartilhada `calcularAvancoGeral(etapas: {peso, pct}[])` em `src/lib/relatorios/calculos.ts` — mesma fórmula do SQL).
**Aceite:** unit (seção 7 casos A1–A3); slider não desce abaixo do min.

**S2.3 Seção 2 · Financeiro** · Três grupos (spec §2.7): *Pago em medições* — sem campo de rótulo; chip automático com `fn_proximos_rotulos` + pendentes locais ("Medição 04"), input só valor; *Pago em materiais* — rótulo livre + valor; *Aditivos* — chip "Aditivo NN" + campo "Do que se refere?" + valor. Cada grupo: total ao vivo, histórico (persistidos + pendentes). Topo: "pago: R$ X · Y% do contrato" recalculado (aditivos pendentes afetam o denominador). Ação extra discreta "estorno/ajuste" (BRIEFING §5.9): escolhe grupo, descrição obrigatória, valor (subtrai; UI mostra em linha própria "Estorno — {descrição}" com valor negativo).
**Aceite:** unit (seção 7 casos F1–F3); adicionar aditivo muda o % pago exibido.

**S2.4 Seção 3 · Atividades** · Lista de todas as etapas com checkbox circular; marcar expande textarea "O que foi feito nesta etapa?" + grade de fotos com botão anexar (comprime WebP ≤1600px, sobe para `fotos/{obraId}/{relatorioId}/...`, **máx 12 por etapa** — 13ª bloqueia com toast "Limite de 12 fotos por etapa"). Desmarcar remove nota/fotos do rascunho.
**Aceite:** e2e: marcar 2 etapas, anexar fotos, salvar, reabrir → tudo lá; 13ª foto bloqueada.

**S2.5 Seção 4 · Prazo (delta do briefing)** · Grupo "Prazo": select de motivo (tabela 2.4), campo dias (int > 0), descrição (obrigatória se "Outro"), botão "+" adiciona linha; lista com remover. Mostra "novo término previsto: {data}" ao vivo (término contratual + acumulado persistido + pendentes).
**Aceite:** unit (seção 7 caso P1).

**S2.6 Seção 5 · Clima (informativo)** · Card read-only: "Preenchido automaticamente · {endereço}". Exibe os últimos 7 dias de `clima_snapshots` da obra (ícone sol/nuvem/chuva + % chuva + data). Sem snapshots (obra sem lat/lng): "clima indisponível para este endereço".
**Aceite:** com seeds de clima, card mostra 7 dias corretos.

**S2.7 Feed de relatórios** · Card (spec §2.6): "Relatório nº N" + selo "Rascunho" quando aplicável, data, "avanço X% → Y% +Z%", "financeiro R$ compacto", chips das etapas trabalhadas, até 5 miniaturas. Rascunho: ações "Visualizar como cliente" (preview read-only da página do cliente renderizada a partir de um snapshot **calculado em memória** do rascunho — mesma função de montagem usada no RPC, extraída para lib compartilhada), "Editar", "Enviar ao cliente" (âmbar). Enviado: rodapé "✓ enviado por e-mail ao cliente" + "Ver relatório do cliente" + **botão de download do PDF** (BRIEFING §5.11).
**Aceite:** e2e: rascunho mostra 3 ações; preview não altera nada no banco.

**S2.8 Envio** · "Enviar ao cliente" → confirmação → server action chama `fn_enviar_relatorio` → sucesso: toast "Relatório nº N enviado · cliente notificado por e-mail", feed atualiza, avanço físico da obra reflete os novos pcts. Erros do RPC mapeados para mensagens: `PCT_REGREDIU` (não deveria ocorrer pela UI — mostrar erro genérico e logar), `TRIAL_LIMITE`/`TRIAL_EXPIRADO`/`ASSINATURA_INATIVA` → modal upsell.
**Aceite:** e2e completo: criar rascunho (subir 2 etapas, 1 medição, 1 aditivo, 1 atividade com foto, 1 linha de prazo) → enviar → `etapas.pct_atual` atualizado, lançamentos com rótulos "Medição 01"/"Aditivo 01 — ...", snapshot gravado, rascunho não existe mais; 2º envio no trial → upsell.

**S2.9 PDF** · `src/lib/pdf/relatorio-pdf.tsx` com `@react-pdf/renderer`, renderizando SOMENTE de `RelatorioSnapshot`: cabeçalho (marca + obra + nº + data), avanço físico (tabela etapas com antes→depois), financeiro (grupos + agregados), prazo, atividades (notas; fotos embutidas — baixar do Storage no server, máx 4 por atividade no PDF), clima. Fontes registradas (TTF locais em `src/assets/fonts/` — baixar Space Grotesk e Source Serif 4 do repositório oficial do Google Fonts em build-time NÃO; commitar os .ttf). Server action pós-envio: renderiza → upload `pdfs/{obraId}/relatorio-{N}.pdf` → `update relatorios.pdf_path`. Route `api/relatorios/[id]/pdf`: autoriza via RLS (select no relatório com o client do usuário), gera signed URL (15 min) e redireciona; se `pdf_path` null (falha anterior), gera na hora (retry) antes de redirecionar.
**Aceite:** PDF abre com dados idênticos ao snapshot; proprietário e dono baixam; terceiro recebe 404.

**S2.10 E-mails** · `src/emails/`: `convite-acesso.tsx` ("{Empreiteiro} liberou o acesso à obra {nome}" + botão "Acessar acompanhamento") e `novo-relatorio.tsx` ("Relatório nº N da obra {nome} disponível" + resumo avanço X→Y + botão). Envio via Resend nas actions de S1.7 e S2.8 (para todos os `obra_acessos` ativos/convidados da obra). Falha de e-mail: logar, não desfazer envio.
**Aceite:** modo dev loga payload; templates renderizam nos testes.

### FASE S3 — Página do Proprietário (spec §3 — seguir à risca; tudo derivado, zero edição)

**S3.1 Guarda e layout** · `/c/[obraId]`: acesso somente com sessão + `obra_acessos` ativo (RLS já garante; adicionar guard com redirect para `/entrar` e página "sem acesso" clara). Header sticky (saudação com 1º nome, nome da obra em serif, avatar de iniciais; borda inferior aparece ao rolar). Fonte de dados de TODAS as telas: último relatório **enviado** (snapshot) + agregados persistidos.
**S3.2 Início** · Bloco relatório vigente (nº atual, datas atual/anterior); **gauge duplo** SVG (arco superior esq→dir = avanço físico; arco inferior dir→esq = % desembolso; gradiente âmbar, marcador circular na ponta, números grandes serif no centro); grade 2×3 de indicadores (entrega prevista recalculada · dias de obra · dias restantes · contratado total · desembolsado · saldo — datas em America/Bahia); régua do tempo (7 dias de `clima_snapshots` anteriores à data do relatório vigente, com localidade no cabeçalho); "Atividades executadas" grade 2 col (cards por etapa do último relatório: capa, contagem de fotos, dot + rótulo Em andamento/Concluída) → tocar abre **lightbox** escuro (título da etapa, "Descrição do engenheiro" = nota + autor + data, fotos empilhadas; fecha no × ou fora); cartão escuro "Relatório nº N" com badge "novo" (enviado há < 7 dias) e "Abrir em PDF" (rota S2.9 em overlay/iframe).
**S3.3 Informações** · 4 acordeões (Dados do projeto com subgrupos Arquitetos/Projetistas; Prazos com subgrupo Dias aditivados por motivo — agregado de `dias_aditivados` com rótulos da tabela 2.4 — término recalculado, dias corridos/restantes; Avanço físico: 23 etapas com % e mini-barra, resumo "X%" âmbar; Avanço financeiro: contratado, subgrupo aditivos com %, contratado total, subgrupos medições e materiais com linhas individuais — inclusive sinal e estornos — pago total, saldo). Botão "Abrir tudo/Fechar tudo" (expande também subgrupos).
**S3.4 Galeria** · Todas as `fotos` agrupadas por data de envio do relatório (header data + contagem), grade 2 col, etiqueta da etapa; tocar → lightbox individual "publicada em {data}".
**S3.5 Linha do tempo** · Calendário mensal (D a S) do início contratual ao término recalculado: dias com relatório enviado = círculo âmbar clicável (abre o PDF daquele relatório); dias futuros cinza claro; header do mês com contagem; subtítulo com total.
**S3.6 Perfil** · Dados do proprietário (nome, e-mail; telefone/CPF/"cliente desde" apenas se existirem — **CPF sempre mascarado** `•••.XXX.XXX-••`), "Minhas obras" (todas com acesso ativo: card com status/barra/período; a atual com borda âmbar; tocar troca de obra), ações: sair.
**Aceite S3 (conjunto):** e2e "jornada do Francisco": empreiteiro envia relatório → proprietário loga → início mostra os números do snapshot; rascunho novo do empreiteiro NÃO altera nada no lado do cliente; galeria/linha do tempo/informações consistentes com os casos da seção 7.

**S3.7 Cron de clima** · `api/cron/clima/route.ts` (GET): exige `Authorization: Bearer {CRON_SECRET}` (senão 401). Para cada obra ativa com lat/lng: `openMeteoProvider.buscarDias` → upsert em `clima_snapshots` (unique obra+data). `vercel.json`: `{ "crons": [{ "path": "/api/cron/clima", "schedule": "0 9 * * *" }] }`. Também disparar busca inicial na criação da obra (server action, fire-and-forget).
**Aceite:** chamada local com secret popula 8 dias (7 passados + hoje); sem secret → 401.

### FASE S4 — Monetização e marketing

**S4.1 Client AbacatePay** · Implementar 5.4 com tipos de request/response conforme docs (transcrever os campos da documentação; **não** adicionar campos extras). Erros HTTP → exceção tipada logada.
**S4.2 Bootstrap de produtos** · `scripts/abacatepay-bootstrap.ts` (rodar com `tsx`): cria os 4 produtos da tabela 2.3 (3 com `cycle:'MONTHLY'` + preços dos envs; 1 avulso sem cycle) **se não existirem** (idempotente por `externalId` — listar antes de criar) e imprime os `prod_...` para preencher os envs.
**Aceite:** rodar 2× não duplica; envs preenchidos.
**S4.3 Checkout** · `/planos`: 3 cards (dados de `pricing.ts`; card do plano de 3 obras escuro com selo "Recomendado"; card selecionado com borda âmbar + "✓ selecionado"; itens de cada card citam limite de obras, relatórios ilimitados, página do cliente, PDF, clima), banner do trial ("14 dias grátis · 1 relatório") quando em trial. Botão "Assinar {plano}" → server action: garante `abacatepay_customer_id` (`criarCliente`), `criarAssinatura` (returnUrl `/planos`, completionUrl `/planos?sucesso=1`) → redirect `data.url`. Estado "aguardando confirmação" até o webhook ativar.
**S4.4 Webhook** · `api/webhooks/abacatepay/route.ts`: validar HMAC (docs); gravar TUDO em `webhooks_log`; processar com idempotência (se o payload tiver id de evento, checar duplicidade): `subscription.completed` → localizar assinatura por `externalId`, set `status='ativa'`, `plano`/`limite_obras` pelo produto, salvar `abacatepay_subscription_id`; `subscription.renewed` → garantir `ativa` + passo 4 do algoritmo de e-mail extra (5.4); `subscription.cancelled` → `status='cancelada'`. Responder 200 rápido; erros de processamento ficam em `webhooks_log.erro`.
**Aceite:** unit com payloads simulados dos 3 eventos muda o estado corretamente; assinatura inválida (HMAC) → 401 sem log de processado.
**S4.5 Add-on e gating fim-a-fim** · Implementar `gating.ts` (5.5) e ligá-lo a: criar obra, salvar rascunho, enviar relatório (já validado no RPC — aqui é UX), adicionar e-mail extra (algoritmo 5.4 completo com `assinatura_usos`).
**Aceite:** matriz 5.5 coberta por testes unit; e2e: assinar (simulando webhook) desbloqueia 2º envio.
**S4.6 Trocar plano / cancelar** · Em `/planos` (assinante): plano atual marcado; escolher outro → `trocarPlano` → aviso "Alteração agendada para o próximo ciclo" (sem pró-rata). Downgrade com mais obras ativas que o novo limite: bloquear com mensagem "Arquive X obras antes de reduzir o plano". `/conta`: cancelar assinatura (confirmação; explica que vira somente leitura ao fim do ciclo).
**S4.7 Landing + Preços** · `(marketing)/page.tsx` com o design system (fundo greige, serif, âmbar): hero ("Da fundação à entrega, tudo registrado." + sub + CTA "Começar grátis — 14 dias" → `/entrar`), seção problema→solução (conteúdo da aba "Proposta de valor" da planilha: dores do WhatsApp vs plataforma), "Como funciona" em 3 passos (criar obra → relatório semanal → cliente acompanha), features (avanço físico ponderado, financeiro, fotos, clima, PDF, linha do tempo), planos (mesmos cards de `pricing.ts`), FAQ (5 itens: trial, cancelamento, e-mail extra, limite de obras, segurança dos dados), footer (links legais + contato). `/precos`: cards + tabela comparativa + add-on e-mail extra.
**Aceite:** preços vêm 100% de `pricing.ts`; Lighthouse SEO ≥ 90; mobile ok.
**S4.8 Legais** · `/politica-de-privacidade` e `/termos` com estrutura completa LGPD (controlador, dados coletados: cadastro/fotos de obra/dados financeiros da obra, finalidades, bases legais, suboperadores: Supabase, Vercel, Resend, AbacatePay, direitos do titular + canal de contato, retenção — incl. 30 dias pós-arquivamento — cookies). Texto marcado com `{/* REVISAR: Estevão/Geraldino */}` nos pontos de negócio.
**Aceite:** páginas linkadas no footer e no cadastro.

### FASE S5 — Admin, blog, QA e deploy

**S5.1 Admin** · Acesso: `admins` (inserir manualmente o user_id do Estevão via SQL; documentar em PROGRESS.md). Guard server-side + RLS. `/admin`: KPIs (assinantes por status/plano, MRR estimado = Σ preço dos planos ativos via `pricing.ts`, obras ativas, relatórios enviados últimos 30 dias, trials ativos/expirados). `/admin/contas`: tabela (busca por e-mail; nome, plano, status, nº obras, criado em) + detalhe com ações: reenviar convite de proprietário, ver estado da assinatura. `/admin/webhooks`: últimos 200 de `webhooks_log` (evento, processado, erro, data) + reprocessar (chama o mesmo handler).
**Aceite:** não-admin → 404; KPIs batem com seeds.
**S5.2 Blog + SEO** · Posts em `webapp/content/blog/*.mdx` com frontmatter obrigatório `{ title, description, date, slug, cover? }` (gray-matter + next-mdx-remote/rsc). Lista com cards; post com tipografia serif. Criar 1 post real de exemplo ("Como acompanhar a obra da sua casa sem depender do WhatsApp" — 600+ palavras a partir da aba Proposta de valor). `sitemap.ts` (marketing + blog), `robots.ts`, `generateMetadata` em todas as páginas de marketing, OG image estática com a marca.
**S5.3 Passo de polimento** · Checklist em TODAS as telas: estado vazio (obra sem relatórios: "Publique o primeiro relatório para ativar a página do cliente"; proprietário sem relatório: tela de aguardando com nome da obra), loading (skeletons nos grids/feeds), erro (toast + retry), `alt` em toda imagem, foco visível, `aria-label` em botões-ícone, contraste ≥ AA nos textos cinza sobre greige (ajustar tamanho/peso onde falhar, sem trocar os tons da marca), inputs com `label` reais, modais com foco preso e Esc.
**S5.4 Suíte e2e completa** · Playwright: (1) jornada empreiteiro completa S2.8; (2) jornada proprietário S3; (3) trial → upsell → assinatura simulada por webhook → desbloqueio; (4) RLS: usuário B não acessa obra de A (esperar 404/redirect), proprietário não vê rascunho; (5) arquivar libera vaga; (6) e-mail extra: 2º acesso em trial bloqueia, em plano ativo registra uso.
**Aceite:** `npm run test:e2e` verde local; job e2e adicionado ao CI.
**S5.5 Deploy (com o humano)** · Vercel: envs de produção, domínio `comoestaminhaobra.com.br` + `www`, cron ativo; Supabase prod: `db push`, buckets, SMTP custom (Resend) nos templates de auth (assunto/copy da marca em pt-BR: "Seu link de acesso — Como Está Minha Obra"); AbacatePay: bootstrap de produtos em produção + registrar webhook `https://comoestaminhaobra.com.br/api/webhooks/abacatepay`; smoke test em produção (login, criar obra, rascunho, envio com PDF/e-mail reais, página do cliente).
**S5.6 Seed de demonstração** · `scripts/seed-demo.ts`: conta demo com a obra "Residência de Francisco" (dados da planilha: contratado R$ 1.000.000, sinal R$ 100.000, medições 01–03 de 50/60/50 mil, materiais aço 23k/madeira 12k/pisos 20k/argamassas 8k, aditivos 30k + 3k, etapas 5×100% + alvenarias 20 + cobertura 20 + elétricas 10, 30 dias aditivados: chuvas 18 + aditivo de escopo 12) + 3 relatórios enviados. Usado por e2e e para demo ao Geraldino.
**Aceite:** rodar seed → detalhe da obra mostra: contratado total R$ 1.033.000 · pago R$ 323.000 · 31% · saldo R$ 710.000 · término previsto 30/01/2027.

---

## 7. Testes unitários obrigatórios (valores EXATOS — fonte: planilha e briefing)

> ⚠️ Anti-alucinação: os protótipos exibem alguns números decorativos inconsistentes (ex.: "34%" de avanço com etapas que somam outra média). **Não** usar números de tela do protótipo como expected — usar SOMENTE os casos abaixo.

`src/lib/relatorios/calculos.test.ts`:

- **A1** média ponderada, pesos todos 1, etapas da planilha (5×100, 20, 20, 10, 15×0; total 23) → `round(550/23)` = **24**.
- **A2** pesos: Estrutura=5, demais=1 (27 de soma), mesmos pcts → `round((100·5 + 450·1)/27)` = `round(950/27)` = **35**.
- **A3** todas 100 → **100**; todas 0 → **0**; lista vazia → **0**.
- **F1** contratado 100.000.000 c (R$ 1 mi), aditivos [3.000.000, 300.000] c → contratado total **103.300.000 c**; pago = sinal 10.000.000 + medições [5.000.000, 6.000.000, 5.000.000] + materiais [2.300.000, 1.200.000, 2.000.000, 800.000] = **32.300.000 c**; pctPago = `round(32.3/103.3·100)` = **31**; saldo **71.000.000 c**.
- **F2** próximo rótulo de medição com [sinal, Medição 01..03] persistidos e 0 pendentes → **"Medição 04"**; com 2 pendentes → 3ª nova = **"Medição 06"**. Sinal nunca conta na numeração.
- **F3** estorno de −500.000 c em materiais reduz pago para 31.800.000 c e pctPago para **31** (`round(30.78)`→31); estorno em aditivos reduz o contratado total.
- **P1** término 2026-12-31 + dias aditivados [18, 12] → **2027-01-30**.
- **M1** monotonicidade: `pct_atual=60`, rascunho 55 → inválido; 60 → válido; 61 → válido.
- **BRL** `formatarBRLCompacto`: 47.300.000 c → "R$ 473 mil"; 103.300.000 c → "R$ 1,03 mi"; 89.900 c → "R$ 899,00".
- **Clima** WMO 0→aberto, 3→nublado, 61→chuvoso; dia passado sem probabilidade e `precipitation_sum=4.2` → prob 80/chuvoso.
- **Gating** matriz 5.5 completa (tabela → casos).

---

## 8. CI (`.github/workflows/ci.yml`)

Push/PR em `main`: setup Node 22 + cache npm → `npm ci` → `typecheck` → `lint` → `test` (S5.4 adiciona job `e2e` com browsers do Playwright). Deploy é da Vercel (auto no push em `main`).

---

## 9. Defaults assumidos neste plano (mudar exige atualizar BRIEFING.md)

1. Assinatura **cancelada/inadimplente** = somente leitura para o empreiteiro; proprietário mantém acesso de leitura (gating 5.5).
2. Purga definitiva de obra arquivada (após 30 dias) fica como tarefa futura documentada — v1 só arquiva.
3. PDF inclui no máximo 4 fotos por atividade (tamanho de arquivo).
4. Badge "novo" no cartão do relatório = enviado há menos de 7 dias.
5. Trial não pede cartão; checkout AbacatePay só na conversão.
6. Telefone/CPF/"cliente desde" do proprietário: campos opcionais do perfil (editáveis pelo próprio proprietário em Perfil? **Não** — v1 read-only, preenchidos pelo empreiteiro? **Nenhum dos dois**: v1 exibe apenas nome e e-mail; demais campos ficam ocultos se vazios).

---

## 10. Proibições explícitas (repetindo por importância)

- Não usar a marca "Demobra". Não usar Google Fonts via CDN. Não usar float para dinheiro. Não hardcodar preço.
- Não criar bucket público. Não expor `SUPABASE_SECRET_KEY`/`ABACATEPAY_API_KEY` a client component.
- Não permitir proprietário ver rascunho (testar!). Não aplicar rascunho a nada além de `relatorios.dados_rascunho`.
- Não implementar features de fase 2 (seção 0.7). Não inventar campos/eventos do AbacatePay.
- Não editar `Context/`, `design-system/`, `BRIEFING.md`, `ANALISE-TECH-LEAD.md`.

## 11. Definition of Done global

- [ ] Todas as tarefas S0–S5 marcadas em `PROGRESS.md` (ou bloqueio documentado)
- [ ] CI verde (typecheck, lint, unit, e2e)
- [ ] Testes da seção 7 todos passando com os valores exatos
- [ ] Fluxo real em produção: login → obra → rascunho → envio → e-mail → página do cliente → PDF
- [ ] Billing real: checkout → webhook → desbloqueio; e-mail extra registrado via record-usage
- [ ] Zero segredo em arquivo versionado · RLS cobrindo todas as tabelas · buckets privados
- [ ] Landing, preços, blog (1 post), política de privacidade e termos publicados
- [ ] Admin acessível somente a admin, com KPIs corretos
