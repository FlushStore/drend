import { describe, expect, it } from "vitest";
import {
  LIMITE_GERAL,
  META_FLUSH_MES,
  chaveDoLimite,
  confirmarLimite,
  desfazerMudanca,
  podeDesfazer,
  registrarMudanca,
  estadoDoLimite,
  lerLimite,
  lerMetas,
  lerTirar,
  limitesDoMes,
  mudarMeta,
  progressoDaMeta,
  responderMetas,
  textoDosEstourados,
} from "./metas";
import { diasRestantesNoMes } from "./brasilia";
import { novoLancamento, type Lancamento } from "./dinheiro";
import { entender } from "./comandos";
import { resumirMes } from "./financeiro";
import { diasDesde } from "../fontes/flush-regras";

const sp = (s: string) => s.replace(/\u00a0/g, " ");
// Sábado, 24/10/2026, 10h em Brasília.
const agora = new Date("2026-10-24T13:00:00Z");
const gasto = (valor: number, descricao: string, em: string): Lancamento => novoLancamento({ tipo: "gasto", valor, descricao }, new Date(em));
const entrada = (valor: number, em: string): Lancamento => novoLancamento({ tipo: "entrada", valor, descricao: "freela" }, new Date(em));

describe("lerLimite", () => {
  it.each([
    ["limite mercado 800", { categoria: "mercado", valor: 800 }],
    ["Limite do mercado: R$ 800", { categoria: "mercado", valor: 800 }],
    ["limite pro mercado 800 reais", { categoria: "mercado", valor: 800 }],
    ["limite de gasto com uber 200", { categoria: "uber", valor: 200 }],
    ["limite mercado em 1.200", { categoria: "mercado", valor: 1200 }],
    ["limite mercado 800 por mês", { categoria: "mercado", valor: 800 }],
    ["limite de açougue 350,50", { categoria: "açougue", valor: 350.5 }],
    ["limite do mês 3000", { categoria: null, valor: 3000 }],
    ["limite geral 3 mil", { categoria: null, valor: 3000 }],
    ["limite de gastos do mês 2.500", { categoria: null, valor: 2500 }],
    ["limite 3000", { categoria: null, valor: 3000 }],
    ["define o limite do mercado 900", { categoria: "mercado", valor: 900 }],
  ])("%s", (frase, esperado) => {
    expect(lerLimite(frase)).toEqual(esperado);
  });

  it("sem valor, ou nome que não é nome, não é limite", () => {
    expect(lerLimite("limite mercado")).toBeNull();
    expect(lerLimite("limite do cartão 2 3000")).toBeNull();
    expect(lerLimite("qual o limite?")).toBeNull();
    expect(lerLimite("limite mercado 0")).toBeNull();
  });
});

describe("lerTirar", () => {
  it("meta da Flush", () => {
    for (const f of ["tirar meta da flush", "tira a meta", "remove a meta de vendas", "apagar meta do mês", "Tirar a minha meta da FlushStore"]) {
      expect(lerTirar(f), f).toEqual({ tipo: "meta" });
    }
    expect(lerTirar("tirar meta da academia")).toBeNull();
  });
  it("limite", () => {
    expect(lerTirar("tirar limite mercado")).toEqual({ tipo: "limite", categoria: "mercado" });
    expect(lerTirar("tira o limite do mercado")).toEqual({ tipo: "limite", categoria: "mercado" });
    expect(lerTirar("remove o limite do mês")).toEqual({ tipo: "limite", categoria: null });
    expect(lerTirar("tirar limite geral")).toEqual({ tipo: "limite", categoria: null });
  });
});

describe("chat das metas (entender)", () => {
  it("meta da Flush em vários jeitos", () => {
    expect(entender("meta da flush 20 mil")).toEqual({ tipo: "meta", valor: 20000 });
    expect(entender("meta flush 20000")).toEqual({ tipo: "meta", valor: 20000 });
    expect(entender("meta de vendas 15k")).toEqual({ tipo: "meta", valor: 15000 });
    expect(entender("meta da flush em 18 mil")).toEqual({ tipo: "meta", valor: 18000 });
  });
  it("limites, tirar e a pergunta", () => {
    expect(entender("limite mercado 800")).toEqual({ tipo: "limite", categoria: "mercado", valor: 800 });
    expect(entender("limite do mês 3000")).toEqual({ tipo: "limite", categoria: null, valor: 3000 });
    expect(entender("tirar meta da flush")).toEqual({ tipo: "tirarMeta" });
    expect(entender("tirar limite mercado")).toEqual({ tipo: "tirarLimite", categoria: "mercado" });
    for (const f of ["como estão as metas?", "minhas metas", "e as metas?", "como estão os limites?", "metas e limites", "metas do mês"]) {
      expect(entender(f), f).toEqual({ tipo: "metas" });
    }
  });
  it("não rouba o que já existia", () => {
    expect(entender("e a meta?")).toEqual({ tipo: "vendas", periodo: "mes" });
    expect(entender("gastei 50 no mercado")).toMatchObject({ tipo: "lancamento" });
    expect(entender("tirar a tarefa limite do cartão")).toMatchObject({ tipo: "apagarTarefa" });
  });
});

