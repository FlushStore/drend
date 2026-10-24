/**
 * Revisão da semana: os últimos 7 dias de tudo que o app já sabe (Flush, tarefas, hábitos,
 * dinheiro) e os próximos 7 da agenda. Funções puras sobre os dados reais que as telas e a
 * conversa já têm; sem dado, devolvem null (ou zero contado de verdade), nunca exemplo.
 */
import type { DiaFlush } from "../fontes/flush-regras";
import type { ProdutoVendido } from "../fontes/flush-produtos";
import type { Tarefa } from "./tarefas";
import type { Habito } from "./habitos";
import { sequencia } from "./habitos";
import type { Lancamento } from "./dinheiro";
import { nomeDoLancamento } from "./dinheiro";
import { normalizar } from "./fala";
import { doDia, type Compromisso } from "./agenda";
import { diaEmBrasilia, somarDias } from "./brasilia";
import { mediaDoHumor, semanaDoDiario, type Anotacao } from "./diario";

/** Os 7 dias de Brasília que terminam hoje, do mais antigo para hoje. */
export function seteDias(agora = new Date()): string[] {
  const hoje = diaEmBrasilia(agora);
  return Array.from({ length: 7 }, (_, i) => somarDias(hoje, i - 6));
}

const arred = (v: number) => Math.round(v * 100) / 100;

export interface Comparado {
  atual: number;
  /** Os 7 dias antes; null quando o histórico não cobre (leitura antiga). */
  anterior: number | null;
  /** (atual − anterior) / anterior; null sem base positiva para comparar. */
  variacao: number | null;
}

function comparar(atual: number, anterior: number | null): Comparado {
  return { atual, anterior, variacao: anterior !== null && anterior > 0 ? (atual - anterior) / anterior : null };
}

export interface SemanaFlush {
  /** Os 7 dias lidos (o último é o dia da leitura). */
  dias: DiaFlush[];
  faturamento: Comparado;
  lucro: Comparado;
  pedidos: Comparado;
  /** O dia que mais vendeu; null sem venda na semana. */
  melhorDia: DiaFlush | null;
  /** O mais vendido em unidades; null sem a leitura direta dos produtos ou sem venda. */
  maisVendido: ProdutoVendido | null;
  /** O período real lido (AAAA-MM-DD): termina no dia da leitura, que pode não ser hoje. */
  de: string;
  ate: string;
  /** true quando a leitura termina antes de hoje (cópia antiga ou do servidor). */
  defasada: boolean;
}

/**
 * Últimos 7 dias da Flush contra os 7 anteriores, do histórico diário que a leitura já traz.
 * Sem histórico usa os 7 `dias` (aí não há comparação). null sem dia nenhum.
 */
