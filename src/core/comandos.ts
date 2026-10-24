/**
 * Comandos que o DREND entende sem IA (Fase 4). Cada comando vira operações do Mural,
 * então tudo entra no log e pode ser desfeito. A Fase 6 troca o leitor por um modelo
 * de linguagem, mas a saída continua a mesma: um `Op`.
 */
import type { Board, Card, MuralState, Op } from "./mural";
import { normalizar } from "./fala";
import { lerValor } from "./financeiro";

export type Comando =
  | { tipo: "criarQuadro"; titulo: string; cartoes: string[]; projeto: string }
  | { tipo: "desfazer" }
  | { tipo: "ideia"; texto: string }
  | { tipo: "tarefa"; texto: string }
  | { tipo: "concluir"; texto: string }
  | { tipo: "reabrir"; texto: string }
  | { tipo: "apagarTarefa"; texto: string }
  | { tipo: "pendencias" }
  | { tipo: "vendas"; periodo: Periodo }
  | { tipo: "resumo" }
  | { tipo: "saudacao" }
  | { tipo: "agradecimento" }
  | { tipo: "ajuda" }
  | { tipo: "meta"; valor: number }
  | { tipo: "missaoNota"; missao: string; texto: string }
  | { tipo: "missaoStatus"; missao: string | null };

export type Periodo = "hoje" | "ontem" | "semana" | "mes";

/** Nome falado → chave da missão no banco. */
const MISSOES: ReadonlyArray<[RegExp, string]> = [
  [/\bflush ?finance\b|\bfinance\b/, "flushfinance"],
  [/\bflush(?: ?store)?\b/, "flush"],
  [/\bvape ?mania\b|\bvm\b/, "vape-mania"],
  [/\bdrend\b|\brapha ?os\b/, "drend"],
];
function qualMissao(n: string): string | null {
  for (const [re, m] of MISSOES) if (re.test(n)) return m;
  return null;
}

const PROJETOS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:da |na |para a |pra )?flush(?:store)?\b/i, "flushstore"],
  [/\b(?:do |no |para o |pro )?drend\b/i, "drend"],
];

