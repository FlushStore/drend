// PRs do repositório do DREND entram sozinhos nas Missões. O GitHub Actions manda um token
// OIDC (JWT assinado pelo GitHub, sem segredo guardado em lugar nenhum); aqui ele é conferido
// contra as chaves públicas do GitHub e só vale para o repositório FlushStore/drend.
import { createPublicKey, verify } from "node:crypto";

export const EMISSOR = "https://token.actions.githubusercontent.com";
export const PUBLICO = "drend.vercel.app";
export const REPO = "flushstore/drend";

let chaves = null;
async function chavesDoGitHub(buscar, renovar = false) {
  if (!renovar && chaves && chaves.ate > Date.now()) return chaves.jwks;
  const r = await buscar(`${EMISSOR}/.well-known/jwks`);
  if (!r.ok) throw new Error("jwks indisponível");
  chaves = { jwks: await r.json(), ate: Date.now() + 60 * 60 * 1000 };
  return chaves.jwks;
}

const b64url = (t) => Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Confere o JWT e devolve as afirmações, ou null. `buscar` e `agora` existem para os testes. */
export async function conferirOidc(jwt, { buscar = fetch, jwks = null, agora = Date.now() } = {}) {
  const partes = String(jwt || "").split(".");
  if (partes.length !== 3) return null;
  let cab, corpo;
  try {
    cab = JSON.parse(b64url(partes[0]).toString("utf8"));
    corpo = JSON.parse(b64url(partes[1]).toString("utf8"));
  } catch {
    return null;
  }
  if (cab.alg !== "RS256" || !cab.kid) return null;
  let jwk = (jwks ?? (await chavesDoGitHub(buscar))).keys?.find((k) => k.kid === cab.kid);
  // O GitHub trocou de chave dentro da hora do cache: busca de novo antes de recusar.
  if (!jwk && !jwks) jwk = (await chavesDoGitHub(buscar, true)).keys?.find((k) => k.kid === cab.kid);
  if (!jwk) return null;
  const ok = verify("RSA-SHA256", Buffer.from(`${partes[0]}.${partes[1]}`), createPublicKey({ key: jwk, format: "jwk" }), b64url(partes[2]));
  if (!ok) return null;
  const s = agora / 1000;
  if (corpo.iss !== EMISSOR || corpo.aud !== PUBLICO) return null;
  if (typeof corpo.exp !== "number" || corpo.exp < s || (typeof corpo.nbf === "number" && corpo.nbf > s + 60)) return null;
  if (String(corpo.repository || "").toLowerCase() !== REPO) return null;
  return corpo;
}

/** O que o GitHub pode gravar: só o item do próprio PR, na missão do DREND. */
export function eventoDePr(e) {
  return e.missao === "drend" && e.agente === "drend" && e.tipo === "item" && /^pr-\d{1,6}$/.test(e.chave ?? "") && /^https:\/\/github\.com\/flushstore\/drend\/pull\/\d+$/i.test(e.ref ?? "");
}
