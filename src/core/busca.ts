/**
 * Busca em tudo: funções puras que a busca da casca usa. Recebem o que já existe (tarefas,
 * cartões do Mural, missões, agenda) e devolvem os achados agrupados, com o trecho marcado.
 * Sem acento e sem maiúscula: "reuniao" acha "Reunião".
 */
import type { Compromisso } from "./agenda";
import type { Board, Card } from "./mural";
import { projetos, type EventoMissao, type Fase } from "./missao";
import type { Tarefa } from "./tarefas";

export type TipoDeAchado = "tarefa" | "cartao" | "missao" | "agenda";

/** Ordem e nome dos grupos na busca. */
export const GRUPOS: ReadonlyArray<{ tipo: TipoDeAchado; titulo: string }> = [
  { tipo: "tarefa", titulo: "Tarefas" },
  { tipo: "cartao", titulo: "Mural" },
  { tipo: "missao", titulo: "Missões" },
  { tipo: "agenda", titulo: "Agenda" },
];

/** Para onde levar quem escolhe o achado. */
export type Destino =
  | { tela: "hoje"; tarefa: string }
  | { tela: "mural"; cartao: string }
  | { tela: "missoes"; projeto: string; item: string | null }
  | { tela: "vida"; compromisso: Compromisso };

export interface Pesquisavel {
  tipo: TipoDeAchado;
  id: string;
  titulo: string;
  /** Texto que também é buscado (corpo do cartão, local do compromisso). */
  texto?: string | null;
  /** Linha de apoio na lista (quadro, projeto, dia). Não entra na busca. */
  apoio?: string;
  destino: Destino;
}

export interface Parte {
  t: string;
  marca: boolean;
}

export interface Achado extends Pesquisavel {
  pontos: number;
  tituloMarcado: Parte[];
  /** O pedaço do texto onde a busca casou, se casou no texto. */
  trecho: Parte[] | null;
}

export interface GrupoDeAchados {
  tipo: TipoDeAchado;
  titulo: string;
  achados: Achado[];
}

const MARCAS = /[̀-ͯ]/g;
const dobrar = (c: string) => c.normalize("NFD").replace(MARCAS, "").toLowerCase();

/** Minúsculas e sem acento. */
export function normalizar(texto: string): string {
  return dobrar(texto);
}

/** Versão normalizada e, para cada caractere dela, a posição no original (para marcar o trecho). */
function mapear(texto: string): { n: string; pos: number[] } {
  let n = "";
  const pos: number[] = [];
  let i = 0;
  for (const c of texto) {
    const d = dobrar(c);
    for (let k = 0; k < d.length; k++) pos.push(i);
    n += d;
    i += c.length;
  }
  pos.push(texto.length);
  return { n, pos };
}

/** As palavras da consulta, normalizadas e sem repetir. */
export function termos(consulta: string): string[] {
  return [...new Set(normalizar(consulta).split(/\s+/).filter(Boolean))];
}

/** Intervalos [início, fim) do texto original onde cada termo aparece, já unidos. */
function intervalos(texto: string, ts: readonly string[]): Array<[number, number]> {
  const { n, pos } = mapear(texto);
  const r: Array<[number, number]> = [];
  for (const t of ts) {
    for (let i = n.indexOf(t); i >= 0; i = n.indexOf(t, i + t.length)) r.push([pos[i], pos[i + t.length]]);
  }
  r.sort((a, b) => a[0] - b[0]);
  const unidos: Array<[number, number]> = [];
  for (const iv of r) {
    const u = unidos[unidos.length - 1];
    if (u && iv[0] <= u[1]) u[1] = Math.max(u[1], iv[1]);
    else unidos.push([...iv]);
  }
  return unidos;
}

/** O texto em partes, com as que casaram marcadas. */
export function marcar(texto: string, ts: readonly string[]): Parte[] {
  const partes: Parte[] = [];
  let i = 0;
  for (const [a, b] of intervalos(texto, ts)) {
    if (a > i) partes.push({ t: texto.slice(i, a), marca: false });
    partes.push({ t: texto.slice(a, b), marca: true });
    i = b;
  }
  if (i < texto.length) partes.push({ t: texto.slice(i), marca: false });
  return partes;
}

/** O pedaço de um texto longo em volta do primeiro termo achado, com reticências. */
export function trechoDe(texto: string, ts: readonly string[], raio = 36): Parte[] | null {
  const limpo = texto.replace(/\s+/g, " ").trim();
  const ivs = intervalos(limpo, ts);
  if (!ivs.length) return null;
  const [a, b] = ivs[0];
  let ini = Math.max(0, a - raio);
  let fim = Math.min(limpo.length, b + raio * 2);
  // Corta em espaço, para não partir palavra.
  if (ini > 0) {
    const e = limpo.indexOf(" ", ini);
    if (e >= 0 && e < a) ini = e + 1;
  }
  if (fim < limpo.length) {
    const e = limpo.lastIndexOf(" ", fim);
    if (e > b) fim = e;
  }
  const partes = marcar(limpo.slice(ini, fim), ts);
  if (ini > 0) partes.unshift({ t: "…", marca: false });
  if (fim < limpo.length) partes.push({ t: "…", marca: false });
  return partes;
}

