import { describe, expect, it } from "vitest";
import { abertas, adicionar, concluir, novaTarefa, podar, reabrir, remover } from "./tarefas";

const d = (iso: string) => new Date(iso);

describe("tarefas", () => {
  it("cria com texto limpo e maiúscula", () => {
    const t = novaTarefa("  pagar   o fornecedor. ", d("2026-10-24T10:00:00Z"));
    expect(t.texto).toBe("Pagar o fornecedor");
    expect(t.feitaEm).toBeUndefined();
  });

  it("não duplica tarefa aberta igual", () => {
    const a = novaTarefa("Ligar pro contador");
    const lista = adicionar([], a);
    expect(adicionar(lista, novaTarefa("ligar pro contador"))).toHaveLength(1);
  });

  it("conclui, reabre e remove", () => {
    const a = novaTarefa("A", d("2026-10-24T10:00:00Z"));
    let lista = adicionar([], a);
    lista = concluir(lista, a.id, d("2026-10-24T11:00:00Z"));
    expect(abertas(lista)).toHaveLength(0);
    lista = reabrir(lista, a.id);
    expect(abertas(lista)).toHaveLength(1);
    expect(remover(lista, a.id)).toHaveLength(0);
  });

  it("abertas vêm da mais antiga para a mais nova", () => {
    const b = novaTarefa("B", d("2026-10-24T12:00:00Z"));
    const a = novaTarefa("A", d("2026-10-24T09:00:00Z"));
    expect(abertas([b, a]).map((t) => t.texto)).toEqual(["A", "B"]);
  });

  it("poda feitas com mais de 7 dias", () => {
    const velha = { ...novaTarefa("Velha"), feitaEm: "2026-10-01T00:00:00Z" };
    const nova = { ...novaTarefa("Nova"), feitaEm: "2026-10-23T00:00:00Z" };
    const aberta = novaTarefa("Aberta");
    expect(podar([velha, nova, aberta], d("2026-10-24T00:00:00Z")).map((t) => t.texto)).toEqual(["Nova", "Aberta"]);
  });
});
