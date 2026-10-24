/**
 * Dinheiro pessoal do Rapha: o que ele conta no chat ("gastei 50 no mercado").
 * Só anota o que ele disse; não move dinheiro nenhum (nível B: automático com desfazer).
 * Funções puras: recebem a lista e devolvem outra, então desfazer é voltar à lista anterior.
 */
import { lerValor } from "./financeiro";
import { normalizar } from "./fala";
import { mesEmBrasilia } from "./brasilia";

export type TipoLancamento = "gasto" | "entrada";

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  /** Em reais, sempre positivo: o tipo diz o sinal. */
  valor: number;
  /** Como ele falou: "mercado", "uber", "freela". Vazio quando não disse. */
  descricao: string;
  /** Chave para agrupar: a descrição normalizada, ou "outros". */
  categoria: string;
  /** ISO do momento do lançamento. */
  em: string;
}

export type LancamentoLido = Pick<Lancamento, "tipo" | "valor" | "descricao">;

const GASTO = /^(?:eu\s+)?(?:gastei|paguei|comprei|torrei)\s+(.+)$/i;
const ENTRADA = /^(?:eu\s+)?(?:recebi|ganhei|entrou|entraram|caiu|ca[ií]ram)\s+(.+)$/i;
const VALOR = /^(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)(?:\s*(mil|k)\b)?(?:\s*(?:reais|real|conto|contos|pila|pilas)\b)?\s*(.*)$/i;
const LIGACAO = /^(?:no|na|nos|nas|num|numa|com|de|do|da|dos|das|em|pro|pra|para o|para a|para|pelo|pela|por|o|a)\s+/i;

/** "12,90", "1.200", "12.90", "2 mil" → reais. */
function numero(bruto: string, mil?: string): number | null {
  const t = /^\d+\.\d{1,2}$/.test(bruto) ? bruto.replace(".", ",") : bruto;
  return lerValor(mil ? `${t} mil` : t);
}

