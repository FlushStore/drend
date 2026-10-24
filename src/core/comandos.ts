/**
 * Comandos que o DREND entende sem IA (Fase 4). Cada comando vira operações do Mural,
 * então tudo entra no log e pode ser desfeito. A Fase 6 troca o leitor por um modelo
 * de linguagem, mas a saída continua a mesma: um `Op`.
 */
import type { Board, Card, MuralState, Op } from "./mural";
import { normalizar } from "./fala";
import { lerValor } from "./financeiro";
import type { QuandoAgenda } from "./agenda";
import { lerLancamento, type LancamentoLido } from "./dinheiro";
import { lerConta, lerPagamentoDeConta, type ContaLida } from "./contas";
import { lerLimite, lerTirar } from "./metas";
import { lerConsultaDoDiario, lerFraseDoDiario, type QuandoDiario } from "./diario";

export type Comando =
  | { tipo: "criarQuadro"; titulo: string; cartoes: string[]; projeto: string }
  | { tipo: "desfazer" }
  | { tipo: "ideia"; texto: string }
  | { tipo: "tarefa"; texto: string }
  /** `tarefa`: a frase disse "tarefa" ("feito: a tarefa academia"), então não é hábito. */
  | { tipo: "concluir"; texto: string; tarefa?: true }
  | { tipo: "reabrir"; texto: string }
  | { tipo: "apagarTarefa"; texto: string }
  | { tipo: "pendencias" }
  | { tipo: "vendas"; periodo: Periodo }
  | { tipo: "resumo" }
  | { tipo: "saudacao" }
  | { tipo: "agradecimento" }
  | { tipo: "ajuda" }
  | { tipo: "meta"; valor: number }
  /** "limite mercado 800" · "limite do mês 3000": `categoria` null é o limite geral. */
  | { tipo: "limite"; categoria: string | null; valor: number }
  /** "tirar meta da flush" */
  | { tipo: "tirarMeta" }
  /** "tirar limite mercado" · "tirar limite do mês" */
  | { tipo: "tirarLimite"; categoria: string | null }
  /** "como estão as metas?" */
  | { tipo: "metas" }
  | { tipo: "missaoNota"; missao: string; texto: string }
  | { tipo: "missaoStatus"; missao: string | null }
  | { tipo: "agenda"; quando: QuandoAgenda }
  | { tipo: "vault"; termo: string }
  | { tipo: "projetosVault" }
  | { tipo: "lancamento"; lancamento: LancamentoLido }
  | { tipo: "dinheiro" }
  | { tipo: "apagarLancamento" }
  | { tipo: "novoHabito"; nome: string }
  | { tipo: "habitos" }
  /** "conta de luz todo dia 10, 200 reais": conta fixa nova (Vida). */
  | { tipo: "novaConta"; conta: ContaLida }
  /** "minhas contas" · "quais contas vencem?" */
  | { tipo: "contas" }
  /** "paguei a luz": `texto` é a conta; `frase`, o que vira "concluir" se nenhuma conta casar. */
  | { tipo: "pagarConta"; texto: string; frase: string }
  /** "como foi a semana?" · "resumo da semana": a revisão dos últimos 7 dias. */
  | { tipo: "semana" }
  /** "diário: dia puxado" · "hoje foi bom" · "como me sinto: cansado": anotação do dia; `humor` só quando ele disse. */
  | { tipo: "diario"; texto: string; humor: number | null }
  /** "o que anotei ontem?" · "meu diário da semana" · "como foi terça?" */
  | { tipo: "consultaDiario"; quando: QuandoDiario };

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
  // Diário do dia (antes de tudo que começa igual: "anota…", "o que eu anotei…" do vault).
  const diario = lerFraseDoDiario(t);
  if (diario) return { tipo: "diario", ...diario };
  const consultaDiario = lerConsultaDoDiario(t);
  if (consultaDiario !== null) return { tipo: "consultaDiario", quando: consultaDiario };

  // Dinheiro pessoal: "gastei 50 no mercado" · "recebi 1.200 do freela" (só com valor na frase).
  const lancamento = lerLancamento(t);
  if (lancamento) return { tipo: "lancamento", lancamento };
  // Contas fixas: "conta de luz todo dia 10, 200 reais" · "internet dia 15 R$ 99,90" · "paguei a luz" (sem valor; "já paguei X" segue como concluir).
  const conta = lerConta(t);
  if (conta) return { tipo: "novaConta", conta };
  const paga = lerPagamentoDeConta(t);
  if (paga) return { tipo: "pagarConta", texto: paga, frase: t.replace(/[.!?]+$/, "") };
  if (/^(?:(?:quais|que) (?:as )?contas?(?: (?:que )?(?:vencem|vence|tenho|faltam|falta pagar|a pagar|para pagar))?(?: (?:hoje|essa semana|esta semana|esse mes|este mes|no mes))?|(?:minhas|as) contas(?: (?:do mes|fixas|a pagar|para pagar))?|contas(?: do mes| fixas| a pagar| para pagar)?|o que (?:falta|tenho (?:que|para)) pagar(?: (?:esse|este|no) mes)?|quanto falta pagar(?: (?:esse|este|no) mes)?|como (?:estao|andam|vao) (?:as |minhas )?contas)$/.test(n)) {
    return { tipo: "contas" };
  }
  if (/^(?:apag[ae]|apagar|remov[ae]|remover|tir[ae]|tirar|exclu[ia]|excluir|delet[ae]|deletar|desfa(?:z|zer|ca)) (?:o )?ultimo (?:lancamento|gasto|entrada|recebimento)$/.test(n)) {
    return { tipo: "apagarLancamento" };
  }
  if (/^(?:quanto (?:eu )?(?:gastei|recebi|ganhei)|(?:qual (?:e |o )?)?(?:o |meu )?saldo|(?:meus|os) gastos|(?:minhas|as) financas|meu dinheiro|como (?:esta|estao|anda|andam|vai|vao) (?:o |os |as |meu |meus |minhas )?(?:saldo|dinheiro|gastos|financas))\b/.test(n)) {
    return { tipo: "dinheiro" };
  }
  // "novo hábito academia" · "criar hábito: ler 10 páginas" · "hábito: beber água"
  const habito = t.match(/^(?:(?:cri[ae]r?|cri[ae]|adiciona(?:r)?|coloca(?:r)?|novo|nova)\s+(?:um\s+)?(?:novo\s+)?h[aá]bito|h[aá]bito(?:\s+novo)?)\s*[:,-]?\s+(.+)$/i);
  if (habito && resto(habito)) return { tipo: "novoHabito", nome: resto(habito) };
  if (/^(?:(?:meus|os) )?habitos$|^como (?:estao|andam|vao) (?:os |meus )?habitos$/.test(n)) return { tipo: "habitos" };

  // "anota na missão: X" · "missão flush: X" · "anota na missão da flush: X" (antes da ideia: "anota" é dos dois).
  // Hífen só separa com espaço antes: "vape-mania" é nome.
  const nota = t.match(/^(?:(?:anot[ae]|registr[ae]|coloc[ae]|p[oõ]e)\s+(?:isso\s+)?(?:na|no)\s+)?miss[aã]o\b([^:]*?)(?:\s*[:,]|\s+-)\s*(.+)$/i);
  const textoNota = nota?.[2].trim().replace(/^["“”']+|["“”']+$/g, "").trim();
  if (nota && textoNota) return { tipo: "missaoNota", missao: qualMissao(normalizar(nota[1])) ?? "drend", texto: textoNota };
  // Metas do mês: "limite mercado 800" · "tirar meta da flush" · "como estão as metas?"
  const limite = lerLimite(t);
  if (limite) return { tipo: "limite", ...limite };
  const tirar = lerTirar(t);
  if (tirar) return tirar.tipo === "meta" ? { tipo: "tirarMeta" } : { tipo: "tirarLimite", categoria: tirar.categoria };
  if (/^(?:e )?(?:como (?:estao|andam|vao|ficam) )?(?:as |os |minhas |meus )?(?:metas|limites)(?: (?:e )?(?:os |as |meus |minhas )?(?:limites|metas))?(?: (?:do|desse|deste) mes)?$/.test(n)) {
    return { tipo: "metas" };
  }
  // "meta do mês 10 mil" · "minha meta é 8000" · "meta: R$ 12.000" · "meta flush 20000" · "meta de vendas 15k"
  const meta = t.match(/^(?:(?:minha|a|nossa)\s+)?meta(?:\s+(?:do|desse|deste|pro|para o)\s+m[eê]s)?(?:\s+(?:(?:da|de|do)\s+)?(?:flush(?:store)?|vendas?|faturamento))?(?:\s+(?:do|desse|deste)\s+m[eê]s)?\s*(?:[:=-]|(?:é|e|vai ser|fica|agora é)(?=\s|$))?\s*(?:(?:de|em|pra|para)\s+)?(.+)$/i);
  if (meta) {
    const valor = lerValor(meta[1]);
    if (valor) return { tipo: "meta", valor };
  }

  // "o que o vault diz sobre X" · "procura no vault X" · "o que eu anotei sobre X" · "vault: X"
  const fonte = String.raw`(?:(?:o |meu |no |na )?(?:vault|obsidian|segundo cerebro|cerebro|minhas notas|notas))`;
  const vault =
    n.match(new RegExp(String.raw`^(?:o que )?(?:${fonte}|eu anotei|(?:eu )?tenho anotado)(?: (?:diz|fala|tem|sabe))?(?: (?:de|sobre|da|do))? (.+)$`)) ??
    n.match(new RegExp(String.raw`^(?:busca|buscar|procura|procurar|pesquisa|pesquisar|acha|achar)(?: (?:no|na|nas|em|meu|minhas))? ${fonte.replace("(?:o |meu |no |na )?", "")}(?: (?:por|sobre|de))? (.+)$`)) ??
    n.match(/^vault (.+)$/);
  if (vault) {
    const termo = vault[1].replace(/^(?:o que (?:diz|fala) )?(?:sobre|de|da|do) /, "").replace(/^(?:a|o|as|os) /, "").trim();
    if (/^(?:projetos?|meus projetos)$/.test(termo)) return { tipo: "projetosVault" };
    if (termo) return { tipo: "vault", termo };
  }
  if (/^(?:como (?:estao|andam|vao) )?(?:os |meus )?projetos(?: do vault)?$/.test(n)) return { tipo: "projetosVault" };

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
  if (feito && resto(feito)) return /\btarefa\b/i.test(t) ? { tipo: "concluir", texto: resto(feito), tarefa: true } : { tipo: "concluir", texto: resto(feito) };
  const reabrir = t.match(/^(?:reabr[ea]|reabrir|desmarca(?:r)?)\s+(?:a\s+tarefa\s+)?(.+)$/i);
  if (reabrir && resto(reabrir)) return { tipo: "reabrir", texto: resto(reabrir) };
  const apagar =
    t.match(/^(?:apag[ae]|apagar|remov[ae]|remover|tir[ae]|tirar|exclu[ia]|excluir|delet[ae]|deletar)\s+(?:a\s+)?tarefa\s*:?\s+(.+)$/i) ??
    t.match(/^(?:tir[ae]|tirar|remov[ae])\s+(.+?)\s+da\s+(?:lista|minhas tarefas)$/i);
  if (apagar && resto(apagar)) return { tipo: "apagarTarefa", texto: resto(apagar) };

  const quadro = lerQuadro(t);
  if (quadro) return quadro;

  // Perguntas: o texto normalizado já tirou acento, gíria e pontuação.
  // "como foi a semana?" · "resumo da semana" · "revisão semanal" (antes da agenda e das vendas).
  if (/^(?:e )?(?:como (?:foi|esta|anda|vai|ficou) (?:a |minha |essa |esta )?semana|(?:me (?:da|de|faz|faca|manda) )?(?:o |um |a )?(?:resumo|revisao|balanco) (?:da|de|desta|dessa) (?:minha )?semana|(?:a )?revisao semanal|(?:a )?semana em resumo)(?: drend)?$/.test(n)) {
    return { tipo: "semana" };
  }
  // "minha agenda" · "o que tenho amanhã?" · "próximo compromisso" · "tenho reunião essa semana?"
  if (/\b(?:agenda|compromissos?|reuni(?:ao|oes)|eventos?|marcado|marquei)\b/.test(n) || /^o que (?:eu )?tenho (?:amanha|essa semana|esta semana|na semana)$/.test(n)) {
    const quando: QuandoAgenda = /\bproxim[oa]\b/.test(n) ? "proximo" : /\bamanha\b/.test(n) ? "amanha" : /\bsemana\b/.test(n) ? "semana" : "hoje";
    return { tipo: "agenda", quando };
  }
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
