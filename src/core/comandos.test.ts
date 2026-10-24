import { describe, expect, it } from "vitest";
import { entender, opCriarQuadro, separarItens } from "./comandos";
import { Mural, emptyMural } from "./mural";

describe("entender", () => {
  it("lê o pedido de quadro com cartões", () => {
    expect(entender("Crie um quadro Natal da Flush com cartões Vídeo do pod, Cupom e Stories")).toEqual({
      tipo: "criarQuadro",
      titulo: "Natal",
      projeto: "flushstore",
      cartoes: ["Vídeo do pod", "Cupom", "Stories"],
    });
  });

  it("aceita a forma curta com dois pontos", () => {
    expect(entender("quadro Viagem: passagem; hotel; roteiro")).toMatchObject({ titulo: "Viagem", projeto: "drend", cartoes: ["passagem", "hotel", "roteiro"] });
  });

  it("entende desfazer e ideia", () => {
    expect(entender("desfaz")).toEqual({ tipo: "desfazer" });
    expect(entender("Desfazer a última ação")).toEqual({ tipo: "desfazer" });
    expect(entender("tive uma ideia: kit presente")).toEqual({ tipo: "ideia", texto: "kit presente" });
  });

  it("não inventa comando no que não entende", () => {
    expect(entender("como está a Flush hoje?")).toBeNull();
    expect(entender("crie um quadro com cartões")).toBeNull();
  });

  it("separa listas com vírgula, ponto e vírgula e 'e'", () => {
    expect(separarItens("a, b e c; d")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("criar quadro por comando", () => {
  it("cria quadro e cartões num lote e um desfazer apaga tudo", () => {
    const m = new Mural(emptyMural());
    const c = entender("crie um quadro Natal com cartões A, B, C, D e E");
    if (c?.tipo !== "criarQuadro") throw new Error("comando não lido");
    const { op, board } = opCriarQuadro(m.state, c);
    m.run(op, "drend", `Criou o quadro ${board.title}`);
    expect(m.cardsOf(board.id)).toHaveLength(5);
    expect(m.state.cards[`${board.id}-c5`]).toMatchObject({ x: 40, y: 210 });
    m.undo();
    expect(m.state).toEqual(emptyMural());
  });

  it("não repete id de quadro", () => {
    const m = new Mural(emptyMural());
    const c = { tipo: "criarQuadro" as const, titulo: "Natal", projeto: "drend", cartoes: ["a"] };
    m.run(opCriarQuadro(m.state, c).op, "drend", "1");
    expect(opCriarQuadro(m.state, c).board.id).toBe("natal-2");
  });
});
