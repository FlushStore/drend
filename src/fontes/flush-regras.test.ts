import { describe, expect, it } from "vitest";
import { custoPadraoDe, fretePago, resumirPorDia, ultimosDias, type CaixaFlush, type VendaFlush } from "./flush-regras";

const venda = (o: Partial<VendaFlush>): VendaFlush => ({
  final_price: 100, created_at: "2026-10-24T15:00:00", order_id: "p1", product_name: "Ignite V80", cost_price: 40, quantity: 1, ...o,
});
const frete = (o: Partial<CaixaFlush>): CaixaFlush => ({
  type: "saida", amount: 12, description: "Frete pago da venda: p1", created_at: "2026-10-24T15:00:00", reference_type: "sale", reference_id: "p1", ...o,
});

describe("regras da Flush no DREND", () => {
  it("lucro = venda − custo gravado − frete pago", () => {
    const [d] = resumirPorDia([venda({})], [frete({})], [], ["2026-10-24"]);
    expect(d).toEqual({ dia: "2026-10-24", valor: 100, lucro: 48, pedidos: 1 });
  });

  it("sem custo gravado usa o custo padrão (exato, depois parcial na ordem)", () => {
    const padrao = custoPadraoDe([{ modelo: "ignite v80", custo: 35 }, { modelo: "ignite", custo: 20 }]);
    expect(padrao("Ignite V80")).toBe(35);
    expect(padrao("Ignite V150 Menta")).toBe(20);
    expect(padrao("Elfbar")).toBe(0);
    const [d] = resumirPorDia([venda({ cost_price: null, quantity: 2, final_price: 180 })], [], [{ modelo: "ignite v80", custo: 35 }], ["2026-10-24"]);
    expect(d.lucro).toBe(110);
  });

  it("brinde e venda neutralizada não entram, e o frete da neutralizada também sai", () => {
    const vendas = [venda({ payment_method: "brinde", order_id: "b" }), venda({ cash_neutralized: true }), venda({ order_id: "p2" })];
    const [d] = resumirPorDia(vendas, [frete({})], [], ["2026-10-24"]);
    expect(d).toMatchObject({ valor: 100, lucro: 60, pedidos: 1 });
  });

  it("só conta frete PAGO de venda", () => {
    expect(fretePago([frete({ type: "entrada", description: "Frete cobrado da venda: p1" }), frete({ reference_type: "manual" }), frete({ amount: 8 })], [])).toBe(8);
  });

  it("ultimosDias termina hoje", () => {
    expect(ultimosDias(3, new Date("2026-10-24T10:00:00"))).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
  });
});
