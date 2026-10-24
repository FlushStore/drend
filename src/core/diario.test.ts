import { describe, expect, it } from "vitest";
import {
  anotar,
  confirmarAnotacao,
  dataCurta,
  desfazerAnotacao,
  detectarHumor,
  diaDaConsulta,
  diasAnotadosAntes,
  doDia,
  humorDoDia,
  lerAnotacoes,
  lerConsultaDoDiario,
  lerFraseDoDiario,
  novaAnotacao,
  podeDesfazerDiario,
  precisaAnotar,
  responderDiario,
  semanaDoDiario,
  type Anotacao,
} from "./diario";
import { entender } from "./comandos";
import { montarAtencao } from "./atencao";
import { responderSemana, textoDaSemanaDoDiario } from "./semana";
import { repositorioLocal } from "./persistencia";
import { emptyMural } from "./mural";

// Sábado, 24/10/2026. Brasília é UTC−3.
const as21h = new Date("2026-10-25T00:00:00Z"); // 24/10, 21:00 em Brasília
const anota = (texto: string, em: string, humor: number | null = null): Anotacao => novaAnotacao({ texto, humor }, new Date(em));

describe("lerFraseDoDiario", () => {
  it.each([
    ["diário: dia puxado, fechei 3 pedidos", "dia puxado, fechei 3 pedidos", null],
    ["Diario - dia puxado", "dia puxado", null],
    ["nota do dia: reunião boa com o fornecedor", "reunião boa com o fornecedor", null],
    ["nota de hoje: cansei", "cansei", null],
    ["como me sinto: cansado", "Me sinto cansado", null],
    ["como me sinto hoje: ok", "Me sinto ok", 3],
    ["hoje foi bom", "hoje foi bom", 4],
    ["Hoje foi ótimo!", "Hoje foi ótimo", 5],
    ["hoje foi puxado, mas fechei 3 pedidos", "hoje foi puxado, mas fechei 3 pedidos", null],
    ["meu dia foi ruim", "meu dia foi ruim", 2],
    ["o dia foi péssimo", "o dia foi péssimo", 1],
    ["diário: dia 4, fechei 3 pedidos", "dia 4, fechei 3 pedidos", 4],
    ["diário: humor 3, cansado", "humor 3, cansado", 3],
    ["anota no diário: dia bom", "dia bom", 4],
    ["diário: será que vale abrir outra loja?", "será que vale abrir outra loja?", null],
  ])("%s", (frase, texto, humor) => {
    expect(lerFraseDoDiario(frase)).toEqual({ texto, humor });
  });

  it.each([
    "hoje foi bom o jogo?",
    "hoje foi bom?",
    "como me sinto?",
    "como me sinto hoje?",
    "como me sinto hoje",
    "como eu me sinto hoje",
    "hoje foi quanto de venda",
    "hoje foi quanto?",
    "diário:",
    "meu diário da semana",
    "o que anotei ontem?",
    "anota: kit de natal",
    "hoje",
  ])("não grava: %s", (frase) => {
    expect(lerFraseDoDiario(frase)).toBeNull();
  });
});

describe("detectarHumor", () => {
  it("só com algo explícito", () => {
    expect(detectarHumor("dia puxado, fechei 3 pedidos")).toBeNull();
    expect(detectarHumor("fechei um pedido bom com a loja")).toBeNull();
    expect(detectarHumor("não foi bom")).toBeNull();
    expect(detectarHumor("humor 5")).toBe(5);
    expect(detectarHumor("humor: 2/5")).toBe(2);
    expect(detectarHumor("dia bom")).toBe(4);
    expect(detectarHumor("foi um dia ótimo")).toBe(5);
  });

  it("data não é humor; número fora de 1 a 5 também não", () => {
    expect(detectarHumor("entrega no dia 4 de novembro")).toBeNull();
    expect(detectarHumor("vence dia 15")).toBeNull();
    expect(detectarHumor("humor 7")).toBeNull();
  });

  it("número vale mais que palavra; duas palavras diferentes ficam sem humor", () => {
    expect(detectarHumor("dia ruim, humor 3")).toBe(3);
    expect(detectarHumor("manhã: bom. tarde: ruim")).toBeNull();
  });
});

