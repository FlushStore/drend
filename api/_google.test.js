import { describe, expect, it } from "vitest";
import { normalizar } from "./_google.js";

describe("api/_google: normalizar", () => {
  it("dia inteiro vale em Brasília, com o fim exclusivo", () => {
    const [e] = normalizar([{ id: "a", summary: "Prazo técnico", start: { date: "2026-10-30T00:00:00Z" }, end: { date: "2026-10-31T00:00:00Z" } }]);
    expect(e).toMatchObject({ id: "g|a", titulo: "Prazo técnico", diaInteiro: true, dia: "2026-10-30", inicio: "2026-10-30T03:00:00.000Z", fim: "2026-10-31T03:00:00.000Z" });
  });
  it("hora com fuso, hora sem fuso e o dia em Brasília", () => {
    const [a, b] = normalizar([
      { id: "x", summary: "Reunião", location: " Loja ", start: { dateTime: "2026-10-25T01:30:00Z" }, end: { dateTime: "2026-10-25T02:30:00Z" } },
      { id: "y", summary: "Dentista", start: { dateTime: "2026-10-26T09:00:00" }, end: { dateTime: "2026-10-26T10:00:00" } },
    ]);
    expect(a).toMatchObject({ dia: "2026-10-24", local: "Loja", diaInteiro: false });
    expect(b).toMatchObject({ dia: "2026-10-26", inicio: "2026-10-26T12:00:00.000Z" });
  });
  it("ignora cancelado e sem data; recusa o que não é lista", () => {
    expect(normalizar([{ status: "cancelled", start: { date: "2026-10-30" } }, { summary: "?" }])).toEqual([]);
    expect(normalizar({})).toBeNull();
  });
});
