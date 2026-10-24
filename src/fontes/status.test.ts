import { describe, expect, it } from "vitest";
import { medir, rotulo, verificarVM } from "./status";

describe("status da Vape Mania", () => {
  it("mede o tempo e marca fora do ar quando a chamada falha", async () => {
    let t = 0;
    const relogio = () => (t += 120);
    expect(await medir(async () => true, relogio)).toEqual({ ok: true, ms: 120 });
    expect(await medir(async () => { throw new Error("rede"); })).toEqual({ ok: false, ms: null });
  });

  it("site responde e banco devolve erro", async () => {
    const buscar = async (url: string) => new Response(null, { status: url.includes("supabase") ? 503 : 200 });
    const r = await verificarVM(buscar as typeof fetch);
    expect(r.site.ok).toBe(true);
    expect(r.banco.ok).toBe(false);
  });

  it("rótulos curtos", () => {
    expect(rotulo({ ok: true, ms: 240 }, "site")).toBe("No ar · 240 ms");
    expect(rotulo({ ok: false, ms: null }, "site")).toBe("Fora do ar");
    expect(rotulo({ ok: true, ms: 90 }, "banco")).toBe("Ok · 90 ms");
    expect(rotulo({ ok: null, ms: null }, "banco")).toBe("Verificando");
  });
});
