import { describe, expect, it } from "vitest";
import { calcularGiro, ehCobertura, linkDoWhatsApp, montarReposicao, sugestaoDe, textoDoPedido, type GiroFlush } from "./flush-reposicao";
import type { SaborEstoqueFlush, VinculoFlush } from "./flush-produtos";
import type { VendaFlush } from "./flush-regras";

const venda = (o: Partial<VendaFlush>): VendaFlush => ({
  final_price: 100, created_at: "2026-10-24T15:00:00", order_id: "p1", product_name: "Ignite V80", cost_price: 40, quantity: 1,
  payment_method: "pix", product_id: "a", flavor_id: "menta", flavor_name: "Menta", ...o,
});
const vinculo = (o: Partial<VinculoFlush>): VinculoFlush => ({
  product_id: "a", active: true, price: null, products: { name: "Ignite V80", active: true, price: 90 }, ...o,
});
const sabor = (o: Partial<SaborEstoqueFlush>): SaborEstoqueFlush => ({
  id: "s1", product_id: "a", flavor_id: "menta", qty: 1, is_external: false, flavors: { name: "Menta", emoji: "" }, ...o,
});

/** 30 dias terminando em 24/10/2026. */
const DIAS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 9, 24 - 29 + i, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const em = (diasAtras: number) => `${DIAS[29 - diasAtras]}T15:00:00`;

describe("giro por sabor", () => {
  const estoque = {
    sabores: [sabor({}), sabor({ id: "s2", flavor_id: "uva", qty: 0, flavors: { name: "Uva" } })],
    vinculos: [vinculo({})],
  };

  it("soma as unidades por janela de 7, 14 e 30 dias (hoje conta)", () => {
    const g = calcularGiro([
      venda({ created_at: em(0), quantity: 2 }),
      venda({ created_at: em(6) }),
      venda({ created_at: em(7) }),
      venda({ created_at: em(13), quantity: 3 }),
      venda({ created_at: em(14) }),
      venda({ created_at: em(29) }),
      venda({ created_at: "2026-09-01T15:00:00" }),
    ], estoque, DIAS);
    expect(g.diasLidos).toBe(30);
    expect(g.itens.find((i) => i.id === "s1")?.vendidos).toEqual({ 7: 3, 14: 7, 30: 9 });
  });

  it("casa pelo par produto + sabor; sem flavor_id, pelo nome; sem sabor, não entra", () => {
    const g = calcularGiro([
      venda({ flavor_id: "uva", flavor_name: "Uva" }),
      venda({ flavor_id: null, flavor_name: " uva ", product_name: "ignite v80" }),
      venda({ flavor_id: "uva", product_id: "outro" }),
      venda({ flavor_id: null, flavor_name: null }),
    ], estoque, DIAS);
    expect(g.itens.find((i) => i.id === "s2")?.vendidos[7]).toBe(2);
    expect(g.itens.find((i) => i.id === "s1")?.vendidos[7]).toBe(0);
  });

  it("só venda válida: brinde e neutralizada ficam fora", () => {
    const g = calcularGiro([venda({ payment_method: "brinde" }), venda({ cash_neutralized: true }), venda({})], estoque, DIAS);
    expect(g.itens.find((i) => i.id === "s1")?.vendidos[7]).toBe(1);
  });

  it("só os sabores acabando de produto que vende", () => {
    const g = calcularGiro([], { sabores: [sabor({ qty: 5 }), sabor({ id: "s3", product_id: "b" })], vinculos: [vinculo({})] }, DIAS);
    expect(g.itens).toEqual([]);
  });
});

describe("sugestão", () => {
  it("cobertura − estoque, para cima, mínimo 0", () => {
    expect(sugestaoDe(6, 1, 14, 14)).toBe(5);
    expect(sugestaoDe(3, 0, 14, 14)).toBe(3);
    expect(sugestaoDe(2, 2, 7, 7)).toBe(0);
    expect(sugestaoDe(1, 2, 7, 7)).toBe(0);
    expect(sugestaoDe(0, 0, 30, 30)).toBe(0);
  });

  it("leitura mais curta que a cobertura: média dos dias lidos vezes a cobertura", () => {
    // 10 em 20 dias → 15 em 30, menos 1 em estoque.
    expect(sugestaoDe(10, 1, 30, 20)).toBe(14);
    // 7 em 29 dias → 7,24 em 30 → 8.
    expect(sugestaoDe(7, 0, 30, 29)).toBe(8);
  });
});

describe("lista e pedido", () => {
  const giro: GiroFlush = {
    diasLidos: 30,
    itens: [
      { id: "1", produto: "Ignite V80", sabor: "Menta", emoji: "", estoque: 1, vendidos: { 7: 2, 14: 6, 30: 10 } },
      { id: "2", produto: "Ignite V80", sabor: "Uva", emoji: "", estoque: 0, vendidos: { 7: 3, 14: 8, 30: 12 } },
      { id: "3", produto: "Elfbar", sabor: "Melancia", emoji: "", estoque: 2, vendidos: { 7: 0, 14: 3, 30: 4 } },
      { id: "4", produto: "Elfbar", sabor: "Kiwi", emoji: "", estoque: 0, vendidos: { 7: 0, 14: 0, 30: 0 } },
    ],
  };

  it("agrupa por produto (A→Z), sabores do maior pedido, e conta os sem giro", () => {
    const r = montarReposicao(giro, 14);
    expect(r.janela).toBe(14);
    expect(r.grupos.map((g) => [g.produto, g.sabores.map((s) => [s.sabor, s.sugestao])])).toEqual([
      ["Elfbar", [["Melancia", 1]]],
      ["Ignite V80", [["Uva", 8], ["Menta", 5]]],
    ]);
    expect(r.total).toBe(14);
    expect(r.semGiro).toBe(1);
  });

  it("nada a repor quando nada vendeu", () => {
    const r = montarReposicao(giro, 7);
    expect(r.grupos.map((g) => g.produto)).toEqual(["Ignite V80"]);
    expect(montarReposicao({ diasLidos: 30, itens: [giro.itens[3]] }, 30).grupos).toEqual([]);
  });

  it("janela limitada aos dias lidos", () => {
    expect(montarReposicao({ ...giro, diasLidos: 29 }, 30).janela).toBe(29);
  });

  it("texto do pedido e link do WhatsApp sem número", () => {
    const texto = textoDoPedido(montarReposicao(giro, 14));
    expect(texto).toBe([
      "Pedido de reposição (cobre 14 dias de venda)",
      "",
      "*Elfbar*",
      "- Melancia: 1",
      "",
      "*Ignite V80*",
      "- Uva: 8",
      "- Menta: 5",
      "",
      "Total: 14 unidades",
    ].join("\n"));
    expect(linkDoWhatsApp("a b\n*c*")).toBe("https://wa.me/?text=a%20b%0A*c*");
  });

  it("cobertura válida", () => {
    expect(ehCobertura("14")).toBe(true);
    expect(ehCobertura(15)).toBe(false);
    expect(ehCobertura(null)).toBe(false);
  });
});
