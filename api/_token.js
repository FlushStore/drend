// O token dos agentes (DREND_AGENTE_TOKEN): quem grava pela /api/missao e pela /api/agenda.
import { timingSafeEqual } from "node:crypto";

export function autorizado(req) {
  const esperado = process.env.DREND_AGENTE_TOKEN || "";
  const veio = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (esperado.length < 32 || veio.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}
