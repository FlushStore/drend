import { describe, expect, it } from "vitest";
import { levelOf, needsApproval } from "./permissions";

describe("permissões", () => {
  it("leitura e organização não pedem confirmação", () => {
    expect(needsApproval("ler.extrato")).toBe(false);
    expect(needsApproval("capturar.ideia")).toBe(false);
  });

  it("dinheiro, deploy e migration sempre pedem", () => {
    expect(levelOf("dinheiro.mover")).toBe("D");
    expect(needsApproval("deploy")).toBe(true);
    expect(needsApproval("migration")).toBe(true);
  });

  it("ação desconhecida é tratada como nível D", () => {
    expect(levelOf("algo.novo")).toBe("D");
  });
});
