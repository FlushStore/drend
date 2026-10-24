import { describe, expect, it } from "vitest";
import { maiorSequencia, periodoDaFlush, proximos7, responderSemana, semanaDaFlush, semanaDasTarefas, semanaDoDinheiro, semanaDosHabitos, seteDias, textoDaVariacao } from "./semana";
import { entender } from "./comandos";
import type { DiaFlush } from "../fontes/flush-regras";
import type { Tarefa } from "./tarefas";
import type { Habito } from "./habitos";
import type { Lancamento } from "./dinheiro";
import type { Compromisso } from "./agenda";

// Sábado, 24/10/2026, 15h em Brasília.
const agora = new Date("2026-10-24T15:00:00-03:00");
const sp = (s: string) => s.split(String.fromCharCode(160)).join(" ");

const dia = (d: string, valor: number, lucro: number, pedidos: number): DiaFlush => ({ dia: d, valor, lucro, pedidos });
// 14 dias: 11/10 a 17/10 (antes) e 18/10 a 24/10 (semana).
const historico: DiaFlush[] = [
  ...["11", "12", "13", "14", "15", "16", "17"].map((d) => dia(`2026-10-${d}`, 100, 30, 1)),
  dia("2026-10-18", 0, 0, 0),
  dia("2026-10-19", 200, 60, 2),
  dia("2026-10-20", 150, 40, 1),
  dia("2026-10-21", 0, 0, 0),
  dia("2026-10-22", 300, 90, 3),
  dia("2026-10-23", 100, 20, 1),
  dia("2026-10-24", 90, 30, 1),
];

