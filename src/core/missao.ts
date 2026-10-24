/**
 * Missões ao vivo (Central de IAs). O banco guarda eventos; aqui eles viram o estado de
 * cada projeto: o que está em andamento, o que foi feito, o que vem depois, e há quanto
 * tempo ninguém mexe. Funções puras: o app e os testes usam as mesmas.
 */
export type Fase = "feito" | "agora" | "depois";
export type Agente = "rapha" | "drend" | "claude" | "chatgpt" | "codex";

export interface EventoMissao {
  id: number;
  em: string;
  missao: string;
  agente: Agente;
  tipo: "item" | "nota" | "decisao" | "pergunta";
  chave: string | null;
  titulo: string;
  texto: string | null;
  fase: Fase | null;
  ref: string | null;
}

export interface ItemMissao {
  chave: string;
  titulo: string;
  texto: string | null;
  fase: Fase;
  ref: string | null;
  em: string;
  agente: Agente;
}

export interface Projeto {
  missao: string;
  nome: string;
  itens: Record<Fase, ItemMissao[]>;
  ultimo: EventoMissao | null;
  /** Dias inteiros desde o último evento. */
  parado: number | null;
  /** O Rapha pôs o projeto na gaveta (decisão com chave "pausa"): não ganha aviso de parado. */
  pausado: boolean;
}

export const NOMES: Record<string, string> = {
  drend: "DREND",
  flush: "FlushStore",
  "vape-mania": "Vape Mania",
  flushfinance: "FlushFinance",
  "doce-fornada": "Doce Fornada",
  "black-store": "Black Store",
};
/** Ordem fixa: o que é dele primeiro. Missão nova (de uma IA) entra no fim. */
const ORDEM = ["drend", "flush", "vape-mania", "flushfinance"];
/** Sem evento há tantos dias: o projeto ganha o aviso de parado. */
export const DIAS_PARADO = 5;

/** Decisões que ligam e desligam a pausa de um projeto. */
export const CHAVE_PAUSA = "pausa";
export const CHAVE_RETOMADA = "retomada";

export const nomeDaMissao = (m: string) => NOMES[m] ?? m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, " ");

export function projetos(eventos: readonly EventoMissao[], agora = new Date()): Projeto[] {
  const ordenados = [...eventos].sort((a, b) => a.em.localeCompare(b.em) || a.id - b.id);
  const mapa = new Map<string, { itens: Map<string, ItemMissao>; ultimo: EventoMissao | null; pausado: boolean }>();
  for (const m of ORDEM) mapa.set(m, { itens: new Map(), ultimo: null, pausado: false });
  for (const e of ordenados) {
    const p = mapa.get(e.missao) ?? { itens: new Map(), ultimo: null, pausado: false };
    mapa.set(e.missao, p);
    p.ultimo = e;
    if (e.tipo === "decisao" && e.chave === CHAVE_PAUSA) p.pausado = true;
    if (e.tipo === "decisao" && e.chave === CHAVE_RETOMADA) p.pausado = false;
    if (e.tipo === "item" && e.chave && e.fase) {
      const antes = p.itens.get(e.chave);
      // Um evento de item pode só mudar a fase: o que ele não traz vem do anterior.
      p.itens.set(e.chave, {
        chave: e.chave,
        titulo: e.titulo || antes?.titulo || e.chave,
        texto: e.texto ?? antes?.texto ?? null,
        ref: e.ref ?? antes?.ref ?? null,
        fase: e.fase,
        em: e.em,
        agente: e.agente,
      });
    }
  }
  const lista = [...mapa.entries()].map(([missao, p]) => {
    const itens: Record<Fase, ItemMissao[]> = { agora: [], depois: [], feito: [] };
    for (const i of p.itens.values()) itens[i.fase].push(i);
    itens.feito.sort((a, b) => b.em.localeCompare(a.em));
    const parado = p.ultimo ? Math.floor((agora.getTime() - new Date(p.ultimo.em).getTime()) / 864e5) : null;
    return { missao, nome: nomeDaMissao(missao), itens, ultimo: p.ultimo, parado, pausado: p.pausado };
  });
  // Os da gaveta vão para o fim, sem perder a ordem entre eles.
  return [...lista.filter((p) => !p.pausado), ...lista.filter((p) => p.pausado)];
}

/** Projeto vivo sem passo há DIAS_PARADO dias ou mais: é o que o Rapha esqueceu. */
export const estaParado = (p: Projeto) => !p.pausado && p.parado !== null && p.parado >= DIAS_PARADO;

/** Item em andamento sem evento novo há DIAS_PARADO dias: começou e ficou para trás. */
export const itemParado = (i: ItemMissao, agora = new Date()) => i.fase === "agora" && agora.getTime() - new Date(i.em).getTime() >= DIAS_PARADO * 864e5;

/**
 * Onde o Rapha parou: o projeto vivo mexido por último e o item em andamento mais recente
 * dele. É a resposta para "eu estava fazendo o quê?".
 */
export function ondeParou(lista: readonly Projeto[]): { projeto: Projeto; item: ItemMissao | null } | null {
  const vivos = lista.filter((p) => p.ultimo && !p.pausado);
  if (!vivos.length) return null;
  const projeto = vivos.reduce((a, b) => (b.ultimo!.em.localeCompare(a.ultimo!.em) > 0 || (b.ultimo!.em === a.ultimo!.em && b.ultimo!.id > a.ultimo!.id) ? b : a));
  const item = [...projeto.itens.agora].sort((a, b) => b.em.localeCompare(a.em))[0] ?? null;
  return { projeto, item };
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 9 dias". */
export function haQuanto(iso: string, agora = new Date()): string {
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export const NOME_AGENTE: Record<Agente, string> = { rapha: "Você", drend: "DREND", claude: "Claude", chatgpt: "ChatGPT", codex: "Codex" };
