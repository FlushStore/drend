import { describe, expect, it } from "vitest";
import {
  adicionarConta,
  confirmarPagamento,
  contaParaPagar,
  contasDoMes,
  desmarcarPaga,
  diasNoMes,
  editarConta,
  lerConta,
  lerContas,
  lerPagamentoDeConta,
  lerValorDaConta,
  marcarPaga,
  novaConta,
  removerConta,
  responderContas,
  semLancamento,
  situacao,
  substituirConta,
  textoDoEstado,
  totaisDoMes,
  vencimentoNoMes,
  type Conta,
} from "./contas";
import { entender } from "./comandos";
import { levelOf, needsApproval } from "./permissions";

const nbsp = (s: string) => s.replace(/\u00a0/g, " ");
// 10 de outubro de 2026, 9h em Brasília (12h UTC).
const DIA10 = new Date("2026-10-10T12:00:00Z");
const conta = (nome: string, dia: number, valor: number | null, extra: Partial<Conta> = {}): Conta => ({ id: nome.toLowerCase(), nome, dia, valor, ativa: true, criadaEm: "2026-10-01T12:00:00Z", pagamentos: [], ...extra });

describe("lerConta", () => {
  it.each([
    ["conta de luz todo dia 10, 200 reais", { nome: "Luz", dia: 10, valor: 200 }],
    ["internet dia 15 R$ 99,90", { nome: "Internet", dia: 15, valor: 99.9 }],
    ["aluguel dia 5 1.500", { nome: "Aluguel", dia: 5, valor: 1500 }],
    ["nova conta: água dia 20", { nome: "Água", dia: 20, valor: null }],
    ["conta fixa academia todo dia 31 de 120", { nome: "Academia", dia: 31, valor: 120 }],
    ["Conta do celular dia 8 de cada mês, 59.90", { nome: "Celular", dia: 8, valor: 59.9 }],
    ["condomínio vence dia 7 R$ 450", { nome: "Condomínio", dia: 7, valor: 450 }],
  ])("%s", (frase, esperado) => {
    expect(lerConta(frase)).toEqual(esperado);
  });

  it("sem “conta” e sem valor não é conta (não rouba agenda nem tarefa)", () => {
    expect(lerConta("reunião dia 10")).toBeNull();
    expect(lerConta("reunião dia 10 às 15h")).toBeNull();
    expect(lerConta("me lembra de pagar a luz dia 10")).toBeNull();
    expect(lerConta("conta de luz dia 40, 200")).toBeNull();
    expect(lerConta("conta de luz dia 0")).toBeNull();
  });

  it("valores do jeito que ele fala", () => {
    expect(lerValorDaConta("200 reais")).toBe(200);
    expect(lerValorDaConta(", R$ 1.234,56")).toBe(1234.56);
    expect(lerValorDaConta("de 2 mil")).toBe(2000);
    expect(lerValorDaConta("às 15h")).toBeNull();
  });
});