/** "A, B e C" → ["A", "B", "C"]. Aceita ; e quebra de linha também. */
export function separarItens(texto: string): string[] {
  return texto
    .split(/\s*(?:[,;\n]|\s+e\s+)\s*/i)
    .map((t) => t.trim().replace(/^["“”']+|["“”'.]+$/g, "").trim())
    .filter(Boolean);
}

/** O resto da frase depois do pedido, sem aspas nem ponto final. */
const resto = (m: RegExpMatchArray | null) => m?.[1]?.trim().replace(/^["“”']+|["“”'.!?]+$/g, "").trim() || "";

export function entender(entrada: string): Comando | null {
  const t = entrada.trim().replace(/\s+/g, " ");
  const n = normalizar(t);
  if (!n) return null;
  if (/^(?:desfa(?:z|zer|ca)|volta(?:r)?)(?: (?:a |o )?ultim[ao](?: coisa| acao)?)?$/.test(n)) {
    return { tipo: "desfazer" };
  }
  if (/^(?:ajuda|help|socorro|comandos|como (?:funciona|te uso|usar)|o que (?:voce )?(?:faz|sabe fazer|consegue fazer|entende)|preciso de ajuda)(?: drend)?$/.test(n)) {
    return { tipo: "ajuda" };
  }

  // "anota na missão: X" · "missão flush: X" · "anota na missão da flush: X" (antes da ideia: "anota" é dos dois)
  const nota = t.match(/^(?:(?:anot[ae]|registr[ae]|coloc[ae]|p[oõ]e)\s+(?:isso\s+)?(?:na|no)\s+)?miss[aã]o\b([^:]*?)\s*[:,-]\s*(.+)$/i);
  const textoNota = nota?.[2].trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  if (nota && textoNota) return { tipo: "missaoNota", missao: qualMissao(normalizar(nota[1])) ?? "drend", texto: textoNota };
  // "meta do mês 10 mil" · "minha meta é 8000" · "meta: R$ 12.000"
  const meta = t.match(/^(?:(?:minha|a|nossa)\s+)?meta(?:\s+(?:do|desse|deste|pro|para o)\s+m[eê]s)?(?:\s+(?:da|de)\s+(?:flush|vendas?))?\s*(?:[:=-]|(?:é|e|vai ser|fica|agora é)(?=\s|$))?\s*(?:de\s+)?(.+)$/i);
  if (meta) {
    const valor = lerValor(meta[1]);
    if (valor) return { tipo: "meta", valor };
  }

  const ideia = t.match(/^tive uma ideia[:,]?\s*(.*)$/i);
  if (ideia) return { tipo: "ideia", texto: ideia[1] || t };
  // "guarda isso: kit de natal" · "salva aí: cupom pra quem indicar" · "anota: …" (sem "tarefa")
  const guardar = t.match(/^(?:guard[ae]|salv[ae]|anot[ae])(?:\s+(?:isso|isto|ai|aí|essa ideia|esta ideia|ideia))*\s*[:,-]\s*(.+)$/i) ?? t.match(/^(?:ideia)\s*[:,-]\s*(.+)$/i);
  if (guardar && resto(guardar) && !/^(?:anot[ae])\s+(?:a\s+)?tarefa\b/i.test(t)) return { tipo: "ideia", texto: resto(guardar) };

  // "me lembra de pagar o fornecedor" · "lembrar de X" · "tarefa: X" · "preciso X" · "tenho q X" · "não deixa eu esquecer de X"
  const tarefa = t.match(
    /^(?:(?:me\s+)?lembr(?:a|ar|e)(?:-me)?(?:\s+eu)?\s+(?:de\s+|que\s+|q\s+)?|tarefa\s*:\s*|anota(?:r)?\s+(?:a\s+)?(?:uma\s+)?tarefa\s*:?\s*|preciso\s+(?:de\s+)?|tenho\s+(?:que|q)\s+|n(?:ão|ao)?\s+(?:me\s+)?(?:deixa\s+(?:eu\s+)?)?esquecer?\s+(?:de\s+)?)(.+)$/i,
  );
  if (tarefa && resto(tarefa)) return { tipo: "tarefa", texto: resto(tarefa) };

  // "feito: pagar fornecedor" · "fiz o stories" · "já paguei o fornecedor" · "marca X como feita"
  const feito =
    t.match(/^(?:feito|fiz|conclu[ií](?:do|da)?|terminei|acabei|pronto|marca(?:r)?(?:\s+como)?\s+feit[ao])\s*[:,-]?\s+(?:a\s+tarefa\s+)?(.+)$/i) ??
    t.match(/^marca(?:r)?\s+(.+?)\s+como\s+feit[ao]$/i) ??
    t.match(/^j[aá]\s+(.+)$/i);
  if (feito && resto(feito)) return { tipo: "concluir", texto: resto(feito) };
  const reabrir = t.match(/^(?:reabr[ea]|reabrir|desmarca(?:r)?)\s+(?:a\s+tarefa\s+)?(.+)$/i);
  if (reabrir && resto(reabrir)) return { tipo: "reabrir", texto: resto(reabrir) };
  const apagar =
    t.match(/^(?:apag[ae]|apagar|remov[ae]|remover|tir[ae]|tirar|exclu[ia]|excluir|delet[ae]|deletar)\s+(?:a\s+)?tarefa\s*:?\s+(.+)$/i) ??
    t.match(/^(?:tir[ae]|tirar|remov[ae])\s+(.+?)\s+da\s+(?:lista|minhas tarefas)$/i);
  if (apagar && resto(apagar)) return { tipo: "apagarTarefa", texto: resto(apagar) };

  const quadro = lerQuadro(t);
  if (quadro) return quadro;

  // Perguntas: o texto normalizado já tirou acento, gíria e pontuação.
  // "como está a missão?" · "missão da flush" · "o que falta no drend?" (antes das vendas: "flush" é dos dois)
  if (/\bmiss(?:ao|oes)\b/.test(n) || (/^o que falta (?:no|na|em) /.test(n) && qualMissao(n))) return { tipo: "missaoStatus", missao: qualMissao(n) };
  const loja = /\bflush\b/.test(n);
  if (
    /\b(?:vend\w*|fatur\w*|lucr\w*|pedidos?)\b/.test(n) ||
    (loja && /\b(?:como|hoje|ontem|semana|quanto|status|numeros?)\b|^(?:e )?a flush$/.test(n)) ||
    /^e (?:a |o )?(?:semana|ontem|mes)$/.test(n) ||
    /^(?:como (?:esta|ta|vai) )?(?:o |esse |este )?mes$/.test(n)
  ) {
    const periodo: Periodo = /\bmes\b|\bmensal\b/.test(n) ? "mes" : /\bsemana\b|\b7 dias\b/.test(n) ? "semana" : /\bontem\b/.test(n) ? "ontem" : "hoje";
    return { tipo: "vendas", periodo };
  }
  if (/\bmeta\b/.test(n)) return { tipo: "vendas", periodo: "mes" };
  if (/\b(?:resumo|me atualiza|novidades?|como (?:esta|foi|anda) (?:o )?meu dia|o que (?:ha|tem) de novo)\b/.test(n)) return { tipo: "resumo" };
  if (/\b(?:pendencias?|pendente|minhas tarefas|tarefas|afazeres|o que (?:eu )?tenho|o que falta|o que (?:eu )?preciso fazer|tem algo para fazer|(?:minha|a) lista)\b/.test(n)) {
    return { tipo: "pendencias" };
  }
  if (/^(?:(?:oi|ola|opa|salve|fala|e ai|eae|eai|hey|bom dia|boa tarde|boa noite)(?: (?:drend|tudo bem|tudo bom|beleza|tranquilo|mano|parceiro))*)$/.test(n)) {
    return { tipo: "saudacao" };
  }
  if (/^(?:valeu|obrigado|obrigada|tamo junto|show|top|perfeito|massa|boa|beleza|otimo|show de bola)(?: (?:drend|demais|mano|mesmo|man))*$/.test(n)) {
    return { tipo: "agradecimento" };
  }
  return null;
}

/** "crie um quadro Natal com cartões A, B e C" · "quadro Natal: A, B, C" */
function lerQuadro(t: string): Comando | null {
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
