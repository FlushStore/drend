// O token dos agentes (DREND_AGENTE_TOKEN): quem grava pela /api/missao e pela /api/agenda.
// `variavel` troca o token conferido (ex.: DREND_VAULT_TOKEN, que só grava o vault).
import { timingSafeEqual } from "node:crypto";

export function autorizado(req, variavel = "DREND_AGENTE_TOKEN") {
  const esperado = process.env[variavel] || "";
  const veio = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (esperado.length < 32 || veio.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}
