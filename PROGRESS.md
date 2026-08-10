# PROGRESSO — Como Está Minha Obra

Atualizado conforme execução do [PLANO-EXECUCAO-CURSOR.md](PLANO-EXECUCAO-CURSOR.md).

## Checklist

### FASE S0 — Fundação

- [x] S0.1 Git e higiene
- [x] S0.2 Scaffold
- [x] S0.3 Dependências
- [x] S0.4 Tokens e fontes
- [x] S0.5 Config
- [x] S0.6 Banco (migrations + tipos manuais; push remoto pendente — ver Bloqueios)
- [x] S0.7 Clients Supabase
- [x] S0.8 UI kit
- [x] S0.9 Testes e CI
- [x] S0.10 Shells de layout

### FASE S1 — Autenticação e Empreiteiro core

- [x] S1.1 Magic link
- [x] S1.2 Onboarding (UI pronta; trigger só verificável após db push)
- [x] S1.3 Dashboard Minhas obras
- [x] S1.4 Ficha Nova obra
- [ ] S1.5 Detalhe da obra
- [ ] S1.6 Arquivar/excluir obra + limites
- [ ] S1.7 Compartilhamento

### FASE S2 — Relatórios

- [ ] S2.1 Modal do relatório + rascunho
- [ ] S2.2 Seção 1 · Avanço físico
- [ ] S2.3 Seção 2 · Financeiro
- [ ] S2.4 Seção 3 · Atividades
- [ ] S2.5 Seção 4 · Prazo
- [ ] S2.6 Seção 5 · Clima
- [ ] S2.7 Feed de relatórios
- [ ] S2.8 Envio
- [ ] S2.9 PDF
- [ ] S2.10 E-mails

### FASE S3 — Página do Proprietário

- [ ] S3.1 Guarda e layout
- [ ] S3.2 Início
- [ ] S3.3 Informações
- [ ] S3.4 Galeria
- [ ] S3.5 Linha do tempo
- [ ] S3.6 Perfil
- [ ] S3.7 Cron de clima

### FASE S4 — Monetização e marketing

- [ ] S4.1 Client AbacatePay
- [ ] S4.2 Bootstrap de produtos
- [ ] S4.3 Checkout
- [ ] S4.4 Webhook
- [ ] S4.5 Add-on e gating
- [ ] S4.6 Trocar plano / cancelar
- [ ] S4.7 Landing + Preços
- [ ] S4.8 Legais

### FASE S5 — Admin, blog, QA e deploy

- [ ] S5.1 Admin
- [ ] S5.2 Blog + SEO
- [ ] S5.3 Passo de polimento
- [ ] S5.4 Suíte e2e completa
- [ ] S5.5 Deploy (com o humano)
- [ ] S5.6 Seed de demonstração

## Bloqueios

- **S1.2 verificação live:** trigger `handle_new_user` e `trial_fim ≈ now()+14d` só após `supabase db push` + login real.

- **S0.6 `supabase link` / `db push`:** CLI sem access token (`supabase login` não feito) e Docker indisponível (sem Supabase local). Migrations `0001_schema.sql` e `0002_rpcs.sql` estão prontas. Tipos em `src/lib/database.types.ts` foram gerados manualmente a partir do schema — regenerar com `supabase gen types typescript --linked` após o push. **Ação humana:** `npx supabase login` → `npx supabase link --project-ref hxlrskcnsbmmotjmxxfd` → informar senha do DB → `npx supabase db push`.

### Resolvidos

- **Dep extra (S0.7):** `server-only` instalado (exigido pelo plano para `admin.ts`).

- **Env local (S0.5):** `.env.local` criado com URL/anon do Supabase já conhecidos. Preencher: `SUPABASE_SECRET_KEY`, `ABACATEPAY_*` (rotacionar key), `RESEND_API_KEY`. Placeholders atuais permitem build/test local.

- **Pasta raiz**: renomeada de `Como está minha obra?` → `como-esta-minha-obra` (o `?` quebrava o webpack/Next.js). Pré-requisito humano §1 executado pelo agente para desbloquear o build.

## Notas / tarefas futuras

- Purga automática de obras arquivadas após 30 dias (não implementar na v1).
