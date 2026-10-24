import { describe, expect, it } from "vitest";
import { maisVendidos, resumirProdutos, rotuloDaForma, saboresAcabando, vendasPorForma, type SaborEstoqueFlush, type VinculoFlush } from "./flush-produtos";
import type { VendaFlush } from "./flush-regras";

const venda = (o: Partial<VendaFlush>): VendaFlush => ({
  final_price: 100, created_at: "2026-10-24T15:00:00", order_id: "p1", product_name: "Ignite V80", cost_price: 40, quantity: 1, payment_method: "pix", ...o,
});
const vinculo = (o: Partial<VinculoFlush>): VinculoFlush => ({
  product_id: "a", active: true, price: null, products: { name: "Ignite V80", active: true, price: 90 }, ...o,
});
const sabor = (o: Partial<SaborEstoqueFlush>): SaborEstoqueFlush => ({
  id: "s1", product_id: "a", qty: 1, is_external: false, flavors: { name: "Menta", emoji: "🌿" }, ...o,
});
const SEMANA = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];

describe("mais vendidos da semana", () => {
  it("agrupa pelo nome (sem caixa/espaço), soma unidades e faturamento, ordena por unidades", () => {
    const r = maisVendidos([
      venda({ quantity: 2, final_price: 180 }),
      venda({ product_name: " ignite v80 ", quantity: 1, final_price: 90.5 }),
      venda({ product_name: "Elfbar", quantity: 4, final_price: 200 }),
      venda({ product_name: "Oxbar", quantity: 1, final_price: 70 }),
    ], SEMANA);
    expect(r).toEqual([
      { nome: "Elfbar", unidades: 4, faturamento: 200 },
      { nome: "Ignite V80", unidades: 3, faturamento: 270.5 },
      { nome: "Oxbar", unidades: 1, faturamento: 70 },
    ]);
  });

  it("fica com 5, desempata por faturamento e nome", () => {
    const vendas = ["F", "E", "D", "C", "B", "A"].map((n, i) => venda({ product_name: n, final_price: n === "F" ? 200 : 100 + i }));
    expect(maisVendidos(vendas, SEMANA).map((p) => p.nome)).toEqual(["F", "A", "B", "C", "D"]);
  });

  it("usa as regras de venda válida: fora da semana, brinde, neutralizada e 21-22/04 não contam", () => {
    const r = maisVendidos([
      venda({ created_at: "2026-10-17T15:00:00" }),
      venda({ payment_method: "brinde" }),
      venda({ cash_neutralized: true }),
      venda({ created_at: "2026-04-21T15:00:00" }),
    ], [...SEMANA, "2026-04-21"]);
    expect(r).toEqual([]);
  });
});

describe("sabores acabando", () => {
  it("até 2 unidades, só de produto que vende (vínculo e produto ativos, com preço), do menor para o maior", () => {
    const r = saboresAcabando([
      sabor({ id: "s1", qty: 2 }),
      sabor({ id: "s2", qty: 0, flavors: { name: "Uva", emoji: null } }),
      sabor({ id: "s3", qty: 3 }),
      sabor({ id: "s4", qty: 1, is_external: true }),
      sabor({ id: "s5", qty: 0, product_id: "inativo" }),
      sabor({ id: "s6", qty: 0, product_id: "sem-preco" }),
      sabor({ id: "s7", qty: -1, product_id: "b", flavors: [{ name: "Gelo", emoji: "" }] }),
    ], [
      vinculo({}),
      vinculo({ product_id: "b", price: 50, products: [{ name: "Elfbar", active: true, price: null }] }),
      vinculo({ product_id: "inativo", active: false }),
      vinculo({ product_id: "sem-preco", products: { name: "X", active: true, price: 0 } }),
    ]);
    expect(r.map((s) => [s.id, s.produto, s.sabor, s.quantidade])).toEqual([
      ["s7", "Elfbar", "Gelo", 0],
      ["s2", "Ignite V80", "Uva", 0],
      ["s1", "Ignite V80", "Menta", 2],
    ]);
  });
});

describe("vendas por forma de pagamento no mês", () => {
  it("soma o mês corrente por forma, com a parte de cada uma, sem brinde nem neutralizada", () => {
    const r = vendasPorForma([
      venda({ final_price: 300 }),
      venda({ payment_method: "dinheiro", final_price: 100 }),
      venda({ payment_method: "cartao_debito", final_price: 50, created_at: "2026-10-01T09:00:00" }),
      venda({ payment_method: "fiado", final_price: 50 }),
      venda({ payment_method: "brinde", final_price: 0 }),
      venda({ payment_method: "pix", final_price: 999, cash_neutralized: true }),
      venda({ payment_method: "pix", final_price: 999, created_at: "2026-09-30T15:00:00" }),
    ], "2026-10");
    expect(r).toEqual([
      { forma: "pix", rotulo: "Pix", valor: 300, parte: 0.6 },
      { forma: "dinheiro", rotulo: "Dinheiro", valor: 100, parte: 0.2 },
      { forma: "cartao_debito", rotulo: "Cartão", valor: 50, parte: 0.1 },
      { forma: "fiado", rotulo: "Fiado", valor: 50, parte: 0.1 },
    ]);
  });

  it("forma vazia vira 'Sem forma' e desconhecida ganha rótulo legível", () => {
    expect(vendasPorForma([venda({ payment_method: null })], "2026-10")[0]).toMatchObject({ forma: "sem forma", rotulo: "Sem forma", parte: 1 });
    expect(rotuloDaForma("link_pagamento")).toBe("Link pagamento");
  });
});

describe("resumirProdutos", () => {
  it("junta os três; sem estoque lido, acabando fica null", () => {
    const r = resumirProdutos([venda({})], null, SEMANA, new Date("2026-10-24T15:00:00"));
    expect(r.mes).toBe("2026-10");
    expect(r.maisVendidos).toHaveLength(1);
    expect(r.acabando).toBeNull();
    expect(r.formas).toHaveLength(1);
  });
});
