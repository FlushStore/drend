-- DREND · fundação do banco (Fase 4)
-- NÃO APLICADA. Vai para um projeto Supabase novo, só do DREND, depois do "pode" do Rapha.
-- Nunca aplicar nos projetos da Flush ou da Vape Mania.
--
-- O banco guarda só o que é do DREND: mural, caixa de entrada e log de ações.
-- E-mails, vendas, extratos e fotos continuam na fonte; aqui ficam referências.

create type drend_space as enum ('pessoal', 'empresarial');
create type drend_actor as enum ('rapha', 'drend', 'claude', 'chatgpt');

create table boards (
  id          text primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  space       drend_space not null,
  project     text not null,               -- flushstore, vape-mania, drend, vida...
  title       text not null,
  tags        text[] not null default '{}',
  vault_path  text,                        -- nota espelho no vault, quando houver
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table cards (
  id          text primary key,
  board_id    text not null references boards (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('nota', 'imagem', 'link', 'pdf', 'audio', 'campanha')),
  title       text not null,
  body        text,
  source      text,                        -- link ou arquivo original; o conteúdo de terceiros não é copiado
  x           real not null default 0,
  y           real not null default 0,
  w           real not null default 240,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table links (
  id          text primary key,
  board_id    text not null references boards (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_card   text not null references cards (id) on delete cascade,
  to_card     text not null references cards (id) on delete cascade,
  label       text,
  check (from_card <> to_card)
);

-- "Tive uma ideia": cai aqui até o Rapha dizer o destino.
create table inbox_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null,
  origin      text not null,               -- voz, chat, whatsapp, email...
  audio_url   text,
  board_id    text references boards (id) on delete set null,  -- preenchido quando classificada
  created_at  timestamptz not null default now(),
  filed_at    timestamptz
);

-- Toda ação de qualquer agente, com o inverso para desfazer.
create table action_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at          timestamptz not null default now(),
  actor       drend_actor not null,
  action      text not null,               -- ex.: mural.criar, ler.extrato
  level       char(1) not null check (level in ('A', 'B', 'C', 'D')),
  status      text not null check (status in ('proposta', 'feita', 'falhou', 'desfeita')),
  summary     text not null,
  op          jsonb,
  inverse     jsonb,
  source      text                         -- de onde veio o pedido ou o dado
);

create index cards_board on cards (board_id);
create index links_board on links (board_id);
create index inbox_open on inbox_items (owner_id) where filed_at is null;
create index log_recent on action_log (owner_id, at desc);

alter table boards       enable row level security;
alter table cards        enable row level security;
alter table links        enable row level security;
alter table inbox_items  enable row level security;
alter table action_log   enable row level security;

create policy dono on boards      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dono on cards       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dono on links       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dono on inbox_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- O log só cresce: dá para ler e inserir, nunca editar nem apagar pelo app.
create policy ler on action_log    for select using (owner_id = auth.uid());
create policy inserir on action_log for insert with check (owner_id = auth.uid());