/** "gastei 12,90 com uber" → { gasto, 12.9, "uber" }. Sem valor na frase, não é lançamento. */
export function lerLancamento(frase: string): LancamentoLido | null {
  const t = frase.trim().replace(/\s+/g, " ");
  const g = t.match(GASTO);
  const e = g ? null : t.match(ENTRADA);
  const corpo = (g ?? e)?.[1].replace(/[.!?]+$/, "");
  if (!corpo) return null;
  const m = corpo.match(VALOR);
  if (!m) return null;
  const valor = numero(m[1], m[2]);
  if (!valor) return null;
  const descricao = m[3].replace(LIGACAO, "").replace(LIGACAO, "").replace(/^["“”']+|["“”'.!?]+$/g, "").trim();
  return { tipo: g ? "gasto" : "entrada", valor, descricao };
}

let seq = 0;
export function novoLancamento(l: LancamentoLido, agora = new Date()): Lancamento {
  const descricao = l.descricao ? l.descricao.charAt(0).toUpperCase() + l.descricao.slice(1) : "";
  return { id: `l${agora.getTime().toString(36)}-${++seq}`, tipo: l.tipo, valor: l.valor, descricao, categoria: normalizar(descricao) || "outros", em: agora.toISOString() };
}

export function adicionarLancamento(lista: readonly Lancamento[], l: Lancamento): Lancamento[] {
  return lista.some((x) => x.id === l.id) ? [...lista] : [...lista, l];
}

export function removerLancamento(lista: readonly Lancamento[], id: string): Lancamento[] {
  return lista.filter((l) => l.id !== id);
}

/** Retrato antigo ou corrompido: o que não for lançamento válido fica de fora. */
export function lerLancamentos(x: unknown): Lancamento[] {
  if (!Array.isArray(x)) return [];
  return x.filter(
    (l): l is Lancamento =>
      !!l && typeof l === "object" && typeof l.id === "string" && (l.tipo === "gasto" || l.tipo === "entrada") &&
      typeof l.valor === "number" && l.valor > 0 && Number.isFinite(l.valor) && typeof l.descricao === "string" &&
      typeof l.categoria === "string" && typeof l.em === "string" && !Number.isNaN(Date.parse(l.em)),
  );
}

const centavos = (v: number) => Math.round(v * 100);

export function doMes(lista: readonly Lancamento[], agora = new Date()): Lancamento[] {
  const mes = mesEmBrasilia(agora);
  return lista.filter((l) => mesEmBrasilia(l.em) === mes);
}

export interface SaldoDoMes { entradas: number; gastos: number; saldo: number; n: number }

/** Entradas − gastos do mês (Brasília), contado em centavos para não errar na vírgula. */
export function saldoDoMes(lista: readonly Lancamento[], agora = new Date()): SaldoDoMes {
  let e = 0;
  let g = 0;
  const mes = doMes(lista, agora);
  for (const l of mes) {
    if (l.tipo === "entrada") e += centavos(l.valor);
    else g += centavos(l.valor);
  }
  return { entradas: e / 100, gastos: g / 100, saldo: (e - g) / 100, n: mes.length };
}

export interface GastoPorCategoria { categoria: string; rotulo: string; total: number; n: number }

/** Gastos do mês agrupados, do maior para o menor. */
export function gastosPorCategoria(lista: readonly Lancamento[], agora = new Date()): GastoPorCategoria[] {
  const grupos = new Map<string, { rotulo: string; c: number; n: number }>();
  for (const l of doMes(lista, agora)) {
    if (l.tipo !== "gasto") continue;
    const g = grupos.get(l.categoria) ?? { rotulo: l.descricao || "Sem descrição", c: 0, n: 0 };
    g.c += centavos(l.valor);
    g.n += 1;
    grupos.set(l.categoria, g);
  }
  return [...grupos.entries()]
    .map(([categoria, g]) => ({ categoria, rotulo: g.rotulo, total: g.c / 100, n: g.n }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

/** Os mais novos primeiro. */
export function ultimos(lista: readonly Lancamento[], n = 10): Lancamento[] {
  return [...lista].sort((a, b) => b.em.localeCompare(a.em)).slice(0, n);
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function nomeDoLancamento(l: Pick<Lancamento, "tipo" | "descricao">): string {
  return l.descricao || (l.tipo === "gasto" ? "Gasto" : "Entrada");
}

/** A confirmação do chat: "Anotei: gasto de R$ 50 no mercado." */
export function confirmarLancamento(l: Lancamento, lista: readonly Lancamento[], agora = new Date()): string {
  const s = saldoDoMes(lista, agora);
  const oque = l.tipo === "gasto" ? `gasto de ${reais(l.valor)}` : `entrada de ${reais(l.valor)}`;
  const onde = l.descricao ? ` (${l.descricao})` : "";
  return `Anotei: ${oque}${onde}. Saldo do mês: ${s.saldo < 0 ? "-" : ""}${reais(Math.abs(s.saldo))}. Está em Vida.`;
}

/** "quanto gastei?" · "meu saldo". Sem lançamento, diz como começar. */
export function responderDinheiro(lista: readonly Lancamento[], agora = new Date()): string {
  const s = saldoDoMes(lista, agora);
  if (!s.n) return "Ainda não tenho nenhum lançamento seu neste mês. Diga “gastei 50 no mercado” ou “recebi 300 do freela” que eu anoto.";
  const linhas = [`Neste mês: entrou ${reais(s.entradas)}, saiu ${reais(s.gastos)}. Saldo: ${s.saldo < 0 ? "-" : ""}${reais(Math.abs(s.saldo))}.`];
  const top = gastosPorCategoria(lista, agora).slice(0, 3);
  if (top.length) linhas.push(`Onde mais gastou: ${top.map((g) => `${g.rotulo} ${reais(g.total)}`).join(", ")}.`);
  return linhas.join("\n");
}
