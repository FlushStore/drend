import { describe, expect, it } from "vitest";
import {
  adicionarLancamento,
  confirmarLancamento,
  gastosPorCategoria,
  lerLancamento,
  lerLancamentos,
  novoLancamento,
  removerLancamento,
  responderDinheiro,
  saldoDoMes,
  ultimos,
  type Lancamento,
} from "./dinheiro";
import { diaEmBrasilia, somarDias } from "./brasilia";

const d = (iso: string) => new Date(iso);

describe("lerLancamento", () => {
  it.each([
    ["gastei 50 no mercado", "gasto", 50, "mercado"],
    ["gastei 12,90 com uber", "gasto", 12.9, "uber"],
    ["Gastei R$ 30 de gasolina.", "gasto", 30, "gasolina"],
    ["paguei 200 reais de luz", "gasto", 200, "luz"],
    ["gastei 12.90 pro ifood", "gasto", 12.9, "ifood"],
    ["recebi 300", "entrada", 300, ""],
    ["recebi 1.200 do freela", "entrada", 1200, "freela"],
    ["recebi 1.200,50 do cliente", "entrada", 1200.5, "cliente"],
    ["ganhei 2 mil de bônus", "entrada", 2000, "bônus"],
    ["caiu 450 na conta", "entrada", 450, "conta"],
  ])("%s", (frase, tipo, valor, descricao) => {
    expect(lerLancamento(frase)).toEqual({ tipo, valor, descricao });
  });

  it("sem valor não é lançamento", () => {
    expect(lerLancamento("paguei o fornecedor")).toBeNull();
    expect(lerLancamento("recebi a encomenda")).toBeNull();
    expect(lerLancamento("gastei 0 no mercado")).toBeNull();
    expect(lerLancamento("me lembra de pagar 50")).toBeNull();
  });
});

describe("saldo e gastos do mês", () => {
  const agora = d("2026-10-24T15:00:00Z");
  const l = (tipo: "gasto" | "entrada", valor: number, descricao: string, em: string) => novoLancamento({ tipo, valor, descricao }, d(em));
  const lista: Lancamento[] = [
    l("entrada", 1200, "freela", "2026-10-02T12:00:00Z"),
    l("gasto", 50, "mercado", "2026-10-10T12:00:00Z"),
    l("gasto", 0.1, "Mercado", "2026-10-11T12:00:00Z"),
    l("gasto", 0.2, "uber", "2026-10-12T12:00:00Z"),
    // 30/09 às 23h em Brasília é setembro, mesmo já sendo 01/10 em UTC.
    l("gasto", 999, "aluguel", "2026-10-01T02:00:00Z"),
  ];

  it("saldo = entradas − gastos, só do mês em Brasília, sem erro de vírgula", () => {
    expect(saldoDoMes(lista, agora)).toEqual({ entradas: 1200, gastos: 50.3, saldo: 1149.7, n: 4 });
  });

  it("agrupa gastos pela descrição, do maior para o menor", () => {
    expect(gastosPorCategoria(lista, agora)).toEqual([
      { categoria: "mercado", rotulo: "Mercado", total: 50.1, n: 2 },
      { categoria: "uber", rotulo: "Uber", total: 0.2, n: 1 },
    ]);
  });

  it("últimos vêm do mais novo, e apagar volta com adicionar", () => {
    expect(ultimos(lista, 2).map((x) => x.descricao)).toEqual(["Uber", "Mercado"]);
    const sem = removerLancamento(lista, lista[1].id);
    expect(sem).toHaveLength(4);
    expect(adicionarLancamento(sem, lista[1])).toHaveLength(5);
    expect(adicionarLancamento(lista, lista[1])).toHaveLength(5);
  });

  it("responde no chat e confirma o lançamento", () => {
    expect(responderDinheiro([], agora)).toMatch(/gastei 50 no mercado/);
    expect(responderDinheiro(lista, agora)).toMatch(/Saldo: R\$\s?1\.149,70/);
    expect(confirmarLancamento(lista[1], lista, agora)).toMatch(/^Anotei: gasto de R\$\s?50 \(Mercado\)/);
  });
});

describe("lerLancamentos", () => {
  it("campo ausente ou estranho vira lista vazia; item ruim fica de fora", () => {
    expect(lerLancamentos(undefined)).toEqual([]);
    expect(lerLancamentos({})).toEqual([]);
    const bom = novoLancamento({ tipo: "gasto", valor: 10, descricao: "pão" });
    expect(lerLancamentos([bom, { id: "x", tipo: "roubo", valor: 1 }, null])).toEqual([bom]);
  });
});

describe("brasília", () => {
  it("o dia vira à meia-noite de Brasília", () => {
    expect(diaEmBrasilia(d("2026-10-25T02:59:00Z"))).toBe("2026-10-24");
    expect(diaEmBrasilia(d("2026-10-25T03:00:00Z"))).toBe("2026-10-25");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
