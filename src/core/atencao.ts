/**
 * "O que pede atenção" no Hoje e no chat: contas atrasadas ou perto de vencer, compromisso
 * nas próximas 2 horas, sabores esgotados da Flush e hábitos que faltam hoje.
 * Funções puras: só junta e ordena o que veio da leitura; sem dado, a lista fica vazia.
 * O dia é sempre o de Brasília.
 */
import type { Compromisso } from "./agenda";
import { contasDoMes, reais, textoDoEstado, type Conta, type EstadoDaConta } from "./contas";
import { feitoNoDia, type Habito } from "./habitos";
import { diaEmBrasilia } from "./brasilia";

export type Tela = "/vida" | "/negocios";

export type ItemDeAtencao =
  | { tipo: "conta"; chave: string; contaId: string; nome: string; estado: Exclude<EstadoDaConta, "paga">; dias: number; valor: number | null; rotulo: string; tela: Tela }
  | { tipo: "compromisso"; chave: string; titulo: string; inicio: string; comecou: boolean; rotulo: string; tela: Tela }
  | { tipo: "esgotados"; chave: string; n: number; rotulo: string; tela: Tela }
  | { tipo: "habito"; chave: string; habitoId: string; nome: string; rotulo: string; tela: Tela };

export interface FontesDeAtencao {
  contas: readonly Conta[];
  habitos: readonly Habito[];
  /** null = agenda não lida (não entra nada). */
  compromissos: readonly Compromisso[] | null;
  /** Quantos sabores com 0 unidades. null = sem leitura direta do estoque. */
  esgotados: number | null;
  agora: Date;
}

/** Janela do "compromisso já já". */
export const JANELA_MS = 2 * 60 * 60 * 1000;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Compromissos com hora que estão rolando agora ou começam nas próximas 2 horas. */
export function compromissosProximos(lista: readonly Compromisso[], agora: Date, janela = JANELA_MS): Compromisso[] {
  const t = agora.getTime();
  return lista
    .filter((c) => !c.diaInteiro && Date.parse(c.fim) > t && Date.parse(c.inicio) <= t + janela)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Contas atrasadas, de hoje e de amanhã (o resto do mês fica em Vida). */
function contasUrgentes(contas: readonly Conta[], agora: Date) {
  return contasDoMes(contas, agora).filter((i) => i.estado === "atrasada" || i.estado === "hoje" || (i.estado === "futura" && i.dias === 1));
}

/** Peso de urgência: menor vem antes. */
function peso(i: ItemDeAtencao): number {
  if (i.tipo === "compromisso") return 0;
  if (i.tipo === "conta") return i.estado === "atrasada" ? 1 : i.estado === "hoje" ? 2 : 3;
  if (i.tipo === "esgotados") return 4;
  return 5;
}

/** A lista inteira, em ordem de urgência. */
export function montarAtencao(f: FontesDeAtencao): ItemDeAtencao[] {
  const itens: ItemDeAtencao[] = [];
  const hoje = diaEmBrasilia(f.agora);

  for (const c of f.compromissos ? compromissosProximos(f.compromissos, f.agora) : []) {
    const comecou = Date.parse(c.inicio) <= f.agora.getTime();
    itens.push({ tipo: "compromisso", chave: `ag-${c.id}`, titulo: c.titulo, inicio: c.inicio, comecou, rotulo: comecou ? "Agora" : `Às ${hhmm(c.inicio)}`, tela: "/vida" });
  }
  for (const i of contasUrgentes(f.contas, f.agora)) {
    itens.push({ tipo: "conta", chave: `ct-${i.conta.id}`, contaId: i.conta.id, nome: i.conta.nome, estado: i.estado as Exclude<EstadoDaConta, "paga">, dias: i.dias, valor: i.valor, rotulo: textoDoEstado(i), tela: "/vida" });
  }
  if (f.esgotados && f.esgotados > 0) {
    itens.push({ tipo: "esgotados", chave: "esgotados", n: f.esgotados, rotulo: "Flush", tela: "/negocios" });
  }
  for (const h of f.habitos) {
    if (!feitoNoDia(h, hoje)) itens.push({ tipo: "habito", chave: `hb-${h.id}`, habitoId: h.id, nome: h.nome, rotulo: "Hábito", tela: "/vida" });
  }

  // Ordem estável: dentro do mesmo peso, atrasada há mais tempo primeiro; o resto mantém a ordem de origem.
  return itens
    .map((i, n) => ({ i, n }))
    .sort((a, b) => peso(a.i) - peso(b.i) || (a.i.tipo === "conta" && b.i.tipo === "conta" && a.i.estado === "atrasada" && b.i.estado === "atrasada" ? b.i.dias - a.i.dias : 0) || a.n - b.n)
    .map(({ i }) => i);
}

/** "3 sabores esgotados" · "1 sabor esgotado". */
export const textoDosEsgotados = (n: number) => (n === 1 ? "1 sabor esgotado" : `${n} sabores esgotados`);

/** O que aparece e para onde leva o "ver tudo" (a tela do que ficou de fora). */
export function cortarAtencao(itens: readonly ItemDeAtencao[], limite = 5): { visiveis: ItemDeAtencao[]; escondidos: number; verTudo: Tela | null } {
  const visiveis = itens.slice(0, limite);
  const resto = itens.slice(limite);
  if (!resto.length) return { visiveis, escondidos: 0, verTudo: null };
  const telas = new Set(resto.map((i) => i.tela));
  return { visiveis, escondidos: resto.length, verTudo: telas.size === 1 ? resto[0].tela : "/vida" };
}

/** O pedaço do chat ("o que tenho hoje?"): contas e hábitos de hoje. Vazio quando não há nada. */
export function responderAtencao(contas: readonly Conta[], habitos: readonly Habito[], agora = new Date()): string {
  const partes: string[] = [];
  const urgentes = contasUrgentes(contas, agora);
  if (urgentes.length) {
    const ordem = { atrasada: 0, hoje: 1, futura: 2, paga: 3 } as const;
    const lista = [...urgentes].sort((a, b) => ordem[a.estado] - ordem[b.estado] || (a.estado === "atrasada" ? b.dias - a.dias : 0));
    partes.push(`Contas:\n${lista.map((i) => `• ${i.conta.nome}: ${textoDoEstado(i).toLowerCase()}${i.valor !== null ? ` (${reais(i.valor)})` : ""}`).join("\n")}`);
  }
  const hoje = diaEmBrasilia(agora);
  const faltam = habitos.filter((h) => !feitoNoDia(h, hoje));
  if (faltam.length) partes.push(`Hábitos que faltam hoje: ${faltam.map((h) => h.nome).join(", ")}.`);
  else if (habitos.length) partes.push("Hábitos de hoje: todos feitos.");
  return partes.join("\n\n");
}
