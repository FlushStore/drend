-- DREND · Avisos no iPhone (Web Push do PWA).
-- drend_push: uma linha por aparelho que ligou os avisos (a inscrição que o navegador devolve).
-- drend_avisado: o que já foi avisado (compromisso, resumo do dia), para não avisar duas vezes.
-- Só o servidor lê e grava (chave de serviço): sem política para o app.
-- Aplicar só no projeto Supabase do DREND.

create table public.drend_push (
  endpoint   text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  inscricao  jsonb not null,
  criado_em  timestamptz not null default now()
);

create table public.drend_avisado (
  chave  text primary key check (char_length(chave) <= 300),
  em     timestamptz not null default now()
);

alter table public.drend_push enable row level security;
alter table public.drend_avisado enable row level security;
grant select, insert, update, delete on public.drend_push to service_role;
grant select, insert, update, delete on public.drend_avisado to service_role;
