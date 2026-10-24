-- DREND · Central de IAs: a missão ao vivo.
-- Cada linha é um evento: uma IA (ou o Rapha) cria ou move um item do plano, deixa uma nota,
-- registra uma decisão ou faz uma pergunta. O app lê o estado do plano somando os eventos
-- e recebe os novos em tempo real. Só o Rapha lê pelo app; as IAs gravam pelo /api/missao,
-- que confere um token e usa a chave de serviço no servidor (nunca no navegador).
-- Aplicar só no projeto Supabase do DREND.

create table public.drend_missao (
  id      bigint generated always as identity primary key,
  em      timestamptz not null default now(),
  missao  text not null default 'drend' check (missao ~ '^[a-z0-9-]{1,40}$'),
  agente  text not null check (agente in ('rapha', 'drend', 'claude', 'chatgpt', 'codex')),
  tipo    text not null check (tipo in ('item', 'nota', 'decisao', 'pergunta')),
  -- Item do plano: a chave é estável; o último evento da chave diz a fase.
  chave   text check (chave ~ '^[a-z0-9-]{1,60}$'),
  titulo  text not null check (char_length(titulo) between 1 and 200),
  texto   text check (char_length(texto) <= 2000),
  fase    text check (fase in ('feito', 'agora', 'depois')),
  ref     text check (ref ~ '^https://' and char_length(ref) <= 500),
  check (tipo <> 'item' or (chave is not null and fase is not null))
);

create index drend_missao_recentes on public.drend_missao (missao, em desc);

alter table public.drend_missao enable row level security;
-- Painel de uma pessoa só: a trava é o e-mail do Rapha (função da 0002).
create policy ler on public.drend_missao for select using (public.drend_e_o_rapha());
create policy inserir on public.drend_missao for insert with check (public.drend_e_o_rapha());
-- Sem update nem delete: o histórico só cresce. Mudar de fase é um evento novo.

alter publication supabase_realtime add table public.drend_missao;

-- O plano da Missão DREND como estava em 24/10/2026.
insert into public.drend_missao (agente, tipo, chave, fase, titulo, texto, ref) values
  ('claude', 'item', 'plano',          'feito',  'Plano, avaliação técnica e protótipo', 'Fases 1 a 3, aprovadas em 23/10.', 'https://claude.ai/artifact/L2bA4kabisTr4k1EoLGRX6'),
  ('claude', 'item', 'no-ar',          'feito',  'DREND no ar', 'Vercel + Supabase grátis, login só seu, sincroniza entre aparelhos.', 'https://drend.vercel.app'),
  ('claude', 'item', 'dossie',         'feito',  'Dossiê e hub no Obsidian', '02 - Projects/DREND, com fonte e confiança em cada item.', null),
  ('claude', 'item', 'flush-real',     'agora',  'Números reais da Flush', 'Pronto. Esperando o seu merge.', 'https://github.com/FlushStore/drend/pull/4'),
  ('claude', 'item', 'tarefas-mural',  'agora',  'Tarefas e Mural editável', 'Pronto. Esperando o seu merge.', 'https://github.com/FlushStore/drend/pull/5'),
  ('claude', 'item', 'conversa',       'agora',  'Conversa que entende seu jeito de escrever', 'Pronto. Esperando o seu merge.', 'https://github.com/FlushStore/drend/pull/6'),
  ('claude', 'item', 'central-ias',    'agora',  'Central de IAs: missão ao vivo', 'As IAs registram cada passo e o DREND mostra na hora.', null),
  ('claude', 'item', 'status-vm',      'agora',  'Status da Vape Mania', 'Site no ar, tempo de resposta e banco.', null),
  ('claude', 'item', 'cerebro',        'agora',  'Cérebro animado', 'Rede neural em 3D que acende quando o DREND pensa.', null),
  ('claude', 'item', 'ia-real',        'depois', 'IA de verdade na conversa', 'Claude respondendo dentro do DREND. Tem custo: precisa do seu ok.', null),
  ('claude', 'item', 'financeiro',     'depois', 'Financeiro', 'Mês da Flush, lucro, metas; contas pessoais só leitura.', null),
  ('claude', 'item', 'agenda',         'depois', 'Google Agenda no Hoje', null, null),
  ('claude', 'item', 'vault',          'depois', 'DREND lê o Obsidian', null, null),
  ('claude', 'item', 'resumo-diario',  'depois', 'Resumo ao meio-dia no iPhone', null, null),
  ('claude', 'item', 'voz',            'depois', 'Voz e Alexa', null, null),
  ('claude', 'nota', null,             null,     'Missão DREND cadastrada', 'Daqui para frente, cada passo aparece aqui na hora.', null);

-- Os outros projetos começam com o que se sabe em 24/10/2026; o resto entra como evento.
insert into public.drend_missao (missao, agente, tipo, chave, fase, titulo, texto) values
  ('vape-mania',   'claude', 'item', 'lancamento', 'agora', 'Loja no ar', 'O Rapha disse em 24/10: entra no ar nesta semana.'),
  ('flush',        'claude', 'nota', null, null, 'Missão da Flush criada', 'Set e out/2026 foram um período de hibernação. O próximo passo entra aqui.'),
  ('flushfinance', 'claude', 'nota', null, null, 'Missão do FlushFinance criada', 'O próximo passo entra aqui.');