describe("vencimento e estado no mês (Brasília)", () => {
  it("mês curto vence no último dia", () => {
    expect(diasNoMes("2026-02")).toBe(28);
    expect(diasNoMes("2028-02")).toBe(29);
    expect(vencimentoNoMes({ dia: 31 }, "2026-09")).toBe("2026-09-30");
    expect(vencimentoNoMes({ dia: 30 }, "2026-02")).toBe("2026-02-28");
    expect(vencimentoNoMes({ dia: 5 }, "2026-10")).toBe("2026-10-05");
  });

  it("vence hoje, vence em N dias, atrasada e paga", () => {
    expect(situacao(conta("Luz", 10, 200), DIA10)).toMatchObject({ estado: "hoje", dias: 0, vence: "2026-10-10" });
    expect(situacao(conta("Internet", 15, 99.9), DIA10)).toMatchObject({ estado: "futura", dias: 5 });
    expect(situacao(conta("Aluguel", 5, 1500), DIA10)).toMatchObject({ estado: "atrasada", dias: 5 });
    const paga = conta("Luz", 10, 200, { pagamentos: [{ mes: "2026-10", em: "2026-10-09T12:00:00Z", valor: 210, lancamento: "l1" }] });
    expect(situacao(paga, DIA10)).toMatchObject({ estado: "paga", valor: 210 });
    expect(textoDoEstado({ estado: "futura", dias: 1 })).toBe("Vence amanhã");
    expect(textoDoEstado({ estado: "futura", dias: 5 })).toBe("Vence em 5 dias");
    expect(textoDoEstado({ estado: "atrasada", dias: 2 })).toBe("Atrasada há 2 dias");
  });

  it("o dia é o de Brasília: 23h de 9/10 em Brasília ainda é dia 9", () => {
    expect(situacao(conta("Luz", 10, 200), new Date("2026-10-10T02:00:00Z"))).toMatchObject({ estado: "futura", dias: 1 });
  });

  it("pagamento do mês passado não paga este mês", () => {
    const c = conta("Luz", 10, 200, { pagamentos: [{ mes: "2026-09", em: "2026-09-10T12:00:00Z", valor: 200, lancamento: "l0" }] });
    expect(situacao(c, DIA10).estado).toBe("hoje");
  });

  it("lista por vencimento, total e quanto falta (conta sem valor só é contada)", () => {
    const lista = [
      conta("Internet", 15, 99.9),
      conta("Luz", 10, 200, { pagamentos: [{ mes: "2026-10", em: "x", valor: 200, lancamento: "l1" }] }),
      conta("Aluguel", 5, 1500),
      conta("Água", 20, null),
      conta("Netflix", 3, 40, { ativa: false }),
    ];
    const itens = contasDoMes(lista, DIA10);
    expect(itens.map((i) => i.conta.nome)).toEqual(["Aluguel", "Luz", "Internet", "Água"]);
    expect(totaisDoMes(itens)).toEqual({ total: 1799.9, pago: 200, falta: 1599.9, semValor: 1, abertas: 3 });
  });
});

describe("operações (desfazer é voltar à lista anterior)", () => {
  it("cadastra sem duplicar pelo nome", () => {
    const c = novaConta({ nome: "luz", dia: 10, valor: 200 }, DIA10);
    expect(c).toMatchObject({ nome: "Luz", ativa: true, pagamentos: [] });
    const l = adicionarConta([], c);
    expect(adicionarConta(l, novaConta({ nome: "LUZ", dia: 12, valor: null }))).toHaveLength(1);
    expect(removerConta(l, c.id)).toEqual([]);
  });

  it("marca e desmarca paga sem repetir no mês", () => {
    const l = [conta("Luz", 10, 200)];
    const p = { mes: "2026-10", em: "x", valor: 200, lancamento: "l1" };
    const pago = marcarPaga(l, "luz", p);
    expect(marcarPaga(pago, "luz", { ...p, lancamento: "l2" })[0].pagamentos).toEqual([p]);
    expect(desmarcarPaga(pago, "luz", "2026-10")[0].pagamentos).toEqual([]);
    expect(l[0].pagamentos).toEqual([]);
  });

  it("apagar o gasto devolve a conta para a pagar e diz o que tirou", () => {
    const p = { mes: "2026-10", em: "x", valor: 200, lancamento: "l1" };
    const l = [conta("Luz", 10, 200, { pagamentos: [p] }), conta("Internet", 15, 99.9)];
    const r = semLancamento(l, "l1");
    expect(r.contas[0].pagamentos).toEqual([]);
    expect(r.removidos).toEqual([{ conta: "luz", pagamento: p }]);
    expect(semLancamento(l, "outro").removidos).toEqual([]);
  });

  it("edita e volta como estava", () => {
    const antes = conta("Luz", 10, 200);
    const depois = editarConta([antes], "luz", { nome: "energia", dia: 12, valor: 0, ativa: false });
    expect(depois[0]).toMatchObject({ nome: "Energia", dia: 12, valor: null, ativa: false });
    expect(editarConta([antes], "luz", { dia: 40 })[0].dia).toBe(10);
    expect(substituirConta(depois, antes)).toEqual([antes]);
  });

  it("“paguei a luz” acha a conta ativa não paga do mês; empate não chuta", () => {
    const l = [conta("Luz", 10, 200), conta("Internet", 15, 99.9), conta("Água", 20, null, { ativa: false })];
    expect(contaParaPagar(l, "luz", DIA10)).toEqual({ achado: l[0] });
    expect(contaParaPagar(l, "a conta de luz", DIA10)).toEqual({ achado: l[0] });
    expect(contaParaPagar(l, "água", DIA10)).toBeNull();
    expect(contaParaPagar(l, "fornecedor", DIA10)).toBeNull();
    const paga = marcarPaga(l, "luz", { mes: "2026-10", em: "x", valor: 200, lancamento: null });
    expect(contaParaPagar(paga, "luz", DIA10)).toBeNull();
    const duas = [conta("Cartão Nubank", 5, 300), conta("Cartão Inter", 8, 200)];
    expect(contaParaPagar(duas, "cartão", DIA10)).toEqual({ empate: duas });
    expect(lerPagamentoDeConta("paguei a luz")).toBe("luz");
    expect(lerPagamentoDeConta("paguei 200 de luz")).toBeNull();
  });

  it("retrato antigo ou corrompido: só entra conta válida", () => {
    expect(lerContas(undefined)).toEqual([]);
    expect(lerContas("x")).toEqual([]);
    const ok = conta("Luz", 10, 200);
    expect(lerContas([ok, { id: "x", nome: "", dia: 3 }, { ...ok, id: "y", dia: 32 }, { ...ok, id: "z", valor: -1 }])).toEqual([ok]);
    expect(lerContas([{ ...ok, pagamentos: [{ mes: "ruim" }], ativa: undefined }])[0]).toMatchObject({ ativa: true, pagamentos: [] });
  });
});

