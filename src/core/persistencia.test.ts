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

  it("retrato antigo, sem dinheiro nem hábitos, continua válido; os novos campos voltam", () => {
    const s = memoria();
    const antigo = { v: 1, salvoEm: "2026-10-20T00:00:00Z", mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [], tarefas: [] };
    s.setItem(CHAVE, JSON.stringify(antigo));
    const r = repositorioLocal(s).carregar();
    expect(r).not.toBeNull();
    expect(r?.lancamentos).toBeUndefined();
    expect(r?.habitos).toBeUndefined();

    const lancamentos = [{ id: "l1", tipo: "gasto" as const, valor: 50, descricao: "Mercado", categoria: "mercado", em: "2026-10-24T12:00:00Z" }];
    const habitos = [{ id: "h1", nome: "Academia", criadoEm: "2026-10-24T12:00:00Z", feitos: ["2026-10-24"] }];
    repositorioLocal(s).salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [], lancamentos, habitos });
    const volta = repositorioLocal(s).carregar();
    expect(volta?.lancamentos).toEqual(lancamentos);
    expect(volta?.habitos).toEqual(habitos);

    s.setItem(CHAVE, JSON.stringify({ ...antigo, habitos: "quebrado" }));
    expect(repositorioLocal(s).carregar()).toBeNull();
  });

  it("contas: retrato sem o campo continua válido; com o campo, volta igual", () => {
    const s = memoria();
    const antigo = { v: 1, salvoEm: "2026-10-20T00:00:00Z", mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [], lancamentos: [], habitos: [] };
    s.setItem(CHAVE, JSON.stringify(antigo));
    expect(repositorioLocal(s).carregar()?.contas).toBeUndefined();

    const contas = [{ id: "c1", nome: "Luz", dia: 10, valor: 200, ativa: true, criadaEm: "2026-10-01T12:00:00Z", pagamentos: [{ mes: "2026-10", em: "2026-10-10T12:00:00Z", valor: 200, lancamento: "l1" }] }];
    repositorioLocal(s).salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [], contas });
    expect(repositorioLocal(s).carregar()?.contas).toEqual(contas);

    s.setItem(CHAVE, JSON.stringify({ ...antigo, contas: "quebrado" }));
    expect(repositorioLocal(s).carregar()).toBeNull();
  });

  it("guarda só as últimas mensagens", () => {
    const s = memoria();
    const repo = repositorioLocal<number>(s);
    repo.salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: Array.from({ length: 100 }, (_, i) => i) });
    expect(repo.carregar()?.mensagens).toHaveLength(LIMITE_MENSAGENS);
  });
});

describe("maisRecente", () => {
  const r = (salvoEm: string) => ({ v: 1 as const, salvoEm, mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [] });
  it("fica com a versão mais nova", async () => {
    const { maisRecente } = await import("./nuvem");
    expect(maisRecente(r("2026-10-24T05:00:00Z"), r("2026-10-24T04:00:00Z"))).toBe("local");
    expect(maisRecente(r("2026-10-24T04:00:00Z"), r("2026-10-24T05:00:00Z"))).toBe("remoto");
    expect(maisRecente(null, r("2026-10-24T05:00:00Z"))).toBe("remoto");
    expect(maisRecente(r("2026-10-24T05:00:00Z"), null)).toBe("local");
    expect(maisRecente(null, null)).toBe("nenhum");
  });
});
