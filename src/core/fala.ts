/**
 * O jeito do Rapha escrever: rápido, sem acento, com abreviação ("vc", "pra", "q", "hj").
 * `normalizar` deixa a frase num formato só, para os leitores de comando não precisarem
 * prever cada variação. Serve só para reconhecer a intenção: o texto que vira tarefa ou
 * ideia continua com as palavras dele.
 */

const GIRIAS: Record<string, string> = {
  vc: "voce",
  vcs: "voces",
  voce: "voce",
  pra: "para",
  pro: "para o",
  pros: "para os",
  ta: "esta",
  tah: "esta",
  to: "estou",
  tou: "estou",
  q: "que",
  oq: "o que",
  oque: "o que",
  hj: "hoje",
  hoj: "hoje",
  amn: "amanha",
  td: "tudo",
  tds: "todos",
  mt: "muito",
  mto: "muito",
  n: "nao",
  num: "nao",
  tb: "tambem",
  tbm: "tambem",
  pf: "por favor",
  pfv: "por favor",
  pfvr: "por favor",
  qnt: "quanto",
  qto: "quanto",
  qnto: "quanto",
  dps: "depois",
  msg: "mensagem",
  cmg: "comigo",
  blz: "beleza",
  vlw: "valeu",
  obg: "obrigado",
  brigado: "obrigado",
  eai: "e ai",
  ae: "ai",
  tmj: "tamo junto",
  flu: "flush",
  flushstore: "flush",
};

/** Minúsculas, sem acento, sem pontuação, gírias expandidas, espaços simples. */
export function normalizar(texto: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return base.map((p) => GIRIAS[p] ?? p).join(" ");
}

/** Palavras que não ajudam a achar uma tarefa ("o", "de", "pra"...). */
const VAZIAS = new Set("a o as os de do da dos das para com e um uma uns umas no na nos nas em que ja meu minha meus minhas isso essa esse ai la por tarefa".split(" "));

/** As palavras que contam de uma frase, já normalizadas. */
export function palavras(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p && !VAZIAS.has(p));
}

/** "paguei" e "pagar", "fornecedor" e "fornecedores": mesma raiz, mesma palavra. */
function parecidas(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.slice(0, 3) === b.slice(0, 3);
}

/** De 0 a 1: quanto da `consulta` aparece em `texto`. */
export function semelhanca(consulta: string, texto: string): number {
  const q = palavras(consulta);
  if (!q.length) return 0;
  const t = palavras(texto);
  const achadas = q.filter((p) => t.some((x) => parecidas(p, x))).length;
  return achadas / q.length;
}

/**
 * Acha o item que a frase descreve. Devolve um só quando ele se destaca; se dois
 * empatam, devolve os dois para o DREND perguntar qual é, em vez de chutar.
 */
export function acharPorTexto<T>(itens: readonly T[], consulta: string, texto: (i: T) => string): { achado: T } | { empate: T[] } | null {
  const notas = itens.map((i) => ({ i, n: semelhanca(consulta, texto(i)) })).filter((x) => x.n >= 0.6);
  if (!notas.length) return null;
  const melhor = Math.max(...notas.map((x) => x.n));
  const topo = notas.filter((x) => x.n === melhor).map((x) => x.i);
  return topo.length === 1 ? { achado: topo[0] } : { empate: topo };
}
