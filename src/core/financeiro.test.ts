import { describe, expect, it } from "vitest";
import { inicioDoMesAnterior, lerValor, progressoMeta, resumirMes } from "./financeiro";
import { diasDesde } from "../fontes/flush-regras";

// Sábado, 24/10/2026, 15h local.
const agora = new Date(2026, 9, 24, 15, 0);
/** Setembro inteiro a R$ 100/dia (1 pedido, R$ 30 de lucro) e outubro a R$ 150/dia. */
const historico = diasDesde("2026-09-01", agora).map((dia) =>
  dia.startsWith("2026-09") ? { dia, valor: 100, lucro: 30, pedidos: 1 } : { dia, valor: 150, lucro: 60, pedidos: 2 });

describe("resumirMes", () => {
  it("soma o mês até hoje e compara com o mês passado no mesmo ponto", () => {
    const m = resumirMes(historico, agora)!;
    expect(m.nome).toBe("outubro");
    expect(m.atual).toEqual({ valor: 3600, lucro: 1440, pedidos: 48 });
    expect(m.anterior.nome).toBe("setembro");
    expect(m.anterior.ateHoje.valor).toBe(2400);
    expect(m.anterior.total.valor).toBe(3000);
    expect(m.variacao).toBeCloseTo(0.5);
    expect(m.margem).toBeCloseTo(0.4);
    expect(m.ticket).toBe(75);
    expect(m.projecao).toBe(4650);
    expect([m.diasPassados, m.diasNoMes]).toEqual([24, 31]);
  });

  it("sem mês passado no histórico, não inventa comparação", () => {
    const m = resumirMes(historico.filter((d) => d.dia.startsWith("2026-10")), agora)!;
    expect(m.variacao).toBeNull();
  });

  it("dia 31 compara com o último dia de um mês mais curto", () => {
    const fim = new Date(2026, 9, 31, 12);
    const m = resumirMes(diasDesde("2026-09-01", fim).map((dia) => ({ dia, valor: 10, lucro: 1, pedidos: 1 })), fim)!;
    expect(m.anterior.ateHoje.valor).toBe(300);
  });

  it("sem dia do mês no histórico, devolve null", () => {
    expect(resumirMes(historico.filter((d) => d.dia.startsWith("2026-09")), agora)).toBeNull();
  });

  it("a leitura começa no dia 1 do mês passado, virando o ano", () => {
    expect(inicioDoMesAnterior(agora)).toBe("2026-09-01");
    expect(inicioDoMesAnterior(new Date(2027, 0, 5))).toBe("2026-12-01");
  });
});

describe("progressoMeta", () => {
  it("quanto falta e quanto por dia, hoje incluso", () => {
    const m = resumirMes(historico, agora)!;
    expect(progressoMeta(m, 6000)).toEqual({ meta: 6000, feito: 0.6, falta: 2400, porDia: 300, noRitmo: false });
    expect(progressoMeta(m, 3000)).toMatchObject({ falta: 0, porDia: null, noRitmo: true });
  });
});

describe("lerValor", () => {
  it("lê do jeito que se fala", () => {
    expect(lerValor("10 mil")).toBe(10000);
    expect(lerValor("10k")).toBe(10000);
    expect(lerValor("1,5 mil")).toBe(1500);
    expect(lerValor("R$ 12.500")).toBe(12500);
    expect(lerValor("8500,50")).toBe(8500.5);
    expect(lerValor("8000 reais")).toBe(8000);
    expect(lerValor("muito")).toBeNull();
    expect(lerValor("0")).toBeNull();
  });
});

describe("leitura antiga", () => {
  it("o mês vale até o último dia lido, não até hoje", () => {
    const dia20 = new Date(2026, 9, 20, 15, 0);
    const ate10 = historico.filter((d) => d.dia <= "2026-10-10");
    const m = resumirMes(ate10, dia20)!;
    expect(m.diasPassados).toBe(10);
    expect(m.anterior.ateHoje.valor).toBe(1000);
    expect(m.variacao).toBeCloseTo(0.5);
    expect(m.projecao).toBe(4650);
  });
});
