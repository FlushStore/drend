import { describe, expect, it } from "vitest";
import { acharNota, blocos, buscar, daAba, nomeDoProjeto, projetosDoVault, responderProjetos, responderVault, trechos, unir, type NotaVault } from "./vault";
import { entender } from "./comandos";

const n = (o: Partial<NotaVault>): NotaVault => ({
  vault: "segundo-cerebro", caminho: "x.md", titulo: "X", pasta: "", tipo: null, status: null, projeto: null, papel: null, proxima: null, tags: [], resumo: "", modificado: null, ...o,
});

describe("vault", () => {
  it("une os dois vaults: fica a nota mais nova; no empate, a do Segundo Cérebro", () => {
    const a = n({ vault: "rapha-os-business", caminho: "a.md", modificado: "2026-10-02" });
    const b = n({ vault: "segundo-cerebro", caminho: "a.md", modificado: "2026-10-01" });
    const c = n({ vault: "rapha-os-business", caminho: "c.md", modificado: "2026-10-01" });
    const d = n({ vault: "segundo-cerebro", caminho: "c.md", modificado: "2026-10-01" });
    const u = unir([a, b, c, d]);
    expect(u).toHaveLength(2);
    expect(u.find((x) => x.caminho === "a.md")?.vault).toBe("rapha-os-business");
    expect(u.find((x) => x.caminho === "c.md")?.vault).toBe("segundo-cerebro");
  });

  it("projetos: só hubs fora do arquivo, ativos primeiro, com nome limpo", () => {
    const ps = projetosDoVault([
      n({ caminho: "p/a.md", titulo: "00 - Hub Loja", papel: "hub", status: "blocked" }),
      n({ caminho: "p/b.md", titulo: "Flush PROJECT", papel: "hub", status: "active" }),
      n({ caminho: "99 - Archive/c.md", pasta: "99 - Archive", titulo: "Velho", papel: "hub", status: "active" }),
      n({ caminho: "p/d.md", titulo: "Nota", status: "active" }),
    ]);
    expect(ps.map(nomeDoProjeto)).toEqual(["Flush", "Loja"]);
  });

  it("abas de ideias e decisões pela pasta ou pelo tipo", () => {
    const ns = [n({ caminho: "1.md", pasta: "11 - Ideas" }), n({ caminho: "2.md", tipo: "decision" }), n({ caminho: "3.md", pasta: "05 - Decisions" })];
    expect(daAba(ns, "ideias")).toHaveLength(1);
    expect(daAba(ns, "decisoes")).toHaveLength(2);
  });

  it("busca: todas as palavras precisam aparecer; título vale mais", () => {
    const ns = [n({ caminho: "1.md", titulo: "Fornecedor de essências", resumo: "" }), n({ caminho: "2.md", titulo: "Compras", resumo: "lista do fornecedor de essências" }), n({ caminho: "3.md", titulo: "Fornecedor" })];
    expect(buscar(ns, "fornecedor essencias").map((x) => x.caminho)).toEqual(["1.md", "2.md"]);
  });

  it("acha o destino de um [[link]] pelo nome do arquivo ou pelo título", () => {
    const ns = [n({ caminho: "a/02 - Estado Atual.md", titulo: "Estado" }), n({ caminho: "b/z.md", titulo: "Contexto do Projeto" })];
    expect(acharNota(ns, "02 - Estado Atual#Hoje")?.caminho).toBe("a/02 - Estado Atual.md");
    expect(acharNota(ns, "contexto do projeto")?.caminho).toBe("b/z.md");
    expect(acharNota(ns, "não existe")).toBeNull();
  });

  it("markdown em blocos: títulos, avisos, listas com caixa, tabela e código; Dataview fora", () => {
    const md = "# T\n\n> [!info] Pausado\n> texto\n\n- [x] feito\n- [ ] falta\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```dataview\nTABLE x\n```\n\n```js\nx()\n```\n\nUm **forte** e [[Nota|rótulo]] e https://drend.vercel.app/";
    const b = blocos(md);
    expect(b.map((x) => x.t)).toEqual(["titulo", "aviso", "lista", "tabela", "codigo", "paragrafo"]);
    expect(b[1]).toMatchObject({ tipo: "info", linhas: [[{ t: "texto", v: "texto" }]] });
    expect(b[2]).toMatchObject({ itens: [{ feito: true }, { feito: false }] });
    expect(b[3]).toMatchObject({ linhas: [[[{ v: "a" }], [{ v: "b" }]], [[{ v: "1" }], [{ v: "2" }]]] });
    expect(trechos("Um **forte** e [[Nota|rótulo]]")).toEqual([
      { t: "texto", v: "Um " }, { t: "forte", v: "forte" }, { t: "texto", v: " e " }, { t: "nota", alvo: "Nota", v: "rótulo" },
    ]);
  });

  it("conversa: responde com o que achou, ou diz por que não leu", () => {
    const ns = [n({ caminho: "1.md", titulo: "Black Store", resumo: "Catálogo da loja." }), n({ caminho: "2.md", titulo: "00 - Hub Black Store", papel: "hub", status: "blocked", proxima: "Esperar a cliente" })];
    expect(responderVault(ns, "black store")).toContain("• Black Store: Catálogo da loja.");
    expect(responderVault(ns, "xyz")).toContain("Não achei");
    expect(responderVault(null, "x", "Entre na conta.")).toBe("Entre na conta.");
    expect(responderProjetos(ns)).toBe("Projetos no vault:\n• Black Store (Pausado): Esperar a cliente");
  });

  it("entende os pedidos do vault sem pegar os outros", () => {
    expect(entender("O que o vault diz sobre a Black Store?")).toEqual({ tipo: "vault", termo: "black store" });
    expect(entender("procura no obsidian fornecedor")).toEqual({ tipo: "vault", termo: "fornecedor" });
    expect(entender("o que eu anotei sobre kit de natal")).toEqual({ tipo: "vault", termo: "kit de natal" });
    expect(entender("como estão os projetos?")).toEqual({ tipo: "projetosVault" });
    expect(entender("o que tenho amanhã?")).toEqual({ tipo: "agenda", quando: "amanha" });
    expect(entender("como está a missão?")).toEqual({ tipo: "missaoStatus", missao: null });
  });
});