describe("entender (diário)", () => {
  it("anotação vira comando com o humor só quando dito", () => {
    expect(entender("diário: dia puxado, fechei 3 pedidos")).toEqual({ tipo: "diario", texto: "dia puxado, fechei 3 pedidos", humor: null });
    expect(entender("hoje foi bom")).toEqual({ tipo: "diario", texto: "hoje foi bom", humor: 4 });
    expect(entender("como me sinto: cansado")).toEqual({ tipo: "diario", texto: "Me sinto cansado", humor: null });
  });

  it("pergunta não grava", () => {
    expect(entender("hoje foi bom o jogo?")?.tipo).not.toBe("diario");
    expect(entender("como me sinto?")?.tipo).not.toBe("diario");
  });

  it.each([
    ["o que anotei ontem?", "ontem"],
    ["o que eu anotei ontem?", "ontem"],
    ["o que anotei hoje", "hoje"],
    ["meu diário da semana", "semana"],
    ["diário de ontem", "ontem"],
    ["o que anotei essa semana?", "semana"],
    ["como foi terça?", 2],
    ["como foi a sexta-feira?", 5],
    ["como foi ontem?", "ontem"],
    ["como foi o dia de anteontem", "anteontem"],
    ["como foi sábado passado?", 13],
    ["o que anotei na terça passada", 9],
  ])("consulta: %s", (frase, quando) => {
    expect(entender(frase)).toEqual({ tipo: "consultaDiario", quando });
  });

  it("não pega o que já era de outro comando", () => {
    expect(entender("o que eu anotei sobre a black store")?.tipo).toBe("vault");
    expect(entender("como foi a semana?")?.tipo).toBe("semana");
    expect(entender("e ontem?")?.tipo).toBe("vendas");
    expect(entender("anota: kit de natal")?.tipo).toBe("ideia");
    expect(entender("gastei 50 no mercado")?.tipo).toBe("lancamento");
  });

  it("lerConsultaDoDiario sem pedido de diário é null", () => {
    expect(lerConsultaDoDiario("quanto vendi hoje")).toBeNull();
  });
});

describe("acúmulo no mesmo dia", () => {
  it("duas anotações no dia ficam as duas, em ordem, com o horário de cada", () => {
    const a = anota("Dia puxado", "2026-10-24T21:10:00Z"); // 18:10
    const b = anota("Fechei 3 pedidos", "2026-10-24T23:45:00Z", 4); // 20:45
    const r1 = anotar([], a, "c1");
    const r2 = anotar(r1.diario, b, "c2");
    expect(doDia(r2.diario, "2026-10-24").map((x) => x.texto)).toEqual(["Dia puxado", "Fechei 3 pedidos"]);
    expect(confirmarAnotacao(b, r2.diario)).toBe("Anotei no diário, 20:45: “Fechei 3 pedidos”. Humor 4. É a 2ª anotação de hoje. Está em Vida.");
    expect(confirmarAnotacao(a, r1.diario)).toBe("Anotei no diário, 18:10: “Dia puxado”. Está em Vida.");
  });

  it("o humor do dia é o último que ele disse", () => {
    const dia = [anota("a", "2026-10-24T13:00:00Z", 2), anota("b", "2026-10-24T18:00:00Z"), anota("c", "2026-10-24T22:00:00Z", 4)];
    expect(humorDoDia(dia)).toBe(4);
    expect(humorDoDia([anota("x", "2026-10-24T13:00:00Z")])).toBeNull();
  });

  it("a mesma anotação não entra duas vezes", () => {
    const a = anota("Dia puxado", "2026-10-24T21:10:00Z");
    expect(anotar([a], a, "c").diario).toHaveLength(1);
  });
});

