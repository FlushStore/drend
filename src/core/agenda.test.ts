import { describe, expect, it } from "vitest";
import { diasDaAgenda, proximo, responderAgenda, type Compromisso } from "./agenda";

// Sábado, 24/10/2026, 13h local.
const agora = new Date(2026, 9, 24, 13, 0);
const c = (dia: string, h: number | null, titulo: string, dur = 1): Compromisso => {
  const ini = h === null ? new Date(`${dia}T00:00:00`) : new Date(`${dia}T${String(h).padStart(2, "0")}:00:00`);
  const fim = new Date(ini.getTime() + (h === null ? 24 : dur) * 36e5);
  return { id: `${dia}${h}${titulo}`, titulo, local: null, inicio: ini.toISOString(), fim: fim.toISOString(), diaInteiro: h === null, dia };
};
const lista = [
  c("2026-10-24", 9, "Café"),
  c("2026-10-24", 12, "Almoço", 2),
  c("2026-10-24", 19, "Estudo"),
  c("2026-10-25", null, "Aniversário da mãe"),
  c("2026-10-25", 10, "Feira"),
  c("2026-10-28", 15, "Fornecedor"),
];

describe("agenda", () => {
  it("o próximo é o que ainda não acabou", () => {
    expect(proximo(lista, agora)?.titulo).toBe("Almoço");
    expect(responderAgenda(lista, "proximo", agora)).toBe("Próximo: hoje, agora Almoço.");
  });

  it("hoje tira o que já passou; amanhã mostra o dia todo", () => {
    expect(responderAgenda(lista, "hoje", agora)).toBe("Hoje:\n• agora Almoço\n• 19:00 Estudo");
    expect(responderAgenda(lista, "amanha", agora)).toBe("Amanhã:\n• o dia todo: Aniversário da mãe\n• 10:00 Feira");
  });

  it("a semana só com os dias que têm algo", () => {
    expect(responderAgenda(lista, "semana", agora)).toBe(
      "Hoje: 09:00 Café; agora Almoço; 19:00 Estudo\nAmanhã: o dia todo: Aniversário da mãe; 10:00 Feira\nQuarta: 15:00 Fornecedor",
    );
  });

  it("sem agenda, diz o motivo", () => {
    expect(responderAgenda(null, "hoje", agora, "Entre na sua conta.")).toBe("Entre na sua conta.");
    expect(responderAgenda([], "amanha", agora)).toBe("Amanhã está livre.");
  });
});

describe("evento de vários dias", () => {
  it("aparece em cada dia enquanto dura", () => {
    const viagem: Compromisso = { id: "v", titulo: "Viagem", local: null, inicio: new Date("2026-10-24T00:00:00").toISOString(), fim: new Date("2026-10-28T00:00:00").toISOString(), diaInteiro: true, dia: "2026-10-24" };
    expect(responderAgenda([viagem], "amanha", agora)).toBe("Amanhã:\n• o dia todo: Viagem");
    expect(responderAgenda([viagem], "semana", agora).split("\n").length).toBe(4);
    expect(proximo([viagem], new Date(2026, 9, 26, 10))?.titulo).toBe("Viagem");
  });
});

describe("diasDaAgenda", () => {
  const longe = c("2026-11-10", 9, "Consulta");
  const todos = [...lista, longe];

  it("sem foco: só os 7 dias com algo, hoje sem o que já acabou", () => {
    const d = diasDaAgenda(todos, agora);
    expect(d.map((x) => x.dia)).toEqual(["2026-10-24", "2026-10-25", "2026-10-28"]);
    expect(d[0].cs.map((x) => x.titulo)).toEqual(["Almoço", "Estudo"]);
  });

  it("com foco fora da semana: o dia dele entra, na ordem, com a distância em dias", () => {
    const d = diasDaAgenda(todos, agora, longe.id);
    expect(d.map((x) => x.dia)).toEqual(["2026-10-24", "2026-10-25", "2026-10-28", "2026-11-10"]);
    expect(d[3]).toMatchObject({ i: 17, cs: [longe] });
  });

  it("com foco já encerrado hoje: ele volta para a lista", () => {
    const cafe = lista[0];
    expect(diasDaAgenda(todos, agora, cafe.id)[0].cs.map((x) => x.titulo)).toEqual(["Café", "Almoço", "Estudo"]);
  });

  it("foco que não existe não muda nada", () => {
    expect(diasDaAgenda(todos, agora, "nao-existe")).toEqual(diasDaAgenda(todos, agora));
  });
});
