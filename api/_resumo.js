// Textos dos avisos. Funções puras sobre os compromissos (formato da drend_agenda) e as
// tarefas do retrato; o horário é sempre o de Brasília.
const FUSO = "America/Sao_Paulo";
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
export const diaEmBrasilia = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: FUSO });

/** Os compromissos que tocam o dia (dia inteiro e os que atravessam o dia contam). */
export function doDia(eventos, dia) {
  const ini = Date.parse(`${dia}T00:00:00-03:00`);
  const fim = ini + 864e5;
  return eventos.filter((e) => Date.parse(e.inicio) < fim && Date.parse(e.fim) > ini).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O resumo da manhã: agenda de hoje e tarefas abertas. */
export function resumoDaManha(eventos, tarefas, agora = Date.now()) {
  const hoje = doDia(eventos, diaEmBrasilia(agora));
  const abertas = tarefas.filter((t) => t && typeof t.texto === "string" && !t.feitaEm);
  const linhas = [];
  if (hoje.length) linhas.push(hoje.slice(0, 4).map((e) => `${e.diaInteiro ? "Dia todo" : hora(e.inicio)} · ${e.titulo}`).join("\n") + (hoje.length > 4 ? `\n+${hoje.length - 4}` : ""));
  else linhas.push("Agenda livre hoje.");
  if (abertas.length) linhas.push(`${plural(abertas.length, "tarefa aberta", "tarefas abertas")}: ${abertas.slice(0, 3).map((t) => t.texto).join(", ")}${abertas.length > 3 ? "…" : ""}`);
  else linhas.push("Nenhuma tarefa aberta.");
  const titulo = hoje.length ? `Bom dia, Rapha · ${plural(hoje.length, "compromisso", "compromissos")} hoje` : "Bom dia, Rapha";
  return { titulo, corpo: linhas.join("\n"), url: "/" };
}

/** Compromissos com hora que começam na próxima janela (o da sincronia de hora em hora). */
export function proximos(eventos, agora = Date.now(), janelaMs = 70 * 60 * 1000) {
  return eventos.filter((e) => !e.diaInteiro && Date.parse(e.inicio) > agora && Date.parse(e.inicio) <= agora + janelaMs);
}

export const avisoDe = (e) => ({ titulo: `${hora(e.inicio)} · ${e.titulo}`, corpo: e.local ? e.local : "Na sua agenda", url: "/vida" });
