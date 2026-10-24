-- DREND · Leituras copiadas pelo servidor (hoje: o resumo diário da Flush).
-- Uma tarefa agendada lê a Flush só com SELECT e grava aqui pelo /api/flush (token dos agentes).
-- Assim o app mostra os números reais mesmo num aparelho sem o login da Flush.
-- Só o servidor lê e grava (chave de serviço): sem política para o app.
-- Aplicar só no projeto Supabase do DREND.

create table public.drend_leitura (
  fonte          text primary key check (fonte ~ '^[a-z0-9-]{1,40}$'),
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

alter table public.drend_leitura enable row level security;
grant select, insert, update, delete on public.drend_leitura to service_role;
