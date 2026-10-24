/**
 * O mês da Flush: faturamento, lucro, margem, comparação com o mês passado e meta.
 * Funções puras sobre os dias que a leitura da Flush já calculou (as mesmas regras do
 * Início do Control OS). A comparação é justa: o mês passado só até o mesmo dia.
 */
import type { DiaFlush } from "../fontes/flush-regras";

export interface Totais {
  valor: number;
  lucro: number;
  pedidos: number;
}

export interface MesFlush {
  /** "outubro" */
  nome: string;
  /** Do dia 1 até hoje. */
  atual: Totais;
  /** Dias já passados no mês (hoje conta). */
  diasPassados: number;
  diasNoMes: number;
  /** Lucro / faturamento; null sem venda. */
  margem: number | null;
  /** Faturamento / pedidos; null sem pedido. */
  ticket: number | null;
  /** No ritmo de agora, quanto fecha o mês. */
  projecao: number;
  melhor: DiaFlush | null;
  anterior: {
    nome: string;
    /** Do dia 1 até o mesmo dia de hoje (ou o último dia, se o mês passado for mais curto). */
    ateHoje: Totais;
    total: Totais;
  };
  /** Variação do faturamento contra o mês passado até o mesmo dia; null sem base. */
  variacao: number | null;
}

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dois = (n: number) => String(n).padStart(2, "0");
const arred = (v: number) => Math.round(v * 100) / 100;

function somar(dias: readonly DiaFlush[]): Totais {
  return dias.reduce((t, d) => ({ valor: arred(t.valor + d.valor), lucro: arred(t.lucro + d.lucro), pedidos: t.pedidos + d.pedidos }), { valor: 0, lucro: 0, pedidos: 0 });
}

/** Dia 1 do mês anterior, no formato do histórico. É de onde a leitura começa. */
export function inicioDoMesAnterior(agora = new Date()): string {
  const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 12);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-01`;
}

/** O mês de agora a partir do histórico diário. null quando o histórico não cobre o mês. */
export function resumirMes(historico: readonly DiaFlush[], agora = new Date()): MesFlush | null {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const prefixo = `${ano}-${dois(mes + 1)}-`;
  // Leitura antiga (aberto sem internet, atualização falhou): o mês vale até o último dia lido,
  // senão a comparação e a projeção dividem dias que não estão no histórico.
  const ultimo = historico.length ? historico[historico.length - 1].dia : "";
  const hoje = ultimo.startsWith(prefixo) ? Math.min(agora.getDate(), Number(ultimo.slice(8))) : agora.getDate();
  const ant = new Date(ano, mes - 1, 1, 12);
  const prefixoAnt = `${ant.getFullYear()}-${dois(ant.getMonth() + 1)}-`;
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diasNoAnterior = new Date(ano, mes, 0).getDate();
  const limiteAnt = Math.min(hoje, diasNoAnterior);

  const doMes = historico.filter((d) => d.dia.startsWith(prefixo) && Number(d.dia.slice(8)) <= hoje);
  const doAnterior = historico.filter((d) => d.dia.startsWith(prefixoAnt));
  if (!doMes.length) return null;

  const atual = somar(doMes);
  const ateHoje = somar(doAnterior.filter((d) => Number(d.dia.slice(8)) <= limiteAnt));
  const melhor = doMes.reduce<DiaFlush | null>((m, d) => (d.valor > 0 && (!m || d.valor > m.valor) ? d : m), null);
  return {
    nome: NOMES[mes],
    atual,
    diasPassados: hoje,
    diasNoMes,
    margem: atual.valor > 0 ? atual.lucro / atual.valor : null,
    ticket: atual.pedidos > 0 ? arred(atual.valor / atual.pedidos) : null,
    projecao: arred((atual.valor / hoje) * diasNoMes),
    melhor,
    anterior: { nome: NOMES[ant.getMonth()], ateHoje, total: somar(doAnterior) },
    // Só compara com base: um mês passado sem histórico (Flush nova) não vira "+∞%".
    variacao: doAnterior.length >= limiteAnt && ateHoje.valor > 0 ? (atual.valor - ateHoje.valor) / ateHoje.valor : null,
  };
}

export interface ProgressoMeta {
  meta: number;
  /** 0 a 1 (passa de 1 quando bate a meta). */
  feito: number;
  falta: number;
  /** Quanto precisa vender por dia, nos dias que restam (hoje incluso), para bater. */
  porDia: number | null;
  /** No ritmo atual, bate a meta? */
  noRitmo: boolean;
}

export function progressoMeta(mes: MesFlush, meta: number): ProgressoMeta {
  const falta = Math.max(0, arred(meta - mes.atual.valor));
  const restam = mes.diasNoMes - mes.diasPassados + 1;
  return {
    meta,
    feito: meta > 0 ? mes.atual.valor / meta : 0,
    falta,
    porDia: falta > 0 ? arred(falta / restam) : null,
    noRitmo: mes.projecao >= meta,
  };
}

/**
 * Valor falado em reais: "10 mil", "10k", "R$ 8.500", "8500,50", "1,5 mil".
 * null quando não é um valor (ou é zero/negativo).
 */
export function lerValor(texto: string): number | null {
  const t = texto.toLowerCase().replace(/r\$\s*/g, "").trim();
  const m = t.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k)?\s*(?:reais|conto|contos)?$/);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/\./g, ""));
  const frac = m[2] ? Number(`0.${m[2]}`) : 0;
  const v = (inteiro + frac) * (m[3] ? 1000 : 1);
  return v > 0 && Number.isFinite(v) ? arred(v) : null;
}
