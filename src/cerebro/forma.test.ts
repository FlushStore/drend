import { describe, expect, it } from "vitest";
import { gerarForma } from "./forma";

describe("forma do cérebro", () => {
  const f = gerarForma(1200, 120);
  it("gera a superfície e a rede pedidas, sempre iguais", () => {
    expect(f.superficie.length).toBe(1200 * 3);
    expect(f.nos.length).toBe(120 * 3);
    expect(gerarForma(1200, 120).superficie[30]).toBe(f.superficie[30]);
  });
  it("cabe numa caixa de cérebro e todo nó tem ligação", () => {
    for (let i = 0; i < f.superficie.length; i += 3) {
      expect(Math.abs(f.superficie[i])).toBeLessThan(1.1);
      expect(Math.abs(f.superficie[i + 2])).toBeLessThan(0.95);
    }
    expect(f.vizinhos.every((v) => v.length > 0)).toBe(true);
    expect(f.ligacoes.length % 2).toBe(0);
  });
});