export function semanaDaFlush(historico: readonly DiaFlush[] | null | undefined, dias: readonly DiaFlush[] = [], maisVendidos: readonly ProdutoVendido[] | null = null, agora = new Date()): SemanaFlush | null {
  const base = historico && historico.length ? historico : dias;
  if (!base.length) return null;
  const atual = base.slice(-7);
  const antes = base.length >= 14 ? base.slice(-14, -7) : null;
  const soma = (ds: readonly DiaFlush[], k: "valor" | "lucro" | "pedidos") => arred(ds.reduce((t, d) => t + d[k], 0));
  const melhor = atual.reduce<DiaFlush | null>((m, d) => (d.valor > 0 && (!m || d.valor > m.valor) ? d : m), null);
  return {
    dias: [...atual],
    faturamento: comparar(soma(atual, "valor"), antes && soma(antes, "valor")),
    lucro: comparar(soma(atual, "lucro"), antes && soma(antes, "lucro")),
    pedidos: comparar(soma(atual, "pedidos"), antes && soma(antes, "pedidos")),
    melhorDia: melhor,
    maisVendido: maisVendidos?.[0] ?? null,
    de: atual[0].dia,
    ate: atual[atual.length - 1].dia,
    defasada: atual[atual.length - 1].dia < diaEmBrasilia(agora),
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const diaMes = (dia: string) => `${Number(dia.slice(8, 10))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;

/**
 * O período da Flush como ele é: "17–23 out · leitura de ontem". null quando a leitura vai até
 * hoje (aí são os mesmos 7 dias do resto da revisão). Nada de completar com dias zerados.
 */
export function periodoDaFlush(s: Pick<SemanaFlush, "de" | "ate" | "defasada">, agora = new Date()): string | null {
  if (!s.defasada) return null;
  const mesmoMes = s.de.slice(0, 7) === s.ate.slice(0, 7);
  const faixa = s.de === s.ate ? diaMes(s.ate) : mesmoMes ? `${Number(s.de.slice(8, 10))}–${diaMes(s.ate)}` : `${diaMes(s.de)}–${diaMes(s.ate)}`;
  const ontem = somarDias(diaEmBrasilia(agora), -1);
  return `${faixa} · leitura de ${s.ate === ontem ? "ontem" : diaMes(s.ate)}`;
}

export interface SemanaTarefas {
  /** Concluídas nos 7 dias (Brasília). As feitas há mais tempo já foram podadas do aparelho. */
  feitas: number;
  abertas: number;
}

export function semanaDasTarefas(lista: readonly Tarefa[], agora = new Date()): SemanaTarefas {
  const dias = new Set(seteDias(agora));
  let feitas = 0;
  let abertas = 0;
  for (const t of lista) {
    if (!t.feitaEm) abertas += 1;
    else if (dias.has(diaEmBrasilia(t.feitaEm))) feitas += 1;
  }
  return { feitas, abertas };
}

export interface HabitoNaSemana {
  id: string;
  nome: string;
  /** Dias feitos nos 7 dias. */
  feitos: number;
  /** Dias da semana que contam: os 7, ou menos se o hábito foi criado no meio dela. */
  dias: number;
  /** feitos / dias (0..1). */
  parte: number;
  /** Sequência de agora (a mesma de Vida). */
  atual: number;
  /** A maior sequência de todas. */
  recorde: number;
}

/** A maior corrida de dias seguidos na lista de dias feitos. */
export function maiorSequencia(feitos: readonly string[]): number {
  const ordenados = [...new Set(feitos)].sort();
  let maior = 0;
  let corrida = 0;
  let anterior = "";
  for (const dia of ordenados) {
    corrida = anterior && somarDias(anterior, 1) === dia ? corrida + 1 : 1;
    maior = Math.max(maior, corrida);
    anterior = dia;
  }
  return maior;
}

/** Cada hábito na semana; o dia em que foi criado conta (antes dele, não). */
export function semanaDosHabitos(lista: readonly Habito[], agora = new Date()): HabitoNaSemana[] {
  const semana = seteDias(agora);
  return lista.map((h) => {
    const criado = Number.isNaN(Date.parse(h.criadoEm)) ? semana[0] : diaEmBrasilia(h.criadoEm);
    const feitosSet = new Set(h.feitos);
    // Um dia feito antes da data de criação (marcado à mão) também vale.
    const validos = semana.filter((d) => d >= criado || feitosSet.has(d));
    const feitos = semana.filter((d) => feitosSet.has(d)).length;
    const dias = Math.max(1, validos.length);
    return { id: h.id, nome: h.nome, feitos, dias, parte: feitos / dias, atual: sequencia(h, agora), recorde: maiorSequencia(h.feitos) };
  });
}

export interface SemanaDinheiro {
  entradas: number;
  gastos: number;
  saldo: number;
  /** Lançamentos nos 7 dias. */
  n: number;
  /** Onde mais gastou na semana; null sem gasto. */
  maiorGasto: { rotulo: string; total: number; n: number } | null;
}

const centavos = (v: number) => Math.round(v * 100);

export function semanaDoDinheiro(lista: readonly Lancamento[], agora = new Date()): SemanaDinheiro {
  const dias = new Set(seteDias(agora));
  let e = 0;
  let g = 0;
  let n = 0;
  const grupos = new Map<string, { rotulo: string; c: number; n: number }>();
  for (const l of lista) {
    if (!dias.has(diaEmBrasilia(l.em))) continue;
    n += 1;
    if (l.tipo === "entrada") {
      e += centavos(l.valor);
      continue;
    }
    g += centavos(l.valor);
    const chave = l.categoria || normalizar(l.descricao) || "outros";
    const grupo = grupos.get(chave) ?? { rotulo: l.descricao ? nomeDoLancamento(l) : "Sem descrição", c: 0, n: 0 };
    grupo.c += centavos(l.valor);
    grupo.n += 1;
    grupos.set(chave, grupo);
  }
  const top = [...grupos.values()].sort((a, b) => b.c - a.c || a.rotulo.localeCompare(b.rotulo, "pt-BR"))[0];
  return { entradas: e / 100, gastos: g / 100, saldo: (e - g) / 100, n, maiorGasto: top ? { rotulo: top.rotulo, total: top.c / 100, n: top.n } : null };
}

/** Compromissos dos próximos 7 dias (hoje sem o que já acabou), sem repetir o que dura vários dias. */
export function proximos7(lista: readonly Compromisso[], agora = new Date()): Compromisso[] {
  const vistos = new Set<string>();
  const saida: Compromisso[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(agora);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const c of doDia(lista, dia)) {
      if (vistos.has(c.id)) continue;
      if (i === 0 && !c.diaInteiro && new Date(c.fim) <= agora) continue;
      vistos.add(c.id);
      saida.push(c);
    }
  }
  return saida;
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
const pct = (v: number) => `${Math.round(v * 100)}%`;
const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const nomeDoDia = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");

/** "+12%" · "−8%" · "igual" contra os 7 dias antes. */
export function textoDaVariacao(v: number | null): string | null {
  if (v === null) return null;
  if (Math.abs(v) < 0.005) return "igual";
  return `${v > 0 ? "+" : "−"}${pct(Math.abs(v))}`;
}

export interface EntradaDaSemana {
  /** null = Flush não ligada; "carregando" = lendo agora. */
  flush: SemanaFlush | null | "carregando";
  tarefas: readonly Tarefa[];
  habitos: readonly Habito[];
  lancamentos: readonly Lancamento[];
  /** null = agenda não lida. */
  agenda: readonly Compromisso[] | null;
  /** Diário do dia. Ausente ou vazio na semana: a linha não entra. */
  diario?: readonly Anotacao[];
}

/** "como foi a semana?": 3 ou 4 linhas, só com o que tem dado. */
export function responderSemana(e: EntradaDaSemana, agora = new Date()): string {
  const linhas: string[] = [];
  const f = e.flush;
  if (f === "carregando") linhas.push("Flush: estou lendo as vendas agora.");
  else if (!f) linhas.push("Flush: sem leitura (ligue em Sua conta).");
  else {
    const periodo = periodoDaFlush(f, agora);
    const cab = periodo ? `Flush, ${periodo.replace(" · ", " (")})` : "Flush, 7 dias";
    if (!f.faturamento.atual) linhas.push(`${cab}: nenhuma venda.`);
    else {
    const v = textoDaVariacao(f.faturamento.variacao);
    const comp = v ? ` (${v === "igual" ? "igual aos" : `${v} contra os`} 7 dias antes)` : "";
    const melhor = f.melhorDia ? ` Melhor dia: ${nomeDoDia(f.melhorDia.dia)}.` : "";
    const top = f.maisVendido ? ` Mais vendido: ${f.maisVendido.nome}.` : "";
    linhas.push(`${cab}: ${reais(f.faturamento.atual)}${comp}, ${reais(f.lucro.atual)} de lucro, ${vezes(f.pedidos.atual, "pedido", "pedidos")}.${melhor}${top}`);
    }
  }

  const t = semanaDasTarefas(e.tarefas, agora);
  const partes = [`${vezes(t.feitas, "tarefa concluída", "tarefas concluídas")}, ${t.abertas} ${t.abertas === 1 ? "aberta" : "abertas"}`];
  const hs = semanaDosHabitos(e.habitos, agora);
  if (hs.length) partes.push(`hábitos: ${hs.map((h) => `${h.nome} ${h.feitos}/${h.dias}`).join(", ")}`);
  linhas.push(`${partes.join("; ")}.`.replace(/^./, (x) => x.toUpperCase()));

  const d = semanaDoDinheiro(e.lancamentos, agora);
  if (d.n) {
    const onde = d.maiorGasto ? ` Mais em ${d.maiorGasto.rotulo} (${reais(d.maiorGasto.total)}).` : "";
    linhas.push(`Seu dinheiro: entrou ${reais(d.entradas)}, saiu ${reais(d.gastos)}, saldo ${d.saldo < 0 ? "-" : ""}${reais(Math.abs(d.saldo))}.${onde}`);
  }

  const di = semanaDoDiario(e.diario ?? [], agora);
  if (di.dias) linhas.push(`Diário: ${textoDaSemanaDoDiario(di)}.`);

  if (e.agenda) {
    const n = proximos7(e.agenda, agora).length;
    linhas.push(n ? `Próximos 7 dias: ${vezes(n, "compromisso", "compromissos")} na agenda.` : "Próximos 7 dias: agenda livre.");
  }
  return linhas.join("\n");
}

/** "4 de 7 dias anotados · humor médio 3,5" (a média só quando ele disse algum humor). */
export function textoDaSemanaDoDiario(s: { dias: number; humorMedio: number | null }): string {
  const base = `${s.dias} de 7 ${s.dias === 1 ? "dia anotado" : "dias anotados"}`;
  return s.humorMedio !== null ? `${base} · humor médio ${mediaDoHumor(s.humorMedio)}` : base;
}
