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