/** Quanto um termo vale num campo: início do campo > início de palavra > meio de palavra. 0 = não está. */
function valor(campo: string, t: string): number {
  let melhor = 0;
  for (let i = campo.indexOf(t); i >= 0; i = campo.indexOf(t, i + 1)) {
    if (i === 0) return 3;
    melhor = Math.max(melhor, /[a-z0-9]/.test(campo[i - 1]) ? 1 : 2);
  }
  return melhor;
}

/**
 * Pontos de um item para a consulta. Todos os termos precisam aparecer (no título ou no
 * texto); o título vale mais que o texto, e o título igual à consulta vale mais que tudo.
 */
export function pontuar(item: Pick<Pesquisavel, "titulo" | "texto">, ts: readonly string[]): number {
  if (!ts.length) return 0;
  const titulo = normalizar(item.titulo);
  const texto = normalizar(item.texto ?? "");
  let soma = 0;
  for (const t of ts) {
    const v = Math.max(valor(titulo, t) * 3, valor(texto, t));
    if (!v) return 0;
    soma += v;
  }
  const inteira = ts.join(" ");
  if (titulo === inteira) soma += 20;
  else if (titulo.startsWith(inteira)) soma += 10;
  return soma;
}

/** Busca nos itens e agrupa por tipo, na ordem de GRUPOS. Grupo sem achado não aparece. */
export function buscar(itens: readonly Pesquisavel[], consulta: string, limite = 8): GrupoDeAchados[] {
  const ts = termos(consulta);
  if (!ts.length) return [];
  const porTipo = new Map<TipoDeAchado, Achado[]>();
  for (const item of itens) {
    const pontos = pontuar(item, ts);
    if (!pontos) continue;
    const lista = porTipo.get(item.tipo) ?? [];
    lista.push({ ...item, pontos, tituloMarcado: marcar(item.titulo, ts), trecho: item.texto ? trechoDe(item.texto, ts) : null });
    porTipo.set(item.tipo, lista);
  }
  return GRUPOS.flatMap(({ tipo, titulo }) => {
    const achados = porTipo.get(tipo);
    if (!achados?.length) return [];
    // Mais pontos primeiro; empate fica na ordem em que veio (a de cada fonte).
    const ordenados = achados.map((a, i) => ({ a, i })).sort((x, y) => y.a.pontos - x.a.pontos || x.i - y.i).map((x) => x.a);
    return [{ tipo, titulo, achados: ordenados.slice(0, limite) }];
  });
}

// ---------- De cada fonte para o que a busca entende ----------

/** Só as abertas: são as que aparecem em "Para você", no Hoje. */
export function dasTarefas(tarefas: readonly Tarefa[]): Pesquisavel[] {
  return tarefas
    .filter((t) => !t.feitaEm)
    .map((t) => ({ tipo: "tarefa", id: t.id, titulo: t.texto, apoio: "Para você", destino: { tela: "hoje", tarefa: t.id } }));
}

export function doMural(estado: { boards: Record<string, Board>; cards: Record<string, Card> }): Pesquisavel[] {
  return Object.values(estado.cards).map((c) => ({
    tipo: "cartao",
    id: c.id,
    titulo: c.title,
    texto: c.body ?? null,
    apoio: estado.boards[c.boardId]?.title,
    destino: { tela: "mural", cartao: c.id },
  }));
}

const FASES: Record<Fase, string> = { agora: "Em andamento", depois: "Depois", feito: "Feito" };

/** Os projetos e os itens deles, como a tela de Missões mostra. */
export function dasMissoes(eventos: readonly EventoMissao[], agora = new Date()): Pesquisavel[] {
  return projetos(eventos, agora).flatMap((p) => [
    { tipo: "missao" as const, id: p.missao, titulo: p.nome, apoio: p.pausado ? "Projeto pausado" : "Projeto", destino: { tela: "missoes" as const, projeto: p.nome, item: null } },
    ...(["agora", "depois", "feito"] as const).flatMap((f) =>
      p.itens[f].map((i) => ({
        tipo: "missao" as const,
        id: `${p.missao}/${i.chave}`,
        titulo: i.titulo,
        texto: i.texto,
        apoio: `${p.nome} · ${FASES[f]}`,
        destino: { tela: "missoes" as const, projeto: p.nome, item: i.titulo },
      })),
    ),
  ]);
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "sex., 24/10 · 14:30" ou "sex., 24/10 · dia inteiro". */
export function quandoDe(c: Compromisso): string {
  const d = new Date(c.diaInteiro ? `${c.dia}T12:00:00` : c.inicio);
  const dia = `${d.toLocaleDateString("pt-BR", { weekday: "short" })}, ${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
  return `${dia} · ${c.diaInteiro ? "dia inteiro" : `${dois(d.getHours())}:${dois(d.getMinutes())}`}`;
}

export function daAgenda(compromissos: readonly Compromisso[]): Pesquisavel[] {
  return [...compromissos]
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((c) => ({ tipo: "agenda", id: c.id, titulo: c.titulo, texto: c.local, apoio: quandoDe(c), destino: { tela: "vida", compromisso: c } }));
}
