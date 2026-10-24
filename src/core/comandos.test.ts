import { describe, expect, it } from "vitest";
import { entender, opCriarQuadro, separarItens } from "./comandos";
import { Mural, emptyMural } from "./mural";

describe("entender", () => {
  it("lê o pedido de quadro com cartões", () => {
    expect(entender("Crie um quadro Natal da Flush com cartões Vídeo do pod, Cupom e Stories")).toEqual({
      tipo: "criarQuadro",
      titulo: "Natal",
      projeto: "flushstore",
      cartoes: ["Vídeo do pod", "Cupom", "Stories"],
    });
  });

  it("aceita a forma curta com dois pontos", () => {
    expect(entender("quadro Viagem: passagem; hotel; roteiro")).toMatchObject({ titulo: "Viagem", projeto: "drend", cartoes: ["passagem", "hotel", "roteiro"] });
  });

  it("entende desfazer e ideia", () => {
    expect(entender("desfaz")).toEqual({ tipo: "desfazer" });
    expect(entender("Desfazer a última ação")).toEqual({ tipo: "desfazer" });
    expect(entender("tive uma ideia: kit presente")).toEqual({ tipo: "ideia", texto: "kit presente" });
  });

  it("não inventa comando no que não entende", () => {
    expect(entender("qual sabor de pod combina com café")).toBeNull();
    expect(entender("Beleza, produza o máximo que der")).toBeNull();
    expect(entender("crie um quadro com cartões")).toBeNull();
  });

  it("separa listas com vírgula, ponto e vírgula e 'e'", () => {
    expect(separarItens("a, b e c; d")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("criar quadro por comando", () => {
  it("cria quadro e cartões num lote e um desfazer apaga tudo", () => {
    const m = new Mural(emptyMural());
    const c = entender("crie um quadro Natal com cartões A, B, C, D e E");
    if (c?.tipo !== "criarQuadro") throw new Error("comando não lido");
    const { op, board } = opCriarQuadro(m.state, c);
    m.run(op, "drend", `Criou o quadro ${board.title}`);
    expect(m.cardsOf(board.id)).toHaveLength(5);
    expect(m.state.cards[`${board.id}-c5`]).toMatchObject({ x: 40, y: 210 });
    m.undo();
    expect(m.state).toEqual(emptyMural());
  });

  it("não repete id de quadro", () => {
    const m = new Mural(emptyMural());
    const c = { tipo: "criarQuadro" as const, titulo: "Natal", projeto: "drend", cartoes: ["a"] };
    m.run(opCriarQuadro(m.state, c).op, "drend", "1");
    expect(opCriarQuadro(m.state, c).board.id).toBe("natal-2");
  });

  it("entende tarefas", () => {
    expect(entender("me lembra de pagar o fornecedor")).toEqual({ tipo: "tarefa", texto: "pagar o fornecedor" });
    expect(entender("Lembrar de ligar pro contador")).toEqual({ tipo: "tarefa", texto: "ligar pro contador" });
    expect(entender("tarefa: repor pods")).toEqual({ tipo: "tarefa", texto: "repor pods" });
    expect(entender("preciso responder o fornecedor")).toEqual({ tipo: "tarefa", texto: "responder o fornecedor" });
    expect(entender("tarefa:")).toBeNull();
  });
});

describe("rodada 5: mês, meta e missões", () => {
  it("pergunta do mês", () => {
    for (const f of ["quanto vendi no mês?", "e o mês?", "faturamento do mês", "como tá o mês", "e a meta?", "quanto falta pra bater a meta"]) {
      expect(entender(f), f).toEqual({ tipo: "vendas", periodo: "mes" });
    }
  });

  it("define a meta", () => {
    expect(entender("meta do mês 10 mil")).toEqual({ tipo: "meta", valor: 10000 });
    expect(entender("minha meta é 8000")).toEqual({ tipo: "meta", valor: 8000 });
    expect(entender("Meta: R$ 12.500")).toEqual({ tipo: "meta", valor: 12500 });
    expect(entender("meta da flush 15k")).toEqual({ tipo: "meta", valor: 15000 });
  });

  it("anota na missão certa", () => {
    expect(entender("anota na missão: terminei o login")).toEqual({ tipo: "missaoNota", missao: "drend", texto: "terminei o login" });
    expect(entender("missão flush: subir fotos novas")).toEqual({ tipo: "missaoNota", missao: "flush", texto: "subir fotos novas" });
    expect(entender("anota na missão da vape mania: site no ar")).toEqual({ tipo: "missaoNota", missao: "vape-mania", texto: "site no ar" });
  });

  it("pergunta da missão", () => {
    expect(entender("como está a missão da flush?")).toEqual({ tipo: "missaoStatus", missao: "flush" });
    expect(entender("missões")).toEqual({ tipo: "missaoStatus", missao: null });
    expect(entender("o que falta no drend?")).toEqual({ tipo: "missaoStatus", missao: "drend" });
    expect(entender("o que falta?")).toEqual({ tipo: "pendencias" });
  });

  it("não confunde com o que já existia", () => {
    expect(entender("anota: kit de natal")).toEqual({ tipo: "ideia", texto: "kit de natal" });
    expect(entender("quanto vendi hoje?")).toEqual({ tipo: "vendas", periodo: "hoje" });
    expect(entender("como está a flush?")).toEqual({ tipo: "vendas", periodo: "hoje" });
  });
});

describe("missão com hífen no nome", () => {
  it("vape-mania continua inteiro", () => {
    expect(entender("missão vape-mania: site no ar")).toEqual({ tipo: "missaoNota", missao: "vape-mania", texto: "site no ar" });
    expect(entender("anota na missão da vape-mania: banco ok")).toEqual({ tipo: "missaoNota", missao: "vape-mania", texto: "banco ok" });
    expect(entender("missão flush - fotos novas")).toEqual({ tipo: "missaoNota", missao: "flush", texto: "fotos novas" });
  });
});

describe("agenda na conversa", () => {
  it("entende os jeitos de perguntar", () => {
    expect(entender("o que tenho amanhã?")).toEqual({ tipo: "agenda", quando: "amanha" });
    expect(entender("minha agenda")).toEqual({ tipo: "agenda", quando: "hoje" });
    expect(entender("agenda da semana")).toEqual({ tipo: "agenda", quando: "semana" });
    expect(entender("qual o próximo compromisso?")).toEqual({ tipo: "agenda", quando: "proximo" });
    expect(entender("tenho reunião amanhã?")).toEqual({ tipo: "agenda", quando: "amanha" });
    expect(entender("o que tenho hoje?")).toEqual({ tipo: "pendencias" });
    expect(entender("e a semana?")).toEqual({ tipo: "vendas", periodo: "semana" });
  });
});
