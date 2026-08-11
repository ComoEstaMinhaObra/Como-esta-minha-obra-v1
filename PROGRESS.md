# PROGRESSO — Como Está Minha Obra

Atualizado conforme execução do [PLANO-EXECUCAO-CURSOR.md](PLANO-EXECUCAO-CURSOR.md).

## Checklist

### FASE S0 — Fundação

- [x] S0.1 Git e higiene
- [x] S0.2 Scaffold
- [x] S0.3 Dependências
- [x] S0.4 Tokens e fontes
- [x] S0.5 Config
- [x] S0.6 Banco (migrations 0001/0002 aplicadas no remoto em 2026-08-10; tipos regenerados via `gen types --linked`)
- [x] S0.7 Clients Supabase
- [x] S0.8 UI kit
- [x] S0.9 Testes e CI
- [x] S0.10 Shells de layout

### FASE S1 — Autenticação e Empreiteiro core

- [x] S1.1 Magic link
- [x] S1.2 Onboarding (UI pronta; db push feito — verificação live com login real)
- [x] S1.3 Dashboard Minhas obras
- [x] S1.4 Ficha Nova obra
- [x] S1.5 Detalhe da obra
- [x] S1.6 Arquivar/excluir obra + limites
- [x] S1.7 Compartilhamento

### FASE S2 — Relatórios

- [x] S2.1 Modal do relatório + rascunho
- [x] S2.2 Seção 1 · Avanço físico
- [x] S2.3 Seção 2 · Financeiro
- [x] S2.4 Seção 3 · Atividades
- [x] S2.5 Seção 4 · Prazo
- [x] S2.6 Seção 5 · Clima
- [x] S2.7 Feed de relatórios
- [x] S2.8 Envio
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

- **S1.2 verificação live:** migrations já aplicadas (`db push` feito). Validar `handle_new_user` e `trial_fim ≈ now()+14d` com um login real.

- ~~**S0.6 `supabase link` / `db push`**~~ **RESOLVIDO (2026-08-10):** CLI logado na conta contato@comoestaminhaobra.com.br, projeto `hxlrskcnsbmmotjmxxfd` linkado, migrations `0001_schema.sql` e `0002_rpcs.sql` aplicadas no remoto (`migration list` confirma 0001/0002 local=remote), tipos regenerados com `supabase gen types typescript --linked`, `tsc --noEmit` e 12 testes unitários passando. Nota: o CLI Supabase entra em modo JSON não-interativo quando detecta agente de IA (`CLAUDECODE`/`AI_AGENT` no env) — para comandos interativos, rodar com `env -u CLAUDECODE -u AI_AGENT`.

### Resolvidos

- **Dep extra (S0.7):** `server-only` instalado (exigido pelo plano para `admin.ts`).

- **Env local (S0.5):** `.env.local` criado com URL/anon do Supabase já conhecidos. Preencher: `SUPABASE_SECRET_KEY`, `ABACATEPAY_*` (rotacionar key), `RESEND_API_KEY`. Placeholders atuais permitem build/test local.

- **Pasta raiz**: renomeada de `Como está minha obra?` → `como-esta-minha-obra` (o `?` quebrava o webpack/Next.js). Pré-requisito humano §1 executado pelo agente para desbloquear o build.

## Notas / tarefas futuras

- Purga automática de obras arquivadas após 30 dias (não implementar na v1).
