import { describe, expect, it } from "vitest";
import { Mural } from "./mural";
import { tirarExemplos } from "./limpeza";

function comExemplo() {
  const m = new Mural();
  m.run({ type: "createBoard", board: { id: "natal", title: "Marketing Flush · Natal", project: "flushstore", tags: [] } }, "drend", "x");
  for (const c of ["c1", "c2", "c3", "c4", "c5", "c6"]) m.run({ type: "addCard", card: { id: c, boardId: "natal", kind: "nota", title: c, x: 0, y: 0, w: 200 } }, "drend", "x");
  m.run({ type: "createBoard", board: { id: "vitrine", title: "Vitrine Flush", project: "flushstore", tags: [] } }, "drend", "x");
  return m;
}

describe("limpeza: tirarExemplos", () => {
  it("tira os quadros de exemplo intactos, com desfazer", () => {
    const m = comExemplo();
    expect(tirarExemplos(m)).toBe(2);
    expect(Object.keys(m.state.boards)).toEqual([]);
    m.undo();
    expect(m.state.boards.vitrine).toBeDefined();
  });
  it("deixa o quadro que o Rapha mexeu", () => {
    const m = comExemplo();
    m.run({ type: "addCard", card: { id: "meu", boardId: "natal", kind: "nota", title: "meu", x: 0, y: 0, w: 200 } }, "rapha", "x");
    tirarExemplos(m);
    expect(m.state.boards.natal).toBeDefined();
  });
});
