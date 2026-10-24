/**
 * Hábitos do Rapha: um nome e os dias em que ele fez (dia de Brasília, "AAAA-MM-DD").
 * Funções puras, no mesmo jeito das tarefas: desfazer é voltar à lista anterior.
 */
import { acharPorTexto, normalizar } from "./fala";
import type { Tarefa } from "./tarefas";
import { diaEmBrasilia, somarDias } from "./brasilia";

export interface Habito {
  id: string;
  nome: string;
  criadoEm: string;
  /** Dias feitos, sem repetir, em ordem. */
  feitos: string[];
}

let seq = 0;
export function novoHabito(nome: string, agora = new Date()): Habito {
  const limpo = nome.trim().replace(/\s+/g, " ").replace(/^["“”']+|["“”'.!?]+$/g, "").trim();
  return { id: `h${agora.getTime().toString(36)}-${++seq}`, nome: limpo.charAt(0).toUpperCase() + limpo.slice(1), criadoEm: agora.toISOString(), feitos: [] };
}

export const mesmoHabito = (a: string, b: string) => normalizar(a) === normalizar(b);

/** Não duplica pelo nome ("Academia" e "academia" são o mesmo). */
export function adicionarHabito(lista: readonly Habito[], h: Habito): Habito[] {
  if (!h.nome || lista.some((x) => x.id === h.id || mesmoHabito(x.nome, h.nome))) return [...lista];
  return [...lista, h];
}

export function removerHabito(lista: readonly Habito[], id: string): Habito[] {
  return lista.filter((h) => h.id !== id);
}

export const feitoNoDia = (h: Habito, dia: string) => h.feitos.includes(dia);

/** Um toque: marca o dia; outro toque desmarca. */
export function alternarDia(lista: readonly Habito[], id: string, dia: string): Habito[] {
  return lista.map((h) => {
    if (h.id !== id) return h;
    const feitos = feitoNoDia(h, dia) ? h.feitos.filter((d) => d !== dia) : [...h.feitos, dia].sort();
    return { ...h, feitos };
  });
}

/** Marca hoje (Brasília), sem desmarcar se já estava. */
export function marcarHoje(lista: readonly Habito[], id: string, agora = new Date()): Habito[] {
  const hoje = diaEmBrasilia(agora);
  return lista.map((h) => (h.id === id && !feitoNoDia(h, hoje) ? { ...h, feitos: [...h.feitos, hoje].sort() } : h));
}

/**
 * Dias seguidos até hoje. Se hoje ainda não foi feito, conta até ontem: a sequência
 * só quebra quando o dia passa em branco.
 */
export function sequencia(h: Habito, agora = new Date()): number {
  const feitos = new Set(h.feitos);
  const hoje = diaEmBrasilia(agora);
  let dia = feitos.has(hoje) ? hoje : somarDias(hoje, -1);
  let n = 0;
  while (feitos.has(dia)) {
    n += 1;
    dia = somarDias(dia, -1);
  }
  return n;
}

/** Os últimos 7 dias, do mais antigo até hoje. */
export function ultimos7(h: Habito, agora = new Date()): { dia: string; feito: boolean }[] {
  const hoje = diaEmBrasilia(agora);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(hoje, i - 6);
    return { dia, feito: feitoNoDia(h, dia) };
  });
}

/**
 * "fiz academia": o hábito que a frase marca. Tarefa aberta que casa tem prioridade
 * (inclusive empate entre tarefas): o hábito só entra quando nenhuma tarefa aberta casa.
 */
export function habitoParaConcluir(habitos: readonly Habito[], tarefasAbertas: readonly Tarefa[], texto: string): Habito | null {
  if (acharPorTexto(tarefasAbertas, texto, (t) => t.texto)) return null;
  const h = acharPorTexto(habitos, texto, (x) => x.nome);
  return h && "achado" in h ? h.achado : null;
}

/** Retrato antigo ou corrompido: só entra hábito com forma válida. */
export function lerHabitos(x: unknown): Habito[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((h): h is Habito => !!h && typeof h === "object" && typeof h.id === "string" && typeof h.nome === "string" && !!h.nome && typeof h.criadoEm === "string")
    .map((h) => ({ ...h, feitos: Array.isArray(h.feitos) ? [...new Set(h.feitos.filter((d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [] }));
}

export function textoDaSequencia(n: number): string {
  return n === 0 ? "Sem sequência" : n === 1 ? "1 dia seguido" : `${n} dias seguidos`;
}

/** "meus hábitos": cada um com a sequência e se já foi hoje. */
export function responderHabitos(lista: readonly Habito[], agora = new Date()): string {
  if (!lista.length) return "Você ainda não tem hábito. Diga “novo hábito academia” ou crie em Vida.";
  const hoje = diaEmBrasilia(agora);
  return ["Seus hábitos:", ...lista.map((h) => `• ${h.nome}: ${textoDaSequencia(sequencia(h, agora)).toLowerCase()}${feitoNoDia(h, hoje) ? ", feito hoje" : ", falta hoje"}`)].join("\n");
}
