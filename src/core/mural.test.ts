import { describe, expect, it } from "vitest";
import { Mural, MuralError, apply, emptyMural, type Op } from "./mural";

const board = { id: "natal", title: "Marketing Flush · Natal", project: "flushstore", tags: ["natal"] };
const card = (id: string, x = 0) => ({ id, boardId: "natal", kind: "nota" as const, title: id, x, y: 0, w: 200 });

function seeded() {
  const m = new Mural(emptyMural(), () => new Date("2026-10-23T20:41:00Z"));
  m.run({ type: "createBoard", board }, "drend", "Criou o quadro");
  return m;
}

describe("Mural", () => {
  it("cria o quadro com cartões e ligações num lote só, como o DREND faz por comando", () => {
    const m = seeded();
    m.run(
      {
        type: "batch",
        ops: [
          { type: "addCard", card: card("a") },
          { type: "addCard", card: card("b", 300) },
          { type: "linkCards", link: { id: "l1", boardId: "natal", from: "a", to: "b" } },
        ],
      },
      "drend",
      "Criou 2 cartões e 1 ligação",
    );
    expect(m.cardsOf("natal")).toHaveLength(2);
    expect(m.linksOf("natal")).toHaveLength(1);
  });

  it("desfaz o lote inteiro de uma vez", () => {
    const m = seeded();
    m.run(
      { type: "batch", ops: [{ type: "addCard", card: card("a") }, { type: "addCard", card: card("b") }] },
      "drend",
      "Criou 2 cartões",
    );
    m.undo();
    expect(m.cardsOf("natal")).toHaveLength(0);
    expect(m.log.at(-1)?.summary).toBe("Desfez: Criou 2 cartões");
  });

  it("desfazer duas vezes volta duas ações, sem desfazer o próprio desfazer", () => {
    const m = seeded();
    m.run({ type: "addCard", card: card("a") }, "rapha", "Nota a");
    m.run({ type: "moveCard", cardId: "a", x: 50, y: 60 }, "rapha", "Moveu a");
    m.undo();
    expect(m.state.cards.a).toMatchObject({ x: 0, y: 0 });
    m.undo();
    expect(m.state.cards.a).toBeUndefined();
  });

  it("remover um cartão leva as ligações junto e o desfazer traz as duas de volta", () => {
    const m = seeded();
    m.run({ type: "addCard", card: card("a") }, "rapha", "a");
    m.run({ type: "addCard", card: card("b") }, "rapha", "b");
    m.run({ type: "linkCards", link: { id: "l1", boardId: "natal", from: "a", to: "b" } }, "rapha", "liga");
    m.run({ type: "removeCard", cardId: "a" }, "rapha", "remove a");
    expect(m.linksOf("natal")).toHaveLength(0);
    m.undo();
    expect(m.state.cards.a).toBeDefined();
    expect(m.state.links.l1).toBeDefined();
  });

  it("apagar o quadro e desfazer recria quadro, cartões e ligações", () => {
    const m = seeded();
    m.run({ type: "addCard", card: card("a") }, "rapha", "a");
    m.run({ type: "addCard", card: card("b") }, "rapha", "b");
    m.run({ type: "linkCards", link: { id: "l1", boardId: "natal", from: "a", to: "b" } }, "rapha", "liga");
    m.run({ type: "deleteBoard", boardId: "natal" }, "rapha", "apaga");
    expect(m.state).toEqual(emptyMural());
    m.undo();
    expect(Object.keys(m.state.cards).sort()).toEqual(["a", "b"]);
    expect(m.state.links.l1).toBeDefined();
  });

  it("lote com erro não muda nada", () => {
    const m = seeded();
    const before = m.state;
    const bad: Op = { type: "batch", ops: [{ type: "addCard", card: card("a") }, { type: "moveCard", cardId: "x", x: 1, y: 1 }] };
    expect(() => m.run(bad, "drend", "lote ruim")).toThrow(MuralError);
    expect(m.state).toBe(before);
    expect(m.log).toHaveLength(1);
  });

  it("recusa ligar cartões de quadros diferentes", () => {
    let s = apply(emptyMural(), { type: "createBoard", board }).state;
    s = apply(s, { type: "createBoard", board: { ...board, id: "outro" } }).state;
    s = apply(s, { type: "addCard", card: card("a") }).state;
    s = apply(s, { type: "addCard", card: { ...card("b"), boardId: "outro" } }).state;
    expect(() => apply(s, { type: "linkCards", link: { id: "l", boardId: "natal", from: "a", to: "b" } })).toThrow(
      "mesmo quadro",
    );
  });
});