describe("seteDias", () => {
  it("os 7 dias de Brasília até hoje", () => {
    expect(seteDias(agora)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
    // 23h30 em Brasília já é dia 25 em UTC, mas o dia continua sendo 24.
    expect(seteDias(new Date("2026-10-24T23:30:00-03:00")).at(-1)).toBe("2026-10-24");
  });
});

describe("semanaDaFlush", () => {
  it("7 dias contra os 7 anteriores, melhor dia e mais vendido", () => {
    const s = semanaDaFlush(historico, [], [{ nome: "Ignite V80", unidades: 6, faturamento: 540 }], agora)!;
    expect(s.dias).toHaveLength(7);
    expect(s.faturamento).toEqual({ atual: 840, anterior: 700, variacao: 0.2 });
    expect(s.lucro.atual).toBe(240);
    expect(s.lucro.anterior).toBe(210);
    expect(s.pedidos).toMatchObject({ atual: 8, anterior: 7 });
    expect(s.melhorDia?.dia).toBe("2026-10-22");
    expect(s.maisVendido?.nome).toBe("Ignite V80");
  });

  it("sem histórico de 14 dias, não compara (nada inventado)", () => {
    const s = semanaDaFlush(undefined, historico.slice(-7), null, agora)!;
    expect(s.faturamento.atual).toBe(840);
    expect(s.faturamento.anterior).toBeNull();
    expect(s.faturamento.variacao).toBeNull();
    expect(s.maisVendido).toBeNull();
  });

  it("sem venda: sem melhor dia; sem base positiva: sem variação", () => {
    const zerado = historico.map((d) => ({ ...d, valor: 0, lucro: 0, pedidos: 0 }));
    const s = semanaDaFlush(zerado, [], null, agora)!;
    expect(s.melhorDia).toBeNull();
    expect(s.faturamento.variacao).toBeNull();
  });

  it("leitura de hoje: período até hoje, sem aviso", () => {
    const s = semanaDaFlush(historico, [], null, agora)!;
    expect(s).toMatchObject({ de: "2026-10-18", ate: "2026-10-24", defasada: false });
    expect(periodoDaFlush(s, agora)).toBeNull();
  });

  it("leitura antiga: o período real, sem dias zerados inventados", () => {
    const antiga = historico.slice(0, -1); // termina em 23/10
    const s = semanaDaFlush(antiga, [], null, agora)!;
    expect(s.dias).toHaveLength(7);
    expect(s.dias.map((d) => d.dia)).not.toContain("2026-10-24");
    expect(s).toMatchObject({ de: "2026-10-17", ate: "2026-10-23", defasada: true });
    expect(s.faturamento.atual).toBe(850);
    expect(periodoDaFlush(s, agora)).toBe("17–23 out · leitura de ontem");
    // Mais antiga ainda, virando o mês.
    const velha = semanaDaFlush(historico.slice(0, 9), [], null, agora)!;
    expect(periodoDaFlush(velha, agora)).toBe("13–19 out · leitura de 19 out");
    expect(periodoDaFlush({ de: "2026-09-28", ate: "2026-10-04", defasada: true }, agora)).toBe("28 set–4 out · leitura de 4 out");
  });

  it("sem leitura, null", () => {
    expect(semanaDaFlush(null)).toBeNull();
    expect(semanaDaFlush([], [])).toBeNull();
  });
});

const tarefa = (id: string, feitaEm?: string): Tarefa => ({ id, texto: id, criadaEm: "2026-10-01T10:00:00.000Z", feitaEm });

describe("semanaDasTarefas", () => {
  it("conta as feitas nos 7 dias de Brasília e as abertas", () => {
    const lista = [
      tarefa("a"),
      tarefa("b"),
      tarefa("c", "2026-10-24T12:00:00-03:00"),
      tarefa("d", "2026-10-18T00:30:00-03:00"),
      // 17/10 às 23h em Brasília (já 18 em UTC): fora da semana.
      tarefa("e", "2026-10-17T23:00:00-03:00"),
    ];
    expect(semanaDasTarefas(lista, agora)).toEqual({ feitas: 2, abertas: 2 });
  });
});

const habito = (nome: string, feitos: string[], criadoEm = "2026-09-01T10:00:00.000Z"): Habito => ({ id: nome, nome, criadoEm, feitos });

describe("hábitos na semana", () => {
  it("maior sequência de sempre", () => {
    expect(maiorSequencia([])).toBe(0);
    expect(maiorSequencia(["2026-10-01"])).toBe(1);
    expect(maiorSequencia(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-05", "2026-10-06"])).toBe(3);
  });

  it("% dos dias, sequência de agora e recorde", () => {
    const [h] = semanaDosHabitos([habito("Academia", ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-19", "2026-10-20", "2026-10-22", "2026-10-23", "2026-10-24"])], agora);
    expect(h).toMatchObject({ feitos: 5, dias: 7, atual: 3, recorde: 4 });
    expect(h.parte).toBeCloseTo(5 / 7);
  });

  it("criado no meio da semana: só os dias desde a criação contam", () => {
    const [h] = semanaDosHabitos([habito("Ler", ["2026-10-23", "2026-10-24"], "2026-10-22T09:00:00-03:00")], agora);
    expect(h).toMatchObject({ feitos: 2, dias: 3 });
  });
});

let n = 0;
const lanc = (tipo: Lancamento["tipo"], valor: number, descricao: string, em: string): Lancamento => ({ id: `l${++n}`, tipo, valor, descricao, categoria: descricao.toLowerCase() || "outros", em });

describe("semanaDoDinheiro", () => {
  it("entradas, gastos, saldo e onde mais gastou nos 7 dias", () => {
    const lista = [
      lanc("gasto", 50, "Mercado", "2026-10-20T10:00:00-03:00"),
      lanc("gasto", 30.5, "Mercado", "2026-10-23T10:00:00-03:00"),
      lanc("gasto", 12.9, "Uber", "2026-10-24T10:00:00-03:00"),
      lanc("entrada", 300, "Freela", "2026-10-22T10:00:00-03:00"),
      lanc("gasto", 999, "Antigo", "2026-10-10T10:00:00-03:00"),
    ];
    const d = semanaDoDinheiro(lista, agora);
    expect(d).toMatchObject({ entradas: 300, gastos: 93.4, saldo: 206.6, n: 4 });
    expect(d.maiorGasto).toEqual({ rotulo: "Mercado", total: 80.5, n: 2 });
  });

  it("sem lançamento na semana, zerado de verdade", () => {
    expect(semanaDoDinheiro([], agora)).toEqual({ entradas: 0, gastos: 0, saldo: 0, n: 0, maiorGasto: null });
  });
});

const comp = (id: string, inicio: string, fim: string, diaInteiro = false): Compromisso => ({ id, titulo: id, local: null, inicio, fim, diaInteiro, dia: inicio.slice(0, 10) });

describe("proximos7", () => {
  it("dos próximos 7 dias, sem o que já acabou hoje e sem repetir o de vários dias", () => {
    const local = new Date(2026, 9, 24, 15, 0);
    const iso = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString().replace(/\.\d+Z$/, "Z");
    const lista = [
      comp("cedo", iso(24, 9), iso(24, 10)),
      comp("tarde", iso(24, 18), iso(24, 19)),
      { ...comp("viagem", iso(26, 8), iso(28, 20)), dia: "2026-10-26" },
      { ...comp("longe", iso(31, 9), iso(31, 10)), dia: "2026-10-31" },
    ];
    expect(proximos7(lista, local).map((c) => c.id)).toEqual(["tarde", "viagem"]);
  });
});

describe("textoDaVariacao", () => {
  it("curto e sem inventar", () => {
    expect(textoDaVariacao(null)).toBeNull();
    expect(textoDaVariacao(0.2)).toBe("+20%");
    expect(textoDaVariacao(-0.08)).toBe("−8%");
    expect(textoDaVariacao(0.001)).toBe("igual");
  });
});

describe("responderSemana", () => {
  it("3–4 linhas com os números reais", () => {
    const texto = sp(responderSemana({
      flush: semanaDaFlush(historico, [], [{ nome: "Ignite V80", unidades: 6, faturamento: 540 }], agora),
      tarefas: [tarefa("a"), tarefa("c", "2026-10-24T12:00:00-03:00")],
      habitos: [habito("Academia", ["2026-10-23", "2026-10-24"])],
      lancamentos: [lanc("gasto", 50, "Mercado", "2026-10-20T10:00:00-03:00"), lanc("entrada", 300, "Freela", "2026-10-22T10:00:00-03:00")],
      agenda: [],
    }, agora));
    const linhas = texto.split("\n");
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toBe("Flush, 7 dias: R$ 840 (+20% contra os 7 dias antes), R$ 240 de lucro, 8 pedidos. Melhor dia: quinta. Mais vendido: Ignite V80.");
    expect(linhas[1]).toBe("1 tarefa concluída, 1 aberta; hábitos: Academia 2/7.");
    expect(linhas[2]).toBe("Seu dinheiro: entrou R$ 300, saiu R$ 50, saldo R$ 250. Mais em Mercado (R$ 50).");
    expect(linhas[3]).toBe("Próximos 7 dias: agenda livre.");
  });

  it("leitura antiga: o chat diz o período real da Flush", () => {
    const texto = sp(responderSemana({ flush: semanaDaFlush(historico.slice(0, -1), [], null, agora), tarefas: [], habitos: [], lancamentos: [], agenda: null }, agora));
    expect(texto.split("\n")[0]).toBe("Flush, 17–23 out (leitura de ontem): R$ 850, R$ 240 de lucro, 8 pedidos. Melhor dia: quinta.");
    const zerada = historico.slice(0, -1).map((d) => ({ ...d, valor: 0, lucro: 0, pedidos: 0 }));
    expect(responderSemana({ flush: semanaDaFlush(zerada, [], null, agora), tarefas: [], habitos: [], lancamentos: [], agenda: null }, agora).split("\n")[0]).toBe("Flush, 17–23 out (leitura de ontem): nenhuma venda.");
  });

  it("sem fonte, diz o que falta e não mostra número de exemplo", () => {
    const texto = responderSemana({ flush: null, tarefas: [], habitos: [], lancamentos: [], agenda: null }, agora);
    expect(texto).toBe("Flush: sem leitura (ligue em Sua conta).\n0 tarefas concluídas, 0 abertas.");
    expect(responderSemana({ flush: "carregando", tarefas: [], habitos: [], lancamentos: [], agenda: null }, agora)).toMatch(/^Flush: estou lendo/);
  });
});

describe("entender: a semana", () => {
  it.each(["como foi a semana?", "Como foi minha semana", "resumo da semana", "me dá o resumo da semana", "revisão semanal", "como tá a semana?"])("%s", (frase) => {
    expect(entender(frase)).toEqual({ tipo: "semana" });
  });

  it("não rouba vendas nem agenda", () => {
    expect(entender("e a semana?")).toEqual({ tipo: "vendas", periodo: "semana" });
    expect(entender("quanto vendi na semana")).toEqual({ tipo: "vendas", periodo: "semana" });
    expect(entender("minha agenda da semana")).toEqual({ tipo: "agenda", quando: "semana" });
    expect(entender("resumo")).toEqual({ tipo: "resumo" });
  });
});
