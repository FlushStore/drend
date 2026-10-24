import { describe, expect, it } from "vitest";
import { validar } from "./flush.js";

describe("api/flush: validar", () => {
  it("aceita o resultado do SQL (com ou sem o envelope resumo)", () => {
    const r = { historico: [{ dia: "2026-10-22", valor: 699.3, lucro: 284.45, pedidos: 7 }, { dia: "2026-10-21", valor: "618.8", lucro: 229.99, pedidos: 5 }], lidoEm: "2026-10-24T15:04:20Z" };
    const { resumo } = validar({ resumo: r });
    expect(resumo.historico.map((d) => d.dia)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(resumo.historico[0].valor).toBe(618.8);
    expect(validar(r).resumo.lidoEm).toBe("2026-10-24T15:04:20.000Z");
  });
  it("recusa o que não é resumo", () => {
    expect(validar({}).erro).toBeTruthy();
    expect(validar({ historico: [{ dia: "ontem", valor: 1, lucro: 1, pedidos: 1 }], lidoEm: "2026-10-24T00:00:00Z" }).erro).toMatch(/dia inválido/);
    expect(validar({ historico: [{ dia: "2026-10-24", valor: 1, lucro: 1, pedidos: 1 }] }).erro).toBe("lidoEm inválido");
  });
});
