import { describe, expect, it } from "vitest";
import { entender } from "./comandos";
import { acharPorTexto, normalizar, semelhanca } from "./fala";

describe("normalizar", () => {
  it("tira acento, pontuação e expande gíria", () => {
    expect(normalizar("Qnt vc vendeu hj??")).toBe("quanto voce vendeu hoje");
    expect(normalizar("oq tá faltando pra amanhã")).toBe("o que esta faltando para amanha");
  });
});

/** Frases do jeito que o Rapha escreve (rápido, sem acento, às vezes por voz). */
describe("entende o Rapha", () => {
  const casos: Array<[string, unknown]> = [
    ["me lembra de pagar o fornecedor de pods", { tipo: "tarefa", texto: "pagar o fornecedor de pods" }],
    ["tenho q ligar pro contador", { tipo: "tarefa", texto: "ligar pro contador" }],
    ["n deixa eu esquecer de postar os stories da flush", { tipo: "tarefa", texto: "postar os stories da flush" }],
    ["não esquecer de renovar o domínio", { tipo: "tarefa", texto: "renovar o domínio" }],
    ["anota tarefa: conferir estoque de ignite", { tipo: "tarefa", texto: "conferir estoque de ignite" }],
    ["feito pagar fornecedor", { tipo: "concluir", texto: "pagar fornecedor" }],
    ["já paguei o fornecedor", { tipo: "concluir", texto: "paguei o fornecedor" }],
    ["marca ligar pro contador como feita", { tipo: "concluir", texto: "ligar pro contador" }],
    ["reabre ligar pro contador", { tipo: "reabrir", texto: "ligar pro contador" }],
    ["apaga a tarefa renovar o domínio", { tipo: "apagarTarefa", texto: "renovar o domínio" }],
    ["tira stories da lista", { tipo: "apagarTarefa", texto: "stories" }],
    ["guarda isso: cupom pra quem indicar amigo", { tipo: "ideia", texto: "cupom pra quem indicar amigo" }],
    ["o q tenho pra hj?", { tipo: "pendencias" }],
    ["oq falta", { tipo: "pendencias" }],
    ["minhas tarefas", { tipo: "pendencias" }],
    ["qnt vendi hj", { tipo: "vendas", loja: "flush", periodo: "hoje" }],
    ["como ta a flush?", { tipo: "vendas", loja: "flush", periodo: "hoje" }],
    ["e a semana?", { tipo: "vendas", loja: "flush", periodo: "semana" }],
    ["como foi a semana da flush", { tipo: "vendas", loja: "flush", periodo: "semana" }],
    ["lucro de ontem", { tipo: "vendas", loja: "flush", periodo: "ontem" }],
    ["como tá a vape mania", { tipo: "vendas", loja: "vape-mania", periodo: "hoje" }],
    ["me atualiza", { tipo: "resumo" }],
    ["bom dia drend", { tipo: "saudacao" }],
    ["eai", { tipo: "saudacao" }],
    ["salve", { tipo: "saudacao" }],
    ["vlw", { tipo: "agradecimento" }],
    ["tmj", { tipo: "agradecimento" }],
    ["o que vc faz?", { tipo: "ajuda" }],
    ["ajuda", { tipo: "ajuda" }],
    ["desfaz", { tipo: "desfazer" }],
  ];
  it.each(casos)("%s", (frase, esperado) => {
    expect(entender(frase)).toEqual(esperado);
  });

  it("pedido de quadro continua valendo mesmo com palavra de venda no título", () => {
    expect(entender("crie um quadro Vendas de natal com cartões cupom e kit")).toMatchObject({ tipo: "criarQuadro", titulo: "Vendas de natal" });
  });
});

describe("achar tarefa pelo texto", () => {
  const tarefas = [
    { id: "1", texto: "Pagar o fornecedor de pods" },
    { id: "2", texto: "Ligar pro contador" },
    { id: "3", texto: "Postar stories da Flush" },
    { id: "4", texto: "Postar stories da Vape Mania" },
  ];
  const achar = (q: string) => acharPorTexto(tarefas, q, (t) => t.texto);

  it("acha com outras palavras e outro tempo verbal", () => {
    expect(semelhanca("paguei o fornecedor", "Pagar o fornecedor de pods")).toBe(1);
    expect(achar("paguei o fornecedor")).toEqual({ achado: tarefas[0] });
    expect(achar("liguei pro contador")).toEqual({ achado: tarefas[1] });
  });

  it("pergunta quando duas servem, e não chuta", () => {
    expect(achar("postar stories")).toEqual({ empate: [tarefas[2], tarefas[3]] });
    expect(achar("stories da flush")).toEqual({ achado: tarefas[2] });
  });

  it("não acha o que não existe", () => {
    expect(achar("comprar pão")).toBeNull();
  });
});