describe("virada do dia em Brasília", () => {
  it("23:30 de Brasília ainda é o dia 24; 00:10 já é o 25", () => {
    expect(anota("tarde", "2026-10-25T02:30:00Z").dia).toBe("2026-10-24");
    expect(anota("madrugada", "2026-10-25T03:10:00Z").dia).toBe("2026-10-25");
  });

  it("consultas contam o dia de Brasília, não o UTC", () => {
    const madrugadaUTC = new Date("2026-10-25T01:00:00Z"); // 24/10, 22h em Brasília
    expect(diaDaConsulta("hoje", madrugadaUTC)).toBe("2026-10-24");
    expect(diaDaConsulta("ontem", madrugadaUTC)).toBe("2026-10-23");
    expect(diaDaConsulta(2, madrugadaUTC)).toBe("2026-10-20"); // a terça que passou
    expect(diaDaConsulta(6, madrugadaUTC)).toBe("2026-10-24"); // sábado = hoje
    expect(diaDaConsulta(13, madrugadaUTC)).toBe("2026-10-17"); // sábado passado, nunca hoje
    expect(diaDaConsulta(9, madrugadaUTC)).toBe("2026-10-20"); // terça passada
  });

  it("retrato antigo sem `dia` recupera o dia de Brasília pelo horário", () => {
    const lidas = lerAnotacoes([{ id: "x", em: "2026-10-25T02:30:00Z", texto: "tarde", humor: 9 }, { id: "y", texto: "" }, null, "lixo"]);
    expect(lidas).toEqual([{ id: "x", em: "2026-10-25T02:30:00Z", dia: "2026-10-24", texto: "tarde", humor: null }]);
    expect(lerAnotacoes(undefined)).toEqual([]);
  });
});

describe("respostas do chat", () => {
  const lista = [
    anota("Dia puxado, fechei 3 pedidos", "2026-10-23T21:40:00Z", 3), // sex 23, 18:40
    anota("Melhorou à noite", "2026-10-24T00:30:00Z", 4), // ainda sex 23, 21:30
    anota("Reunião com o fornecedor", "2026-10-20T15:00:00Z"), // ter 20, 12:00
  ];

  it("o que anotei ontem", () => {
    expect(responderDiario(lista, "ontem", as21h)).toBe("Ontem (sexta, 23 out) · humor 4:\n• 18:40 · Dia puxado, fechei 3 pedidos\n• 21:30 · Melhorou à noite");
  });

  it("como foi terça", () => {
    expect(responderDiario(lista, 2, as21h)).toBe("Terça (20 out):\n• 12:00 · Reunião com o fornecedor");
  });

  it("dia sem anotação diz que não tem, sem inventar", () => {
    expect(responderDiario(lista, "hoje", as21h)).toBe("Nada anotado: hoje (24 out).");
    expect(responderDiario([], "semana", as21h)).toBe("Nada anotado nos últimos 7 dias. Diga “diário: …” para anotar o dia.");
  });

  it("diário da semana", () => {
    expect(responderDiario(lista, "semana", as21h)).toBe(
      "Seu diário, 7 dias:\n\nTer, 20 out\n• 12:00 · Reunião com o fornecedor\n\nSex, 23 out · humor 4\n• 18:40 · Dia puxado, fechei 3 pedidos\n• 21:30 · Melhorou à noite\n\n2 dias anotados de 7, humor médio 4.",
    );
  });
});

describe("resumo da semana", () => {
  it("conta os dias anotados nos 7 dias e a média do humor dos dias que têm", () => {
    const lista = [
      anota("a", "2026-10-24T13:00:00Z", 5),
      anota("b", "2026-10-23T13:00:00Z", 2),
      anota("c", "2026-10-22T13:00:00Z"),
      anota("fora da semana", "2026-10-17T13:00:00Z", 1),
    ];
    const s = semanaDoDiario(lista, as21h);
    expect(s).toEqual({ dias: 3, humorMedio: 3.5, diasComHumor: 2 });
    expect(textoDaSemanaDoDiario(s)).toBe("3 de 7 dias anotados · humor médio 3,5");
    expect(textoDaSemanaDoDiario(semanaDoDiario([anota("c", "2026-10-22T13:00:00Z")], as21h))).toBe("1 de 7 dia anotado");
  });

  it("sem anotação: zero e sem média", () => {
    expect(semanaDoDiario([], as21h)).toEqual({ dias: 0, humorMedio: null, diasComHumor: 0 });
  });

  it("a revisão do chat ganha a linha do diário só quando há anotação", () => {
    const base = { flush: null, tarefas: [], habitos: [], lancamentos: [], agenda: null };
    expect(responderSemana({ ...base, diario: [anota("a", "2026-10-24T13:00:00Z", 4)] }, as21h)).toContain("Diário: 1 de 7 dia anotado · humor médio 4.");
    expect(responderSemana({ ...base, diario: [] }, as21h)).not.toContain("Diário");
    expect(responderSemana(base, as21h)).not.toContain("Diário");
  });

  it("os últimos 7 dias com anotação em Vida (antes de hoje, do mais recente para trás)", () => {
    const lista = Array.from({ length: 10 }, (_, i) => anota(`dia ${i}`, `2026-10-${String(10 + i).padStart(2, "0")}T15:00:00Z`));
    lista.push(anota("hoje", "2026-10-24T15:00:00Z"));
    const dias = diasAnotadosAntes(lista, "2026-10-24", 7);
    expect(dias.map((d) => d.dia)).toEqual(["2026-10-19", "2026-10-18", "2026-10-17", "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13"]);
    expect(dataCurta("2026-10-23")).toBe("sex, 23 out");
  });
});

