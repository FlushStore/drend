import { describe, expect, it } from "vitest";
import { buscar, daAgenda, dasMissoes, dasTarefas, doMural, marcar, normalizar, pontuar, termos, trechoDe, type Parte } from "./busca";
import type { EventoMissao } from "./missao";
import type { Tarefa } from "./tarefas";

const texto = (ps: Parte[]) => ps.map((p) => (p.marca ? `[${p.t}]` : p.t)).join("");

describe("normalizar e termos", () => {
  it("tira acento e maiúscula", () => {
    expect(normalizar("Reunião ÀS 14h")).toBe("reuniao as 14h");
    expect(termos("  Reunião   reuniao  Ação ")).toEqual(["reuniao", "acao"]);
    expect(termos("   ")).toEqual([]);
  });
});

describe("marcar", () => {
  it("marca no original mesmo buscando sem acento", () => {
    expect(texto(marcar("Reunião com João", termos("reuniao joao")))).toBe("[Reunião] com [João]");
  });
  it("une marcas que se sobrepõem", () => {
    expect(texto(marcar("abacate", ["aba", "bac"]))).toBe("[abac]ate");
  });
  it("sem termo achado, uma parte só sem marca", () => {
    expect(marcar("Pagar conta", ["xyz"])).toEqual([{ t: "Pagar conta", marca: false }]);
  });
});

describe("trechoDe", () => {
  it("corta em volta do achado com reticências", () => {
    const longo = `${"palavra ".repeat(20)}fornecedor de pods ${"outra ".repeat(30)}`;
    const t = texto(trechoDe(longo, ["fornecedor"])!);
    expect(t.startsWith("…")).toBe(true);
    expect(t.endsWith("…")).toBe(true);
    expect(t).toContain("[fornecedor] de pods");
  });
  it("devolve null sem achado", () => {
    expect(trechoDe("nada aqui", ["pod"])).toBeNull();
  });
});

describe("pontuar", () => {
  it("exige todos os termos", () => {
    expect(pontuar({ titulo: "Ligar para o banco" }, ["ligar", "banco"])).toBeGreaterThan(0);
    expect(pontuar({ titulo: "Ligar para o banco" }, ["ligar", "pix"])).toBe(0);
  });
  it("aceita termo no texto, mas o título vale mais", () => {
    const noTexto = pontuar({ titulo: "Compras", texto: "pods e essências" }, ["pods"]);
    const noTitulo = pontuar({ titulo: "Pods novos" }, ["pods"]);
    expect(noTexto).toBeGreaterThan(0);
    expect(noTitulo).toBeGreaterThan(noTexto);
  });
  it("início de palavra vale mais que meio de palavra", () => {
    expect(pontuar({ titulo: "Ver a loja" }, ["loja"])).toBeGreaterThan(pontuar({ titulo: "Ver alojamento" }, ["loja"]));
  });
});

const tarefas: Tarefa[] = [
  { id: "t1", texto: "Ligar para a Vape Mania", criadaEm: "2026-10-20T10:00:00Z" },
  { id: "t2", texto: "Pagar o aluguel", criadaEm: "2026-10-21T10:00:00Z", feitaEm: "2026-10-22T10:00:00Z" },
];

const eventos: EventoMissao[] = [
  { id: 1, em: "2026-10-23T10:00:00Z", missao: "drend", agente: "claude", tipo: "item", chave: "busca", titulo: "Busca em tudo", texto: "Atalho ⌘K na casca", fase: "agora", ref: null },
];

describe("das fontes para a busca", () => {
  it("tarefas: só as abertas", () => {
    expect(dasTarefas(tarefas).map((t) => t.id)).toEqual(["t1"]);
  });
  it("mural: título, corpo e o quadro como apoio", () => {
    const itens = doMural({
      boards: { b: { id: "b", title: "Flush · ideias", project: "flushstore", tags: [] } },
      cards: { c: { id: "c", boardId: "b", kind: "nota", title: "Promoção", body: "Combo de essência", x: 0, y: 0, w: 220 } },
    });
    expect(itens).toEqual([expect.objectContaining({ tipo: "cartao", titulo: "Promoção", texto: "Combo de essência", apoio: "Flush · ideias", destino: { tela: "mural", cartao: "c" } })]);
  });
  it("missões: o projeto e os itens, com a fase", () => {
    const itens = dasMissoes(eventos, new Date("2026-10-24T10:00:00Z"));
    expect(itens.find((i) => i.id === "drend")).toMatchObject({ titulo: "DREND", destino: { tela: "missoes", missao: "drend", chave: null } });
    expect(itens.find((i) => i.id === "drend/busca")).toMatchObject({ titulo: "Busca em tudo", apoio: "DREND · Em andamento", destino: { missao: "drend", chave: "busca" } });
  });
  it("agenda: em ordem de início, com o local buscável", () => {
    const itens = daAgenda([
      { id: "b", titulo: "Dentista", local: "Centro", inicio: "2026-10-26T14:00:00", fim: "2026-10-26T15:00:00", diaInteiro: false, dia: "2026-10-26" },
      { id: "a", titulo: "Reunião", local: null, inicio: "2026-10-25T09:00:00", fim: "2026-10-25T10:00:00", diaInteiro: false, dia: "2026-10-25" },
    ]);
    expect(itens.map((i) => i.id)).toEqual(["a", "b"]);
    expect(itens[1].texto).toBe("Centro");
    expect(itens[1].apoio).toContain("26/10 · 14:00");
  });
});

describe("buscar", () => {
  const itens = [
    ...dasTarefas(tarefas),
    ...dasMissoes(eventos, new Date("2026-10-24T10:00:00Z")),
    ...doMural({ boards: {}, cards: { c: { id: "c", boardId: "x", kind: "nota", title: "Lista", body: "Comprar pods da Vape Mania", x: 0, y: 0, w: 220 } } }),
  ];

  it("consulta vazia não acha nada", () => {
    expect(buscar(itens, "  ")).toEqual([]);
  });

  it("agrupa na ordem fixa e só com os grupos que acharam", () => {
    const g = buscar(itens, "vape mania");
    expect(g.map((x) => x.tipo)).toEqual(["tarefa", "cartao", "missao"]);
    expect(g[2].achados.map((a) => a.titulo)).toEqual(["Vape Mania"]);
  });

  it("sem acento acha com acento e marca o trecho do texto", () => {
    const [g] = buscar(itens, "atalho");
    expect(g.tipo).toBe("missao");
    expect(texto(g.achados[0].trecho!)).toBe("[Atalho] ⌘K na casca");
    expect(texto(g.achados[0].tituloMarcado)).toBe("Busca em tudo");
  });

  it("o mais parecido vem primeiro dentro do grupo", () => {
    const g = buscar([
      { tipo: "tarefa", id: "1", titulo: "Revisar o texto da busca", destino: { tela: "hoje", tarefa: "1" } },
      { tipo: "tarefa", id: "2", titulo: "Busca", destino: { tela: "hoje", tarefa: "2" } },
    ], "busca");
    expect(g[0].achados.map((a) => a.id)).toEqual(["2", "1"]);
  });

  it("respeita o limite por grupo", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({ tipo: "tarefa" as const, id: `${i}`, titulo: `Pod ${i}`, destino: { tela: "hoje" as const, tarefa: `${i}` } }));
    expect(buscar(muitos, "pod", 5)[0].achados).toHaveLength(5);
  });

  it("nada achado: lista vazia (a tela diz “Nada com «x»”)", () => {
    expect(buscar(itens, "zzz")).toEqual([]);
  });
});
