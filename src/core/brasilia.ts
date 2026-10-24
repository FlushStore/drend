/** O dia do Rapha é o de Brasília, não o do aparelho nem o UTC. */
const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-24": a data em America/Sao_Paulo. */
export function diaEmBrasilia(d: Date | string): string {
  const data = typeof d === "string" ? new Date(d) : d;
  const partes = Object.fromEntries(FORMATO.formatToParts(data).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** "2026-10" do instante, em Brasília. */
export const mesEmBrasilia = (d: Date | string) => diaEmBrasilia(d).slice(0, 7);

/** Soma dias a um "AAAA-MM-DD" (conta de calendário, sem fuso no meio). */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Meio-dia de Brasília do dia: um instante seguro para as contas "até hoje" (Brasília é UTC−3 o ano todo). */
export const meioDiaEmBrasilia = (dia: string) => new Date(`${dia}T12:00:00-03:00`);

/** Quanto falta para a próxima meia-noite de Brasília (o dia virar). */
export function msAteAmanha(agora = new Date()): number {
  return Date.parse(`${somarDias(diaEmBrasilia(agora), 1)}T00:00:00-03:00`) - agora.getTime();
}

/** Dias que restam no mês de Brasília, hoje incluso (dia 24 de outubro: 8). */
export function diasRestantesNoMes(agora = new Date()): number {
  const hoje = diaEmBrasilia(agora);
  const [a, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate() - d + 1;
}

const HORA = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "21:14": a hora do instante em Brasília. */
export function horarioEmBrasilia(d: Date | string): string {
  return HORA.format(typeof d === "string" ? new Date(d) : d);
}

/** A hora cheia (0 a 23) do instante em Brasília. */
export const horaEmBrasilia = (d: Date | string) => Number(horarioEmBrasilia(d).slice(0, 2));
