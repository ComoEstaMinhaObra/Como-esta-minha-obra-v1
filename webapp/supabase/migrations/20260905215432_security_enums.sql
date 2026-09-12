-- 20260905215432_security_enums.sql
-- Somente novos valores e tipos. Não usar os valores novos neste arquivo.

alter type public.relatorio_status add value 'processando';
alter type public.acesso_status add value 'pendente_cobranca';
alter type public.acesso_status add value 'revogado';

create type public.versao_status as enum ('processando', 'publicada', 'falhou');
create type public.versao_tipo as enum ('original', 'retificacao');
create type public.foto_estado as enum ('reservada', 'publicada');
create type public.outbox_status as enum (
  'pendente',
  'processando',
  'confirmado',
  'falhou',
  'incerto',
  'cancelado'
);
create type public.outbox_operacao as enum ('add', 'subtract');
