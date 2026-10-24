/**
 * O mural de exemplo da Fase 4 (quadros "Marketing Flush · Natal", "Vitrine Flush" e
 * "Vida · ideias") ficou salvo no aparelho e no banco. Regra do DREND: só dado real. Na abertura,
 * os quadros que ainda são exatamente os de exemplo saem pelo próprio mural (entra no log e
 * dá para desfazer). Quadro que o Rapha mexeu (cartão novo, título trocado) fica.
 */
import type { Mural } from "./mural";

const EXEMPLO: Record<string, { titulo: string; cartoes: string[] }> = {
  natal: { titulo: "Marketing Flush · Natal", cartoes: ["c1", "c2", "c3", "c4", "c5", "c6"] },
  vitrine: { titulo: "Vitrine Flush", cartoes: [] },
  "vida-ideias": { titulo: "Vida · ideias", cartoes: [] },
};

export function tirarExemplos(mural: Mural): number {
  let tirados = 0;
  for (const [id, ex] of Object.entries(EXEMPLO)) {
    const quadro = mural.state.boards[id];
    if (!quadro || quadro.title !== ex.titulo) continue;
    const ids = mural.cardsOf(id).map((c) => c.id).sort();
    if (ids.join() !== [...ex.cartoes].sort().join()) continue;
    mural.run({ type: "deleteBoard", boardId: id }, "drend", `Tirou o quadro de exemplo "${ex.titulo}"`);
    tirados++;
  }
  return tirados;
}
