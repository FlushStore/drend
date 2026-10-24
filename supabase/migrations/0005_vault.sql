-- DREND · Notas dos vaults Obsidian do Rapha (Segundo Cérebro e Rapha OS Business).
-- Uma tarefa agendada lê os repositórios dos vaults no GitHub e grava aqui pelo /api/vault
-- (POST com o token dos agentes). O app lê pelo mesmo endereço, com o login do Rapha.
-- Notas marcadas como "sensitive" no vault não entram. Só o servidor lê e grava (chave de
-- serviço): sem política para o app. Aplicar só no projeto Supabase do DREND.

create table public.drend_vault (
  vault          text not null check (vault ~ '^[a-z0-9-]{1,40}$'),
  caminho        text not null check (length(caminho) between 4 and 400),
  titulo         text not null,
  pasta          text not null default '',
  tipo           text,
  status         text,
  projeto        text,
  papel          text,
  proxima        text,
  tags           text[] not null default '{}',
  resumo         text not null default '',
  corpo          text not null default '',
  modificado     date,
  atualizado_em  timestamptz not null default now(),
  primary key (vault, caminho)
);

create index drend_vault_modificado on public.drend_vault (modificado desc nulls last);

-- Uma linha por vault: de qual commit veio a última leitura e quantas notas tinha.
create table public.drend_vault_leitura (
  vault          text primary key check (vault ~ '^[a-z0-9-]{1,40}$'),
  nome           text not null,
  commit_sha     text,
  commit_em      timestamptz,
  notas          integer not null default 0,
  atualizado_em  timestamptz not null default now()
);

alter table public.drend_vault enable row level security;
alter table public.drend_vault_leitura enable row level security;
grant select, insert, update, delete on public.drend_vault to service_role;
grant select, insert, update, delete on public.drend_vault_leitura to service_role;
