-- 20260928220001_financeiro_enums.sql
-- Novos valores de enum em arquivo separado: um valor adicionado só pode ser
-- usado depois do commit da transação que o criou.

alter type public.lancamento_tipo add value if not exists 'supressao';
alter type public.lancamento_grupo add value if not exists 'supressoes';
