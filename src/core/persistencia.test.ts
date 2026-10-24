import { describe, expect, it } from "vitest";
import { CHAVE, LIMITE_MENSAGENS, repositorioLocal } from "./persistencia";
import { Mural, emptyMural } from "./mural";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("repositorioLocal", () => {
  it("salva e volta o mural com o desfazer funcionando", () => {
    const s = memoria();
    const repo = repositorioLocal<string>(s);
    const m = new Mural(emptyMural());
    m.run({ type: "createBoard", board: { id: "q", title: "Q", project: "drend", tags: [] } }, "drend", "Criou Q");
    repo.salvar({ mural: { state: m.state, log: m.log }, caixaDeEntrada: ["ideia"], mensagens: ["oi"] });

    const r = repo.carregar();
    expect(r?.caixaDeEntrada).toEqual(["ideia"]);
    const volta = Mural.restaurar(r!.mural);
    expect(volta.state.boards.q).toBeDefined();
    const desfez = volta.undo();
    expect(desfez?.id).toBe("log-2");
    expect(volta.state.boards.q).toBeUndefined();
  });

  it("ignora dado corrompido ou de outra versão", () => {
    const s = memoria();
    s.setItem(CHAVE, "{quebrado");
    expect(repositorioLocal(s).carregar()).toBeNull();
    s.setItem(CHAVE, JSON.stringify({ v: 99 }));
    expect(repositorioLocal(s).carregar()).toBeNull();
  });

  it("não quebra quando o armazenamento falha", () => {
    const quebrado = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    const repo = repositorioLocal(quebrado);
    expect(repo.carregar()).toBeNull();
    expect(() => repo.salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [] })).not.toThrow();
  });

  it("guarda só as últimas mensagens", () => {
    const s = memoria();
    const repo = repositorioLocal<number>(s);
    repo.salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: Array.from({ length: 100 }, (_, i) => i) });
    expect(repo.carregar()?.mensagens).toHaveLength(LIMITE_MENSAGENS);
  });
});