describe("respostas", () => {
  it("sem conta, diz como cadastrar", () => {
    expect(responderContas([], DIA10)).toMatch(/ainda não tem conta fixa/);
  });

  it("minhas contas: o mês com o que falta", () => {
    const l = [conta("Luz", 10, 200), conta("Aluguel", 5, 1500, { pagamentos: [{ mes: "2026-10", em: "x", valor: 1500, lancamento: "l1" }] })];
    expect(nbsp(responderContas(l, DIA10))).toBe("Contas de outubro: R$ 1.700 no mês, faltam R$ 200 (1 conta a pagar).\n• Aluguel, dia 5: paga (R$ 1.500)\n• Luz, dia 10: vence hoje (R$ 200)");
  });

  it("confirma o pagamento com o gasto lançado", () => {
    const p = { mes: "2026-10", em: "x", valor: 200, lancamento: "l1" };
    const l = [conta("Luz", 10, 200, { pagamentos: [p] })];
    expect(nbsp(confirmarPagamento(l[0], p, l, DIA10))).toBe("Luz paga. Lancei o gasto de R$ 200 no dinheiro. Todas as contas do mês pagas.");
  });
});

describe("chat e permissões", () => {
  it("entende cadastro, pergunta e pagamento", () => {
    expect(entender("conta de luz todo dia 10, 200 reais")).toEqual({ tipo: "novaConta", conta: { nome: "Luz", dia: 10, valor: 200 } });
    expect(entender("internet dia 15 R$ 99,90")).toEqual({ tipo: "novaConta", conta: { nome: "Internet", dia: 15, valor: 99.9 } });
    for (const f of ["quais contas vencem?", "minhas contas", "contas do mês", "o que falta pagar?", "quanto falta pagar"]) expect(entender(f)).toEqual({ tipo: "contas" });
    expect(entender("paguei a luz")).toEqual({ tipo: "pagarConta", texto: "luz", frase: "paguei a luz" });
    // Com valor continua gasto (o app integra com a conta), e "já paguei X" continua concluir.
    expect(entender("paguei 200 de luz")).toMatchObject({ tipo: "lancamento" });
    expect(entender("já paguei o fornecedor")).toEqual({ tipo: "concluir", texto: "paguei o fornecedor" });
  });

  it("anotar, marcar, editar e apagar conta são nível B", () => {
    for (const a of ["conta.criar", "conta.pagar", "conta.editar", "conta.apagar"]) {
      expect(levelOf(a)).toBe("B");
      expect(needsApproval(a)).toBe(false);
    }
  });
});
