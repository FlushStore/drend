import { describe, expect, it } from "vitest";
import { haQuanto, projetos, type EventoMissao } from "./missao";

let id = 0;
const ev = (e: Partial<EventoMissao>): EventoMissao => ({ id: ++id, em: "2026-10-24T10:00:00Z", missao: "drend", agente: "claude", tipo: "item", chave: null, titulo: "", texto: null, fase: null, ref: null, ...e });
const agora = new Date("2026-10-24T12:00:00Z");

describe("missões", () => {
  it("o último evento do item decide a fase e herda o resto", () => {
    const [drend] = projetos([
      ev({ chave: "cerebro", fase: "agora", titulo: "Cérebro animado", texto: "rede 3D" }),
      ev({ chave: "cerebro", fase: "feito", titulo: "", em: "2026-10-24T11:00:00Z" }),
    ], agora);
    expect(drend.itens.agora).toEqual([]);
    expect(drend.itens.feito[0]).toMatchObject({ titulo: "Cérebro animado", texto: "rede 3D", fase: "feito" });
  });

  it("todos os projetos aparecem, na ordem, com aviso de parado", () => {
    const lista = projetos([ev({ missao: "flush", tipo: "nota", titulo: "x", em: "2026-10-14T10:00:00Z" }), ev({ missao: "nova-loja", tipo: "nota", titulo: "y" })], agora);
    expect(lista.map((p) => p.missao)).toEqual(["drend", "flush", "vape-mania", "flushfinance", "nova-loja"]);
    expect(lista[1].parado).toBe(10);
    expect(lista[0].ultimo).toBeNull();
    expect(lista[4].nome).toBe("Nova loja");
  });

  it("há quanto tempo", () => {
    expect(haQuanto("2026-10-24T11:58:00Z", agora)).toBe("há 2 min");
    expect(haQuanto("2026-10-24T09:00:00Z", agora)).toBe("há 3 h");
    expect(haQuanto("2026-10-23T09:00:00Z", agora)).toBe("ontem");
  });
});
