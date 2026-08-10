# PROGRESSO — Como Está Minha Obra

Atualizado conforme execução do [PLANO-EXECUCAO-CURSOR.md](PLANO-EXECUCAO-CURSOR.md).

## Checklist

### FASE S0 — Fundação

- [x] S0.1 Git e higiene
- [x] S0.2 Scaffold
- [x] S0.3 Dependências
- [ ] S0.4 Tokens e fontes
- [ ] S0.5 Config
- [ ] S0.6 Banco
- [ ] S0.7 Clients Supabase
- [ ] S0.8 UI kit
- [ ] S0.9 Testes e CI
- [ ] S0.10 Shells de layout

### FASE S1 — Autenticação e Empreiteiro core

- [ ] S1.1 Magic link
- [ ] S1.2 Onboarding
- [ ] S1.3 Dashboard Minhas obras
- [ ] S1.4 Ficha Nova obra
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

_Nenhum aberto._

### Resolvidos

- **Pasta raiz**: renomeada de `Como está minha obra?` → `como-esta-minha-obra` (o `?` quebrava o webpack/Next.js). Pré-requisito humano §1 executado pelo agente para desbloquear o build.

## Notas / tarefas futuras

- Purga automática de obras arquivadas após 30 dias (não implementar na v1).
