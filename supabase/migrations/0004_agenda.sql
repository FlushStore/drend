-- DREND · Agenda sincronizada pelo conector do Google Agenda.
-- Uma tarefa agendada lê a agenda do Rapha a cada hora e grava aqui pelo /api/agenda (POST com
-- o token dos agentes). Uma linha por fonte, com os compromissos dos próximos dias já
-- normalizados. Só o servidor lê e grava (chave de serviço): sem política para o app.
-- Aplicar só no projeto Supabase do DREND.

create table public.drend_agenda (
  fonte          text primary key check (fonte ~ '^[a-z0-9-]{1,40}$'),
  eventos        jsonb not null default '[]'::jsonb check (jsonb_typeof(eventos) = 'array'),
  atualizado_em  timestamptz not null default now()
);

alter table public.drend_agenda enable row level security;
-- Acesso explícito para a Data API (o Supabase passa a exigir GRANT em tabelas novas).
grant select, insert, update, delete on public.drend_agenda to service_role;
