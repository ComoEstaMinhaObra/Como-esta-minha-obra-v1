# Pendência pré-lançamento — frequência do cron da outbox

**Status em 2026-09-15:** temporariamente adaptado ao plano Vercel Hobby.

O cron `/api/cron/outbox` está configurado em `webapp/vercel.json` para rodar
uma vez por dia, às 10:00 UTC (`0 10 * * *`). O plano Hobby não aceita cron
jobs com frequência maior que uma execução diária.

## Revisão obrigatória antes do lançamento

Restaurar o processamento frequente da outbox, preferencialmente a cada cinco
minutos (`*/5 * * * *`), escolhendo uma destas opções:

1. migrar o projeto para Vercel Pro; ou
2. manter a Vercel Hobby e acionar a rota por um agendador externo confiável,
   enviando `Authorization: Bearer <CRON_SECRET>`.

Enquanto o agendamento for diário, cobranças de e-mails adicionais normalmente
continuam sendo processadas no momento da ação do usuário. Porém, uma operação
que fique pendente por falha transitória poderá levar até 24 horas para ser
recuperada automaticamente.

## Critério de conclusão

- o processador roda no mínimo a cada cinco minutos;
- o deploy de produção aceita a configuração;
- uma operação pendente de teste é processada na execução seguinte;
- esta pendência é marcada como concluída com a solução adotada e a data.
