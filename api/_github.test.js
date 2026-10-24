import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { EMISSOR, PUBLICO, conferirOidc, eventoDePr } from "./_github.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwks = { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" }] };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const agora = Date.parse("2026-10-24T15:00:00Z");
function jwt(corpo, kid = "k1") {
  const base = `${b64({ alg: "RS256", kid })}.${b64(corpo)}`;
  return `${base}.${sign("RSA-SHA256", Buffer.from(base), privateKey).toString("base64url")}`;
}
const bom = { iss: EMISSOR, aud: PUBLICO, repository: "FlushStore/drend", exp: agora / 1000 + 300 };

describe("api/_github: token OIDC do Actions", () => {
  it("aceita o token do repositório do DREND", async () => {
    expect(await conferirOidc(jwt(bom), { jwks, agora })).toMatchObject({ repository: "FlushStore/drend" });
  });
  it("recusa outro repositório, outro público, vencido ou assinatura trocada", async () => {
    expect(await conferirOidc(jwt({ ...bom, repository: "outro/repo" }), { jwks, agora })).toBeNull();
    expect(await conferirOidc(jwt({ ...bom, aud: "x" }), { jwks, agora })).toBeNull();
    expect(await conferirOidc(jwt({ ...bom, exp: agora / 1000 - 1 }), { jwks, agora })).toBeNull();
    const [c, , a] = jwt(bom).split(".");
    expect(await conferirOidc(`${c}.${b64({ ...bom, repository: "FlushStore/drend", aud: PUBLICO, sub: "x" })}.${a}`, { jwks, agora })).toBeNull();
    expect(await conferirOidc("lixo", { jwks, agora })).toBeNull();
  });
  it("o GitHub só grava o item do próprio PR", () => {
    const pr = { missao: "drend", agente: "drend", tipo: "item", chave: "pr-12", ref: "https://github.com/FlushStore/drend/pull/12" };
    expect(eventoDePr(pr)).toBe(true);
    expect(eventoDePr({ ...pr, missao: "flush" })).toBe(false);
    expect(eventoDePr({ ...pr, chave: "cerebro" })).toBe(false);
    expect(eventoDePr({ ...pr, tipo: "nota" })).toBe(false);
  });
});