describe("estadoDoLimite", () => {
  it("dentro, perto a partir de 80% e passou só acima do valor", () => {
    expect(estadoDoLimite(0, 800)).toBe("dentro");
    expect(estadoDoLimite(639.99, 800)).toBe("dentro");
    expect(estadoDoLimite(640, 800)).toBe("perto");
    expect(estadoDoLimite(800, 800)).toBe("perto");
    expect(estadoDoLimite(800.01, 800)).toBe("passou");
  });
});

describe("limitesDoMes", () => {
  const lancamentos = [
    gasto(500, "mercado", "2026-10-05T15:00:00Z"),
    gasto(200, "Mercado do bairro", "2026-10-20T15:00:00Z"),
    gasto(150, "uber", "2026-10-21T15:00:00Z"),
    gasto(999, "mercado", "2026-09-30T15:00:00Z"),
    entrada(3000, "2026-10-01T15:00:00Z"),
  ];

  it("soma o gasto real do mês de Brasília por categoria; o geral pega todos os gastos", () => {
    const metas = { [META_FLUSH_MES]: 20000, "limite:mercado": 800, [LIMITE_GERAL]: 800, "limite:uber": 400 };
    const l = limitesDoMes(metas, lancamentos, agora);
    expect(l.map((x) => [x.rotulo, x.gasto, x.estado])).toEqual([
      ["Geral", 850, "passou"],
      ["Mercado", 700, "perto"],
      ["Uber", 150, "dentro"],
    ]);
    expect(l[0]).toMatchObject({ categoria: null, excesso: 50, sobra: 0 });
    expect(l[1]).toMatchObject({ sobra: 100, excesso: 0 });
  });

  it("vira o mês em Brasília: o gasto do dia 31 às 22h (01h UTC) ainda é de outubro", () => {
    const metas = { "limite:mercado": 800 };
    const noite = [gasto(300, "mercado", "2026-11-01T01:00:00Z")];
    expect(limitesDoMes(metas, noite, new Date("2026-10-31T23:00:00Z"))[0].gasto).toBe(300);
    // Dia 1º de novembro em Brasília: o limite continua, o gasto zera.
    const nov = limitesDoMes(metas, noite, new Date("2026-11-01T13:00:00Z"));
    expect(nov[0]).toMatchObject({ gasto: 0, estado: "dentro", limite: 800 });
  });

  it("sem limite definido, nada", () => {
    expect(limitesDoMes({ [META_FLUSH_MES]: 1000 }, lancamentos, agora)).toEqual([]);
  });

  it("a chave reaproveita o nome já salvo", () => {
    const metas = { "limite:açougue": 300 };
    expect(chaveDoLimite(metas, "Acougue")).toBe("limite:açougue");
    expect(chaveDoLimite(metas, "mercado")).toBe("limite:mercado");
    expect(chaveDoLimite(metas, null)).toBe(LIMITE_GERAL);
    expect(chaveDoLimite(metas, "geral")).toBe(LIMITE_GERAL);
  });

  it("a linha do estourado", () => {
    const [geral, mercado] = limitesDoMes({ [LIMITE_GERAL]: 800, "limite:mercado": 600 }, lancamentos, agora);
    expect(sp(textoDosEstourados([mercado]))).toBe("Mercado passou R$ 100");
    expect(textoDosEstourados([geral, mercado])).toBe("Geral e Mercado passaram do limite");
  });
});

describe("progressoDaMeta", () => {
  it("dias restantes contados em Brasília, hoje incluso", () => {
    expect(diasRestantesNoMes(agora)).toBe(8);
    // 31/10 às 23h em Brasília (02h UTC do dia 1º): ainda é o último dia.
    expect(diasRestantesNoMes(new Date("2026-11-01T02:00:00Z"))).toBe(1);
    expect(diasRestantesNoMes(new Date("2026-11-01T03:00:00Z"))).toBe(30);
    expect(diasRestantesNoMes(new Date("2028-02-10T15:00:00Z"))).toBe(20);
  });

  it("% feito, quanto falta e o ritmo por dia", () => {
    expect(progressoDaMeta(20000, 12000, agora)).toEqual({ meta: 20000, faturado: 12000, feito: 0.6, falta: 8000, diasRestantes: 8, porDia: 1000, batida: false });
    expect(progressoDaMeta(10000, 12000, agora)).toMatchObject({ falta: 0, porDia: null, batida: true, feito: 1.2 });
  });
});

