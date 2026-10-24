import { describe, expect, it } from "vitest";
import { novaTarefa } from "./tarefas";
import { adicionarHabito, alternarDia, habitoParaConcluir, lerHabitos, marcarHoje, novoHabito, removerHabito, responderHabitos, sequencia, textoDaSequencia, ultimos7, type Habito } from "./habitos";

// 24/10/2026, 22h em Brasília (já é 25/10 em UTC).
const agora = new Date("2026-10-25T01:00:00Z");
const com = (feitos: string[]): Habito => ({ ...novoHabito("academia"), feitos });

describe("hábitos", () => {
  it("cria com nome limpo e não duplica", () => {
    const h = novoHabito("  academia. ");
    expect(h.nome).toBe("Academia");
    const lista = adicionarHabito([], h);
    expect(adicionarHabito(lista, novoHabito("ACADEMIA"))).toHaveLength(1);
    expect(adicionarHabito(lista, novoHabito("Ler"))).toHaveLength(2);
    expect(removerHabito(lista, h.id)).toHaveLength(0);
  });

  it("marca hoje pelo dia de Brasília, e um toque desmarca", () => {
    const h = novoHabito("Ler");
    let lista = marcarHoje([h], h.id, agora);
    expect(lista[0].feitos).toEqual(["2026-10-24"]);
    expect(marcarHoje(lista, h.id, agora)[0].feitos).toEqual(["2026-10-24"]);
    lista = alternarDia(lista, h.id, "2026-10-24");
    expect(lista[0].feitos).toEqual([]);
  });

  it("sequência conta até hoje, ou até ontem se hoje ainda não foi", () => {
    expect(sequencia(com([]), agora)).toBe(0);
    expect(sequencia(com(["2026-10-22", "2026-10-23", "2026-10-24"]), agora)).toBe(3);
    expect(sequencia(com(["2026-10-22", "2026-10-23"]), agora)).toBe(2);
    expect(sequencia(com(["2026-10-20", "2026-10-22"]), agora)).toBe(0);
    expect(sequencia(com(["2026-09-30", "2026-10-01"]), new Date("2026-10-01T12:00:00Z"))).toBe(2);
  });

  it("últimos 7 dias, do mais antigo até hoje", () => {
    const dias = ultimos7(com(["2026-10-18", "2026-10-24"]), agora);
    expect(dias.map((x) => x.dia)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(dias.map((x) => x.feito)).toEqual([true, false, false, false, false, false, true]);
  });

  it("lê retrato antigo sem quebrar", () => {
    expect(lerHabitos(undefined)).toEqual([]);
    const h = { id: "h1", nome: "Ler", criadoEm: "2026-10-01T00:00:00Z", feitos: ["2026-10-02", "2026-10-02", "x"] };
    expect(lerHabitos([h, { id: 2 }])).toEqual([{ ...h, feitos: ["2026-10-02"] }]);
    expect(lerHabitos([{ id: "h2", nome: "Correr", criadoEm: "2026-10-01T00:00:00Z" }])[0].feitos).toEqual([]);
  });

  it("responde no chat: como começar, e a lista com sequência", () => {
    expect(responderHabitos([], agora)).toMatch(/novo hábito academia/);
    expect(responderHabitos([{ ...com(["2026-10-23", "2026-10-24"]), nome: "Academia" }], agora)).toBe("Seus hábitos:\n• Academia: 2 dias seguidos, feito hoje");
  });

  it("tarefa aberta que casa vence o hábito de mesmo nome", () => {
    const academia = novoHabito("Academia");
    const ler = novoHabito("Ler");
    const tarefa = novaTarefa("academia");
    expect(habitoParaConcluir([academia, ler], [tarefa], "academia")).toBeNull();
    expect(habitoParaConcluir([academia, ler], [novaTarefa("Pagar luz")], "academia")).toBe(academia);
    expect(habitoParaConcluir([academia, ler], [], "academia")).toBe(academia);
    expect(habitoParaConcluir([academia], [], "pagar luz")).toBeNull();
  });

  it("texto da sequência", () => {
    expect(textoDaSequencia(0)).toBe("Sem sequência");
    expect(textoDaSequencia(1)).toBe("1 dia seguido");
    expect(textoDaSequencia(5)).toBe("5 dias seguidos");
  });
});
