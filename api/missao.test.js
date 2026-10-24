import { describe, expect, it } from "vitest";
import { validar } from "./missao.js";

describe("api/missao: validar", () => {
  it("aceita item com chave e fase", () => {
    expect(validar({ agente: "claude", tipo: "item", chave: "cerebro", fase: "feito", titulo: " Cérebro animado " }).evento).toMatchObject({ missao: "drend", titulo: "Cérebro animado", fase: "feito" });
  });
  it("recusa o que não conhece", () => {
    expect(validar({ agente: "hacker", tipo: "nota", titulo: "x" }).erro).toBe("agente inválido");
    expect(validar({ agente: "claude", tipo: "item", titulo: "x" }).erro).toBe("item precisa de chave e fase");
    expect(validar({ agente: "claude", tipo: "nota", titulo: "x", ref: "javascript:alert(1)" }).erro).toBe("ref precisa ser um link https");
    expect(validar(null).erro).toBe("corpo JSON obrigatório");
  });
});

describe("api/missao: data do passo", () => {
  const agora = Date.parse("2026-10-24T15:00:00Z");
  it("aceita quando foi, no último ano", () => {
    expect(validar({ agente: "claude", tipo: "nota", titulo: "x", em: "2026-10-24T12:10:53Z" }, agora).evento.em).toBe("2026-10-24T12:10:53.000Z");
  });
  it("recusa futuro, muito antigo ou sem formato", () => {
    for (const em of ["2026-10-25T15:00:00Z", "2024-01-01T00:00:00Z", "ontem", 5]) {
      expect(validar({ agente: "claude", tipo: "nota", titulo: "x", em }, agora).erro).toMatch(/^em /);
    }
  });
});
