import { describe, expect, it } from "vitest";
import { estaParado, haQuanto, itemParado, ondeParou, projetos, type EventoMissao } from "./missao";

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

  it("projeto pausado vai para o fim e não ganha aviso de parado", () => {
    const lista = projetos([
      ev({ missao: "doce-fornada", tipo: "decisao", chave: "pausa", titulo: "Pausada", em: "2026-09-01T10:00:00Z" }),
      ev({ missao: "flush", tipo: "nota", titulo: "x", em: "2026-10-01T10:00:00Z" }),
    ], agora);
    const doce = lista.at(-1)!;
    expect(doce).toMatchObject({ missao: "doce-fornada", nome: "Doce Fornada", pausado: true });
    expect(estaParado(doce)).toBe(false);
    expect(estaParado(lista.find((p) => p.missao === "flush")!)).toBe(true);
    const voltou = projetos([
      ev({ missao: "flush", tipo: "decisao", chave: "pausa", titulo: "Pausa" }),
      ev({ missao: "flush", tipo: "decisao", chave: "retomada", titulo: "Voltou", em: "2026-10-24T11:00:00Z" }),
    ], agora).find((p) => p.missao === "flush")!;
    expect(voltou.pausado).toBe(false);
  });

  it("onde parou: o projeto vivo mexido por último e o item mais novo dele", () => {
    const lista = projetos([
      ev({ chave: "a", fase: "agora", titulo: "Antigo", em: "2026-10-24T08:00:00Z" }),
      ev({ chave: "b", fase: "agora", titulo: "Novo", em: "2026-10-24T09:00:00Z" }),
      ev({ missao: "flush", tipo: "nota", titulo: "Mexi na Flush", em: "2026-10-24T11:00:00Z" }),
      ev({ missao: "black-store", tipo: "decisao", chave: "pausa", titulo: "Pausa", em: "2026-10-24T11:30:00Z" }),
    ], agora);
    expect(ondeParou(lista)).toMatchObject({ projeto: { missao: "flush" }, item: null });
    expect(ondeParou(lista.filter((p) => p.missao === "drend"))?.item?.titulo).toBe("Novo");
    expect(ondeParou([])).toBeNull();
  });

  it("item em andamento sem passo há 5 dias fica marcado", () => {
    const [drend] = projetos([ev({ chave: "velho", fase: "agora", titulo: "x", em: "2026-10-18T10:00:00Z" })], agora);
    expect(itemParado(drend.itens.agora[0], agora)).toBe(true);
    expect(itemParado({ ...drend.itens.agora[0], em: "2026-10-23T10:00:00Z" }, agora)).toBe(false);
  });

  it("nota de cadastro não conta como passo", () => {
    const flush = projetos([
      ev({ missao: "flush", tipo: "nota", titulo: "Notas copiadas", em: "2026-10-12T00:43:00Z" }),
      ev({ missao: "flush", tipo: "nota", titulo: "Missão da Flush criada" }),
    ], agora).find((p) => p.missao === "flush")!;
    expect(flush.ultimo?.titulo).toBe("Notas copiadas");
    expect(estaParado(flush)).toBe(true);
  });

  it("passo antigo registrado depois decide a fase, mas não o 'mexido há'", () => {
    const [drend] = projetos([
      ev({ id: 900, chave: "flush-real", fase: "agora", titulo: "Flush real", em: "2026-10-24T11:00:00Z" }),
      ev({ id: 901, chave: "outro", fase: "agora", titulo: "Outro", em: "2026-10-24T11:30:00Z" }),
      ev({ id: 902, chave: "flush-real", fase: "feito", titulo: "", em: "2026-10-24T10:59:00Z" }),
    ], agora);
    expect(drend.itens.feito.map((i) => i.chave)).toEqual(["flush-real"]);
    expect(drend.ultimo?.chave).toBe("outro");
  });
});
