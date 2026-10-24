/**
 * Comandos que o DREND entende sem IA (Fase 4). Cada comando vira operações do Mural,
 * então tudo entra no log e pode ser desfeito. A Fase 6 troca o leitor por um modelo
 * de linguagem, mas a saída continua a mesma: um `Op`.
 */
import type { Board, Card, MuralState, Op } from "./mural";

export type Comando =
  | { tipo: "criarQuadro"; titulo: string; cartoes: string[]; projeto: string }
  | { tipo: "desfazer" }
  | { tipo: "ideia"; texto: string }
  | { tipo: "tarefa"; texto: string };

const PROJETOS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:da |na |para a |pra )?flush(?:store)?\b/i, "flushstore"],
  [/\b(?:da |na |para a |pra )?vape ?mania\b/i, "vape-mania"],
  [/\b(?:do |no |para o |pro )?drend\b/i, "drend"],
];

/** "A, B e C" → ["A", "B", "C"]. Aceita ; e quebra de linha também. */
export function separarItens(texto: string): string[] {
  return texto
    .split(/\s*(?:[,;\n]|\s+e\s+)\s*/i)
    .map((t) => t.trim().replace(/^["“”']+|["“”'.]+$/g, "").trim())
    .filter(Boolean);
}

export function entender(entrada: string): Comando | null {
  const t = entrada.trim().replace(/\s+/g, " ");
  if (/^(?:desfa(?:z|zer|ça|ca)|volta(?:r)?)(?: (?:a |o )?(?:última|ultima|último|ultimo)(?: coisa| ação| acao)?)?[.!]?$/i.test(t)) {
    return { tipo: "desfazer" };
  }
  const ideia = t.match(/^tive uma ideia[:,]?\s*(.*)$/i);
  if (ideia) return { tipo: "ideia", texto: ideia[1] || t };
  // "me lembra de pagar o fornecedor" · "lembrar de X" · "tarefa: X" · "preciso X"
  const tarefa = t.match(/^(?:(?:me\s+)?lembr(?:a|ar|e)(?:-me)?\s+(?:de\s+|que\s+)?|tarefa\s*:\s*|anota(?:r)?\s+(?:a\s+)?tarefa\s*:?\s*|preciso\s+(?:de\s+)?)(.+)$/i);
  if (tarefa && tarefa[1].trim()) return { tipo: "tarefa", texto: tarefa[1].trim() };

  // "crie um quadro Natal com cartões A, B e C" · "quadro Natal: A, B, C"
  const q =
    t.match(/^(?:(?:cri[ea]r?|fa[çc]a|monta?r?|abr[ea]|novo)\s+)?(?:um\s+)?quadro\s+(?:chamado\s+)?(.+?)\s+com\s+(?:os\s+|as\s+)?(?:\d+\s+)?(?:cart(?:ões|oes|ão|ao)|cards?|notas?|itens|ideias)\s*:?\s*(.+)$/i) ??
    t.match(/^(?:(?:cri[ea]r?|fa[çc]a|monta?r?|novo)\s+)?(?:um\s+)?quadro\s+(?:chamado\s+)?([^:]+?)\s*:\s*(.+)$/i);
  if (!q) return null;
  let titulo = q[1].replace(/^["“]|["”]$/g, "").trim();
  let projeto = "drend";
  for (const [re, p] of PROJETOS) {
    const achou = titulo.match(re);
    if (achou && achou[0].length < titulo.length) {
      projeto = p;
      titulo = titulo.replace(re, "").replace(/\s+(?:da|na|do|no|para|pra|pro)$/i, "").trim();
      break;
    }
    if (achou) projeto = p;
  }
  const cartoes = separarItens(q[2]).slice(0, 24);
  if (!titulo || cartoes.length === 0) return null;
  return { tipo: "criarQuadro", titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), cartoes, projeto };
}

function slug(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "quadro"
  );
}

/** Um lote só: quadro + cartões em grade. Um desfazer apaga tudo de uma vez. */
export function opCriarQuadro(state: MuralState, c: Extract<Comando, { tipo: "criarQuadro" }>): { op: Op; board: Board } {
  const base = slug(c.titulo);
  let id = base;
  for (let n = 2; state.boards[id]; n++) id = `${base}-${n}`;
  const board: Board = { id, title: c.titulo, project: c.projeto, tags: [] };
  const cards: Card[] = c.cartoes.map((title, i) => ({
    id: `${id}-c${i + 1}`,
    boardId: id,
    kind: "nota",
    title,
    x: 40 + (i % 4) * 240,
    y: 40 + Math.floor(i / 4) * 170,
    w: 220,
  }));
  return { op: { type: "batch", ops: [{ type: "createBoard", board }, ...cards.map((card): Op => ({ type: "addCard", card }))] }, board };
}
