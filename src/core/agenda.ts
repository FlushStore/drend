/**
 * Agenda do Rapha para as telas e a conversa. Funções puras sobre os compromissos que a
 * /api/agenda devolve (Google Agenda, só leitura).
 */
export interface Compromisso {
  id: string;
  titulo: string;
  local: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  /** AAAA-MM-DD no fuso da agenda. */
  dia: string;
}

export type QuandoAgenda = "hoje" | "amanha" | "semana" | "proximo";

const dois = (n: number) => String(n).padStart(2, "0");
export const diaDe = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const horaDe = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
function maisDias(agora: Date, n: number) {
  const d = new Date(agora);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return diaDe(d);
}

export const doDia = (lista: readonly Compromisso[], dia: string) => lista.filter((c) => c.dia === dia);

/** O próximo com hora que ainda não acabou; sem ele, o de dia inteiro de hoje. */
export function proximo(lista: readonly Compromisso[], agora = new Date()): Compromisso | null {
  const t = agora.getTime();
  return lista.find((c) => !c.diaInteiro && new Date(c.fim).getTime() > t) ?? lista.find((c) => c.diaInteiro && c.dia === diaDe(agora)) ?? null;
}

/** "14:00 Reunião" · "o dia todo: Aniversário" · com "agora" quando já começou. */
export function linha(c: Compromisso, agora = new Date()): string {
  if (c.diaInteiro) return `o dia todo: ${c.titulo}`;
  const comecou = new Date(c.inicio).getTime() <= agora.getTime() && new Date(c.fim).getTime() > agora.getTime();
  return `${comecou ? "agora" : horaDe(c.inicio)} ${c.titulo}`;
}

function nomeDoDia(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
}

/** Resposta da conversa. `null` = agenda não lida (o texto diz o que falta). */
export function responderAgenda(lista: readonly Compromisso[] | null, quando: QuandoAgenda, agora = new Date(), motivo?: string): string {
  if (!lista) return motivo ?? "Ainda não tenho a sua agenda.";
  if (quando === "proximo") {
    const p = proximo(lista, agora);
    if (!p) return "Nada marcado nos próximos dias.";
    const quandoTxt = p.dia === diaDe(agora) ? "hoje" : p.dia === maisDias(agora, 1) ? "amanhã" : nomeDoDia(p.dia);
    return `Próximo: ${quandoTxt}, ${linha(p, agora)}${p.local ? ` (${p.local})` : ""}.`;
  }
  if (quando === "semana") {
    const dias = Array.from({ length: 7 }, (_, i) => maisDias(agora, i));
    const partes = dias.map((d, i) => {
      const cs = doDia(lista, d);
      return cs.length ? `${i === 0 ? "Hoje" : i === 1 ? "Amanhã" : nomeDoDia(d).replace(/^./, (x) => x.toUpperCase())}: ${cs.map((c) => linha(c, agora)).join("; ")}` : null;
    }).filter(Boolean);
    return partes.length ? partes.join("\n") : "Nada marcado nos próximos 7 dias.";
  }
  const dia = quando === "hoje" ? diaDe(agora) : maisDias(agora, 1);
  const rotulo = quando === "hoje" ? "Hoje" : "Amanhã";
  // Hoje, o que já passou sai da lista.
  const cs = doDia(lista, dia).filter((c) => quando !== "hoje" || c.diaInteiro || new Date(c.fim).getTime() > agora.getTime());
  if (!cs.length) return quando === "hoje" ? "Nada mais na agenda hoje." : "Amanhã está livre.";
  return `${rotulo}:\n${cs.map((c) => `• ${linha(c, agora)}`).join("\n")}`;
}
