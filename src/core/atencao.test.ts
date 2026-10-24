import { describe, expect, it } from "vitest";
import { compromissosProximos, cortarAtencao, montarAtencao, responderAtencao, textoDosEsgotados, type ItemDeAtencao } from "./atencao";
import type { Conta } from "./contas";
import type { Habito } from "./habitos";
import type { Compromisso } from "./agenda";
import { entender } from "./comandos";

const sp = (s: string) => s.replace(/\u00a0/g, " ");
// 24/10/2026, 10h em Brasília (13h UTC).
const agora = new Date("2026-10-24T13:00:00Z");

const conta = (nome: string, dia: number, valor: number | null = null, pagaEm: string | null = null): Conta => ({
  id: nome.toLowerCase(),
  nome,
  dia,
  valor,
  ativa: true,
  criadaEm: "2026-09-01T12:00:00Z",
  pagamentos: pagaEm ? [{ mes: pagaEm, em: "2026-10-01T12:00:00Z", valor, lancamento: null }] : [],
});
const habito = (nome: string, feitos: string[] = []): Habito => ({ id: nome.toLowerCase(), nome, criadoEm: "2026-09-01T12:00:00Z", feitos });
const evento = (id: string, inicio: string, fim: string, diaInteiro = false): Compromisso => ({ id, titulo: id, local: null, inicio, fim, diaInteiro, dia: inicio.slice(0, 10) });

const tipos = (l: ItemDeAtencao[]) => l.map((i) => i.chave);

describe("compromissosProximos", () => {
  it("pega o que está rolando e o que começa em até 2 horas; ignora dia inteiro e o que já acabou", () => {
    const lista = [
      evento("passou", "2026-10-24T11:00:00Z", "2026-10-24T12:00:00Z"),
      evento("rolando", "2026-10-24T12:30:00Z", "2026-10-24T13:30:00Z"),
      evento("logo", "2026-10-24T14:45:00Z", "2026-10-24T15:00:00Z"),
      evento("longe", "2026-10-24T15:30:00Z", "2026-10-24T16:00:00Z"),
      evento("aniversario", "2026-10-24T03:00:00Z", "2026-10-25T03:00:00Z", true),
    ];
    expect(compromissosProximos(lista, agora).map((c) => c.id)).toEqual(["rolando", "logo"]);
  });
});

describe("montarAtencao", () => {
  it("sem nada lido ou cadastrado, a lista é vazia", () => {
    expect(montarAtencao({ contas: [], habitos: [], compromissos: null, esgotados: null, agora })).toEqual([]);
  });

  it("ordena: compromisso, atrasadas (a mais antiga antes), hoje, amanhã, esgotados, hábitos", () => {
    const l = montarAtencao({
      contas: [conta("Internet", 25, 99.9), conta("Luz", 10, 200), conta("Agua", 20), conta("Aluguel", 24, 1500), conta("Gas", 30), conta("Paga", 5, 50, "2026-10")],
      habitos: [habito("Academia"), habito("Leitura", ["2026-10-24"]), habito("Agua")],
      compromissos: [evento("Reunião", "2026-10-24T14:00:00Z", "2026-10-24T15:00:00Z")],
      esgotados: 3,
      agora,
    });
    expect(tipos(l)).toEqual(["ag-Reunião", "ct-luz-2026-10", "ct-agua-2026-10", "ct-aluguel-2026-10", "ct-internet-2026-10", "esgotados", "hb-academia", "hb-agua"]);
    const luz = l[1];
    expect(luz.tipo === "conta" && luz.rotulo).toBe("Atrasada há 14 dias");
    expect(l[3].rotulo).toBe("Vence hoje");
    expect(l[4].rotulo).toBe("Vence amanhã");
    expect(l[0].rotulo).toBe("Às 11:00");
  });

  it("esgotados só entra com leitura e com pelo menos um", () => {
    const base = { contas: [], habitos: [], compromissos: [], agora };
    expect(montarAtencao({ ...base, esgotados: 0 })).toEqual([]);
    expect(montarAtencao({ ...base, esgotados: null })).toEqual([]);
    expect(montarAtencao({ ...base, esgotados: 1 })[0]).toMatchObject({ tipo: "esgotados", n: 1, tela: "/negocios" });
  });

  it("usa o dia de Brasília: 23h de sexta em Brasília ainda é sexta", () => {
    const tarde = new Date("2026-10-24T02:00:00Z"); // 23h do dia 23 em Brasília
    const l = montarAtencao({ contas: [], habitos: [habito("Academia", ["2026-10-23"])], compromissos: null, esgotados: null, agora: tarde });
    expect(l).toEqual([]);
  });
});

describe("cortarAtencao", () => {
  const h = (n: number) => habito(`H${n}`);
  it("mostra até 5 e manda o resto para a tela certa", () => {
    const l = montarAtencao({ contas: [], habitos: [1, 2, 3, 4, 5, 6, 7].map(h), compromissos: null, esgotados: null, agora });
    const c = cortarAtencao(l);
    expect(c.visiveis).toHaveLength(5);
    expect(c.escondidos).toBe(2);
    expect(c.verTudo).toBe("/vida");
    expect(cortarAtencao(l.slice(0, 3)).verTudo).toBeNull();
  });
  it("o que sobra só da Flush leva a Negócios", () => {
    const l = montarAtencao({ contas: [conta("A", 1), conta("B", 2), conta("C", 3), conta("D", 4), conta("E", 5)], habitos: [], compromissos: null, esgotados: 2, agora });
    expect(cortarAtencao(l).verTudo).toBe("/negocios");
  });
});

