import { describe, expect, it } from "vitest";
import { avisoDe, proximos, resumoDaManha } from "./_resumo.js";

const ev = (titulo, inicio, fim, diaInteiro = false) => ({ id: titulo, titulo, local: null, inicio, fim, diaInteiro, dia: inicio.slice(0, 10) });
const agora = Date.parse("2026-10-30T10:30:00Z"); // 7h30 em Brasília

describe("api/_resumo", () => {
  it("resumo da manhã com a agenda de hoje e as tarefas abertas", () => {
    const r = resumoDaManha(
      [ev("Prazo técnico", "2026-10-30T03:00:00.000Z", "2026-10-31T03:00:00.000Z", true), ev("Dentista", "2026-10-30T12:00:00.000Z", "2026-10-30T13:00:00.000Z"), ev("Amanhã", "2026-10-31T12:00:00.000Z", "2026-10-31T13:00:00.000Z")],
      [{ texto: "Ligar pro fornecedor" }, { texto: "Feita", feitaEm: "x" }],
      agora,
    );
    expect(r.titulo).toBe("Bom dia, Rapha · 2 compromissos hoje");
    expect(r.corpo).toBe("Dia todo · Prazo técnico\n09:00 · Dentista\n1 tarefa aberta: Ligar pro fornecedor");
  });
  it("dia vazio diz que está livre, sem inventar nada", () => {
    expect(resumoDaManha([], [], agora)).toEqual({ titulo: "Bom dia, Rapha", corpo: "Agenda livre hoje.\nNenhuma tarefa aberta.", url: "/" });
  });
  it("aviso só para o que começa na próxima hora e tem hora", () => {
    const lista = [ev("Já foi", "2026-10-30T10:00:00.000Z", "2026-10-30T11:00:00.000Z"), ev("Logo", "2026-10-30T11:15:00.000Z", "2026-10-30T12:00:00.000Z"), ev("Tarde", "2026-10-30T18:00:00.000Z", "2026-10-30T19:00:00.000Z")];
    expect(proximos(lista, agora).map((e) => e.titulo)).toEqual(["Logo"]);
    expect(avisoDe(lista[1]).titulo).toBe("08:15 · Logo");
  });
});
