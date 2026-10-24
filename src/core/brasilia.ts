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