describe("responderAtencao", () => {
  it("contas urgentes e hábitos que faltam", () => {
    const r = responderAtencao([conta("Luz", 10, 200), conta("Aluguel", 24), conta("Longe", 30)], [habito("Academia"), habito("Leitura", ["2026-10-24"])], agora);
    expect(sp(r)).toBe("Contas:\n• Luz: atrasada há 14 dias (R$ 200)\n• Aluguel: vence hoje\n\nHábitos que faltam hoje: Academia.");
  });
  it("tudo feito ou nada cadastrado", () => {
    expect(responderAtencao([], [habito("Leitura", ["2026-10-24"])], agora)).toBe("Hábitos de hoje: todos feitos.");
    expect(responderAtencao([], [], agora)).toBe("");
  });
  it("texto dos esgotados", () => {
    expect(textoDosEsgotados(1)).toBe("1 sabor esgotado");
    expect(textoDosEsgotados(3)).toBe("3 sabores esgotados");
  });
});

describe("no chat", () => {
  it("“o que tenho pra hoje?” e “pendências” caem na mesma resposta (sem comando novo)", () => {
    expect(entender("o que tenho pra hoje?")).toEqual({ tipo: "pendencias" });
    expect(entender("pendências")).toEqual({ tipo: "pendencias" });
  });
});

describe("virada do mês", () => {
  // 15h em Brasília do último dia do mês.
  const fim = (dia: string) => new Date(`${dia}T18:00:00Z`);
  const contaDia1 = (pagaEm: string | null) => conta("Aluguel", 1, 1500, pagaEm);

  it.each([
    ["2026-10-31", "2026-10", "2026-11"],
    ["2026-11-30", "2026-11", "2026-12"],
    ["2026-12-31", "2026-12", "2027-01"],
  ])("em %s, a conta do dia 1 já paga no mês aparece como “Vence amanhã” do mês seguinte", (dia, mesAtual, proximo) => {
    const l = montarAtencao({ contas: [contaDia1(mesAtual)], habitos: [], compromissos: null, esgotados: null, agora: fim(dia) });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ tipo: "conta", mes: proximo, estado: "futura", dias: 1, rotulo: "Vence amanhã", chave: `ct-aluguel-${proximo}` });
    expect(sp(responderAtencao([contaDia1(mesAtual)], [], fim(dia)))).toBe("Contas:\n• Aluguel: vence amanhã (R$ 1.500)");
  });

  it("sem pagar o mês atual, as duas ocorrências aparecem, cada uma com o seu mês", () => {
    const l = montarAtencao({ contas: [contaDia1(null)], habitos: [], compromissos: null, esgotados: null, agora: fim("2026-10-31") });
    expect(l.map((i) => i.tipo === "conta" && [i.mes, i.rotulo])).toEqual([["2026-10", "Atrasada há 30 dias"], ["2026-11", "Vence amanhã"]]);
  });

  it("já paga no mês seguinte ou pausada: não entra", () => {
    const paga: Conta = { ...contaDia1("2026-10"), pagamentos: [...contaDia1("2026-10").pagamentos, { mes: "2026-11", em: "2026-10-30T12:00:00Z", valor: 1500, lancamento: null }] };
    expect(montarAtencao({ contas: [paga], habitos: [], compromissos: null, esgotados: null, agora: fim("2026-10-31") })).toEqual([]);
    expect(montarAtencao({ contas: [{ ...contaDia1("2026-10"), ativa: false }], habitos: [], compromissos: null, esgotados: null, agora: fim("2026-10-31") })).toEqual([]);
  });

  it("fora do último dia, nada do mês seguinte entra", () => {
    expect(montarAtencao({ contas: [contaDia1("2026-10")], habitos: [], compromissos: null, esgotados: null, agora: fim("2026-10-30") })).toEqual([]);
  });
});

describe("limite que passou", () => {
  const l = (rotulo: string, estado: "dentro" | "perto" | "passou", excesso = 0) => ({ chave: `limite:${rotulo}`, categoria: rotulo, rotulo, limite: 100, gasto: 100 + excesso, parte: 1, estado, sobra: 0, excesso });

  it("entra numa linha só, depois dos esgotados e antes dos hábitos", () => {
    const itens = montarAtencao({ contas: [], habitos: [habito("Ler")], compromissos: null, esgotados: 2, limites: [l("Mercado", "passou", 50), l("Uber", "perto")], agora });
    expect(tipos(itens)).toEqual(["esgotados", "limites", "hb-ler"]);
    const lim = itens[1];
    expect(lim.tipo === "limite" && sp(lim.texto)).toBe("Mercado passou R$ 50");
    const dois = montarAtencao({ contas: [], habitos: [], compromissos: null, esgotados: null, limites: [l("Mercado", "passou", 50), l("Geral", "passou", 10)], agora });
    expect(dois).toHaveLength(1);
    expect(dois[0].tipo === "limite" && dois[0].texto).toBe("Mercado e Geral passaram do limite");
  });

  it("dentro ou perto não pede atenção", () => {
    expect(montarAtencao({ contas: [], habitos: [], compromissos: null, esgotados: null, limites: [l("Uber", "perto")], agora })).toEqual([]);
  });

  it("no chat", () => {
    expect(sp(responderAtencao([], [], agora, [l("Mercado", "passou", 50)]))).toBe("Mercado passou do limite em R$ 50.");
  });
});