describe("regra das 20h (Hoje)", () => {
  const as1959 = new Date("2026-10-24T22:59:00Z");
  const as20h = new Date("2026-10-24T23:00:00Z");
  const fontes = { contas: [], habitos: [], compromissos: null, esgotados: null };

  it("antes das 20h não pede; às 20h, sem anotação, pede", () => {
    expect(precisaAnotar([], as1959)).toBe(false);
    expect(precisaAnotar([], as20h)).toBe(true);
  });

  it("com anotação de hoje não pede; a de ontem não conta", () => {
    expect(precisaAnotar([anota("x", "2026-10-24T13:00:00Z")], as21h)).toBe(false);
    expect(precisaAnotar([anota("x", "2026-10-23T13:00:00Z")], as21h)).toBe(true);
  });

  it("entra uma linha só no que pede atenção, e só com o diário lido", () => {
    const itens = montarAtencao({ ...fontes, diario: [], agora: as21h });
    expect(itens.filter((i) => i.tipo === "diario")).toEqual([{ tipo: "diario", chave: "diario", texto: "Anotar o dia", rotulo: "Diário", tela: "/vida" }]);
    expect(montarAtencao({ ...fontes, diario: [], agora: as1959 }).some((i) => i.tipo === "diario")).toBe(false);
    expect(montarAtencao({ ...fontes, agora: as21h }).some((i) => i.tipo === "diario")).toBe(false);
  });

  it("vem depois de tudo que é mais urgente", () => {
    const habito = { id: "h1", nome: "Academia", criadoEm: "2026-10-01T12:00:00Z", feitos: [] };
    const itens = montarAtencao({ ...fontes, habitos: [habito], diario: [], agora: as21h });
    expect(itens.map((i) => i.tipo)).toEqual(["habito", "diario"]);
  });
});

describe("desfazer", () => {
  it("só a mudança mais recente pode ser desfeita", () => {
    const a = anota("primeira", "2026-10-24T13:00:00Z");
    const b = anota("segunda", "2026-10-24T14:00:00Z");
    const r1 = anotar([], a, "c1");
    const r2 = anotar(r1.diario, b, "c2");
    expect(podeDesfazerDiario(r1.mudanca, r2.carimbo)).toBe(false);
    expect(desfazerAnotacao(r2.diario, r2.carimbo, r1.mudanca, "c3")).toBeNull();
    expect(podeDesfazerDiario(r2.mudanca, r2.carimbo)).toBe(true);
    const volta = desfazerAnotacao(r2.diario, r2.carimbo, r2.mudanca, "c3")!;
    expect(volta.diario.map((x) => x.texto)).toEqual(["Primeira"]);
    // A volta também é uma mudança: não dá para desfazer de novo, nem a anterior "reativa".
    expect(desfazerAnotacao(volta.diario, volta.carimbo, r2.mudanca, "c4")).toBeNull();
    expect(desfazerAnotacao(volta.diario, volta.carimbo, r1.mudanca, "c4")).toBeNull();
  });

  it("depois de reabrir o app (sem carimbo), nada antigo é desfeito", () => {
    const r = anotar([], anota("x", "2026-10-24T13:00:00Z"), "c1");
    expect(podeDesfazerDiario(r.mudanca, null)).toBe(false);
  });
});

describe("retrato", () => {
  it("o diário vai e volta no retrato; retrato sem o campo continua válido", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const repo = repositorioLocal(storage);
    const diario = [anota("Dia puxado", "2026-10-24T21:10:00Z", 3)];
    repo.salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [], diario });
    expect(repo.carregar()?.diario).toEqual(diario);
    repo.salvar({ mural: { state: emptyMural(), log: [] }, caixaDeEntrada: [], mensagens: [] });
    expect(repo.carregar()?.diario).toBeUndefined();
  });
});
