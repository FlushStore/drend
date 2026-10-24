import { describe, expect, it } from "vitest";
import { responderPendencias, responderResumo, responderVendas, type LeituraFlush } from "./respostas";
import type { Tarefa } from "./tarefas";

// Sexta, 23/10/2026, 15h no horário local.
const agora = new Date(2026, 9, 23, 15, 0);
const dias = [
  { dia: "2026-10-17", valor: 0, lucro: 0, pedidos: 0 },
  { dia: "2026-10-18", valor: 210, lucro: 60, pedidos: 2 },
  { dia: "2026-10-19", valor: 95, lucro: 30, pedidos: 1 },
  { dia: "2026-10-20", valor: 330, lucro: 100, pedidos: 3 },
  { dia: "2026-10-21", valor: 0, lucro: 0, pedidos: 0 },
  { dia: "2026-10-22", valor: 120, lucro: -10, pedidos: 1 },
  { dia: "2026-10-23", valor: 432.5, lucro: 120, pedidos: 4 },
];
const ok: LeituraFlush = { fase: "ok", dias, atualizadoEm: agora.toISOString() };
/** O Intl separa "R$" do número com espaço fixo; nos testes vale o espaço comum. */
const sp = (s: string) => s.replace(/\u00a0/g, " ");
const t = (texto: string, feita = false): Tarefa => ({ id: texto, texto, criadaEm: "2026-10-20T10:00:00.000Z", feitaEm: feita ? "2026-10-21T10:00:00.000Z" : undefined });

describe("responderVendas", () => {
  it("hoje, ontem e semana com os números lidos", () => {
    expect(sp(responderVendas("hoje", ok, agora))).toBe("Hoje a Flush vendeu R$ 432,50 em 4 pedidos, com R$ 120 de lucro.");
    expect(sp(responderVendas("ontem", ok, agora))).toBe("Ontem a Flush vendeu R$ 120 em 1 pedido, com R$ 10 de prejuízo.");
    expect(sp(responderVendas("semana", ok, agora))).toBe("Nos últimos 7 dias: R$ 1.187,50 em 11 pedidos, R$ 300 de lucro. Melhor dia: sexta, com R$ 432,50.");
  });

  it("não mostra exemplo como se fosse real", () => {
    expect(sp(responderVendas("hoje", null, agora))).toMatch(/^A Flush ainda não está ligada/);
    expect(sp(responderVendas("hoje", { fase: "carregando" }, agora))).toMatch(/Estou lendo/);
  });

  it("diz de quando é a leitura quando ela não é de hoje", () => {
    const sabado = new Date(2026, 9, 24, 9, 0);
    expect(sp(responderVendas("hoje", { ...ok, fase: "erro" } as LeituraFlush, sabado))).toBe(
      "Não tenho a leitura de hoje. Na última, de sexta: R$ 432,50 em 4 pedidos, R$ 120 de lucro.",
    );
  });
});

describe("pendências e resumo", () => {
  it("lista as abertas e as ideias soltas", () => {
    expect(sp(responderPendencias([t("Pagar fornecedor"), t("Ligar pro contador", true)], 2))).toBe("Uma tarefa aberta:\n• Pagar fornecedor\nE 2 ideias esperam um projeto.");
    expect(sp(responderPendencias([], 0))).toBe("Nenhuma tarefa aberta.");
  });

  it("saudação conta o dia", () => {
    expect(sp(responderResumo([t("A"), t("B")], ok, agora))).toBe("Boa tarde, Rapha. Você tem 2 tarefas abertas. A Flush vendeu R$ 432,50 hoje, em 4 pedidos.");
    expect(sp(responderResumo([], null, new Date(2026, 9, 23, 8)))).toBe("Bom dia, Rapha. Nenhuma tarefa aberta.");
  });
});