describe("responderMetas", () => {
  const sabado = new Date(2026, 9, 24, 15, 0);
  const historico = diasDesde("2026-09-01", sabado).map((dia) => ({ dia, valor: dia.startsWith("2026-10") ? 500 : 100, lucro: 50, pedidos: 1 }));
  const mes = resumirMes(historico, sabado)!;

  it("sem nada, diz como criar", () => {
    expect(responderMetas({}, mes, [], agora)).toMatch(/meta da flush 20 mil/);
  });

  it("meta da Flush com leitura e limites", () => {
    const metas = { [META_FLUSH_MES]: 20000, "limite:mercado": 600 };
    const t = sp(responderMetas(metas, mes, [gasto(650, "mercado", "2026-10-05T15:00:00Z")], agora));
    expect(t).toBe("Flush: R$ 12.000 de R$ 20.000 (60%). Faltam R$ 8.000: R$ 1.000 por dia em 8 dias.\n\nLimites do mês:\n• Mercado: R$ 650 de R$ 600, passou R$ 50");
  });

  it("sem leitura da Flush, só a meta e o que falta", () => {
    expect(sp(responderMetas({ [META_FLUSH_MES]: 20000 }, null, [], agora))).toBe("Flush: meta de R$ 20.000. Falta a leitura da Flush para ver o progresso.");
    expect(responderMetas({ [META_FLUSH_MES]: 20000 }, "carregando", [], agora)).toMatch(/lendo/);
  });

  it("meta batida e limite perto", () => {
    const t = sp(responderMetas({ [META_FLUSH_MES]: 10000, [LIMITE_GERAL]: 1000 }, mes, [gasto(850, "uber", "2026-10-05T15:00:00Z")], agora));
    expect(t).toContain("Flush: meta de R$ 10.000 batida, com R$ 12.000 em outubro.");
    expect(t).toContain("• Geral: R$ 850 de R$ 1.000 (85%, perto)");
  });
});

describe("guardar", () => {
  it("mudarMeta põe e tira sem mexer no resto", () => {
    const m = mudarMeta({ [META_FLUSH_MES]: 1000 }, "limite:mercado", 800);
    expect(m).toEqual({ [META_FLUSH_MES]: 1000, "limite:mercado": 800 });
    expect(mudarMeta(m, META_FLUSH_MES, null)).toEqual({ "limite:mercado": 800 });
  });
  it("lerMetas descarta o que não é valor", () => {
    expect(lerMetas({ a: 10, b: -1, c: "x", d: Number.NaN })).toEqual({ a: 10 });
    expect(lerMetas(null)).toEqual({});
    expect(lerMetas([1])).toEqual({});
  });
  it("confirmarLimite já conta o mês", () => {
    const metas = { "limite:mercado": 800 };
    expect(sp(confirmarLimite("limite:mercado", metas, [gasto(120, "mercado", "2026-10-05T15:00:00Z")], 600, agora))).toBe("Limite de mercado: R$ 800 (era R$ 600). Neste mês gastou R$ 120 até agora. Está em Vida.");
    expect(sp(confirmarLimite(LIMITE_GERAL, { [LIMITE_GERAL]: 100 }, [gasto(120, "mercado", "2026-10-05T15:00:00Z")], null, agora))).toBe("Limite do mês: R$ 100. Neste mês já passou R$ 20. Está em Vida.");
  });
});

describe("desfazer só a mudança mais recente", () => {
  it("800 → 900 → 800: a primeira não volta a valer; desfazer a última volta para 900", () => {
    const k = "limite:mercado";
    const a = registrarMudanca({}, {}, k, 800, "c1");
    const b = registrarMudanca(a.metas, a.carimbos, k, 900, "c2");
    const c = registrarMudanca(b.metas, b.carimbos, k, 800, "c3");
    expect(c.metas[k]).toBe(800);
    // O valor se repete, mas as antigas não podem ser desfeitas.
    expect(podeDesfazer(a.mudanca, c.carimbos)).toBe(false);
    expect(podeDesfazer(b.mudanca, c.carimbos)).toBe(false);
    expect(desfazerMudanca(c.metas, c.carimbos, a.mudanca, "c4")).toBeNull();
    expect(podeDesfazer(c.mudanca, c.carimbos)).toBe(true);
    const volta = desfazerMudanca(c.metas, c.carimbos, c.mudanca, "c4")!;
    expect(volta.metas[k]).toBe(900);
    // O desfazer é uma mudança nova: nada antigo fica ativo, nem ele mesmo de novo.
    expect([a, b, c].some((x) => podeDesfazer(x.mudanca, volta.carimbos))).toBe(false);
    expect(desfazerMudanca(volta.metas, volta.carimbos, c.mudanca, "c5")).toBeNull();
  });

  it("mudança feita na tela também tira o Desfazer do chat; outra chave não interfere", () => {
    const a = registrarMudanca({}, {}, META_FLUSH_MES, 20000, "c1");
    const outra = registrarMudanca(a.metas, a.carimbos, "limite:uber", 200, "c2");
    expect(podeDesfazer(a.mudanca, outra.carimbos)).toBe(true);
    const tela = registrarMudanca(outra.metas, outra.carimbos, META_FLUSH_MES, 20000, "c3");
    expect(podeDesfazer(a.mudanca, tela.carimbos)).toBe(false);
  });

  it("tirar e desfazer devolve o valor", () => {
    const a = registrarMudanca({ "limite:mercado": 800 }, {}, "limite:mercado", null, "c1");
    expect(a.metas).toEqual({});
    expect(a.mudanca).toMatchObject({ antes: 800, depois: null });
    expect(desfazerMudanca(a.metas, a.carimbos, a.mudanca, "c2")!.metas).toEqual({ "limite:mercado": 800 });
  });
});
