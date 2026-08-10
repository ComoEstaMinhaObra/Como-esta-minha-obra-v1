# O que é esse repositório?

Eu, Estevão, estou prestando um serviço ao meu sócio Geraldino de criação de software como descrito na proposta em `Context/`.

O nome do software é **Como Está Minha Obra**. Escopo e linha de criação estão em `Context/`.

## Stack

- React / TypeScript
- Next.js (App Router)
- Tailwind CSS
- Supabase (Auth magic link, Postgres, Storage)
- AbacatePay (somente cartão)

O projeto Next.js fica em `webapp/`.

Design system de referência: `design-system/`.

## Precificação

Controlada por variáveis de ambiente (ver `webapp/.env.example`):

- 1 obra / 3 obras / 5 obras (mensal)
- E-mail adicional por obra (1º incluso)

## Credenciais e ambiente

Segredos e chaves **não** ficam neste repositório. Copie `webapp/.env.example` para `webapp/.env.local` e preencha com os valores do dashboard (Supabase, AbacatePay, Resend, etc.).

## Documentação

- [BRIEFING.md](BRIEFING.md) — requisitos (prevalece em conflito)
- [PLANO-EXECUCAO-CURSOR.md](PLANO-EXECUCAO-CURSOR.md) — plano operacional
- [PROGRESS.md](PROGRESS.md) — status de execução
