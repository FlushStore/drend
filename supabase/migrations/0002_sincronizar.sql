-- DREND · sincronizar entre aparelhos + trava "só o Rapha"
-- Aplicar depois da 0001, no projeto Supabase do DREND. Nunca nos da Flush ou da Vape Mania.

-- Só o e-mail do Rapha passa. Outra conta pode até existir no Auth, mas não lê nem grava nada.
create or replace function public.drend_e_o_rapha() returns boolean
language sql stable
as $$ select coalesce(auth.jwt() ->> 'email', '') = 'raphaelkhevenn@gmail.com' $$;

-- Retrato do app (mural + log + caixa + conversa), um por dono. É o que o app sincroniza hoje;
-- as tabelas da 0001 recebem as operações uma a uma quando a IA entrar (Fase 6).
create table drend_estado (
  owner_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table drend_estado enable row level security;
create policy dono on drend_estado for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Trava em cima de tudo (restritiva: soma com as políticas "dono").
create policy so_rapha on drend_estado as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());
create policy so_rapha on boards       as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());
create policy so_rapha on cards        as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());
create policy so_rapha on links        as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());
create policy so_rapha on inbox_items  as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());
create policy so_rapha on action_log   as restrictive for all using (drend_e_o_rapha()) with check (drend_e_o_rapha());

-- Ninguém além do Rapha cria conta no Auth do DREND.
create or replace function public.drend_barrar_cadastro() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if lower(new.email) <> 'raphaelkhevenn@gmail.com' then
    raise exception 'DREND é pessoal: cadastro fechado';
  end if;
  return new;
end $$;

create trigger drend_so_rapha before insert on auth.users
  for each row execute function public.drend_barrar_cadastro();
