/**
 * Motor do Mural.
 *
 * A IA (e a interface) mudam o mural só por estas operações. Nada de clique
 * simulado: cada operação é um objeto que pode ser validado, registrado no log
 * e desfeito. `apply` é puro: recebe o estado e devolve o novo estado mais a
 * operação inversa, que é o que o "Desfazer" executa.
 */

export type CardKind = "nota" | "imagem" | "link" | "pdf" | "audio" | "campanha";

export interface Card {
  id: string;
  boardId: string;
  kind: CardKind;
  title: string;
  body?: string;
  /** Endereço do arquivo ou do link original. O mural nunca copia o conteúdo de terceiros. */
  source?: string;
  x: number;
  y: number;
  w: number;
}

export interface Link {
  id: string;
  boardId: string;
  from: string;
  to: string;
  label?: string;
}

export interface Board {
  id: string;
  title: string;
  /** Projeto ou área dona do quadro: "flushstore", "vape-mania", "vida"... */
  project: string;
  tags: string[];
}

export interface MuralState {
  boards: Record<string, Board>;
  cards: Record<string, Card>;
  links: Record<string, Link>;
}

export type Op =
  | { type: "createBoard"; board: Board }
  | { type: "deleteBoard"; boardId: string }
  | { type: "addCard"; card: Card }
  | { type: "removeCard"; cardId: string }
  | { type: "moveCard"; cardId: string; x: number; y: number }
  | { type: "editCard"; cardId: string; title?: string; body?: string }
  | { type: "linkCards"; link: Link }
  | { type: "unlink"; linkId: string }
  | { type: "batch"; ops: Op[] };

export interface Applied {
  state: MuralState;
  inverse: Op;
}

export class MuralError extends Error {}

export const emptyMural = (): MuralState => ({ boards: {}, cards: {}, links: {} });

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new MuralError(`${what} não existe`);
  return value;
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function apply(state: MuralState, op: Op): Applied {
  switch (op.type) {
    case "createBoard": {
      if (state.boards[op.board.id]) throw new MuralError(`quadro ${op.board.id} já existe`);
      return {
        state: { ...state, boards: { ...state.boards, [op.board.id]: op.board } },
        inverse: { type: "deleteBoard", boardId: op.board.id },
      };
    }
    case "deleteBoard": {
      need(state.boards[op.boardId], `quadro ${op.boardId}`);
      // Apagar um quadro com conteúdo vira um lote: o inverso recria tudo.
      const cards = Object.values(state.cards).filter((c) => c.boardId === op.boardId);
      const links = Object.values(state.links).filter((l) => l.boardId === op.boardId);
      const ops: Op[] = [
        ...links.map((l): Op => ({ type: "unlink", linkId: l.id })),
        ...cards.map((c): Op => ({ type: "removeCard", cardId: c.id })),
      ];
      let s = state;
      const inverses: Op[] = [];
      for (const o of ops) {
        const r = apply(s, o);
        s = r.state;
        inverses.unshift(r.inverse);
      }
      const board = state.boards[op.boardId];
      return {
        state: { ...s, boards: without(s.boards, op.boardId) },
        inverse: { type: "batch", ops: [{ type: "createBoard", board }, ...inverses] },
      };
    }
    case "addCard": {
      need(state.boards[op.card.boardId], `quadro ${op.card.boardId}`);
      if (state.cards[op.card.id]) throw new MuralError(`cartão ${op.card.id} já existe`);
      return {
        state: { ...state, cards: { ...state.cards, [op.card.id]: op.card } },
        inverse: { type: "removeCard", cardId: op.card.id },
      };
    }
    case "removeCard": {
      const card = need(state.cards[op.cardId], `cartão ${op.cardId}`);
      const attached = Object.values(state.links).filter((l) => l.from === op.cardId || l.to === op.cardId);
      let links = state.links;
      for (const l of attached) links = without(links, l.id);
      return {
        state: { ...state, cards: without(state.cards, op.cardId), links },
        inverse: {
          type: "batch",
          ops: [{ type: "addCard", card }, ...attached.map((link): Op => ({ type: "linkCards", link }))],
        },
      };
    }
    case "moveCard": {
      const card = need(state.cards[op.cardId], `cartão ${op.cardId}`);
      return {
        state: { ...state, cards: { ...state.cards, [card.id]: { ...card, x: op.x, y: op.y } } },
        inverse: { type: "moveCard", cardId: card.id, x: card.x, y: card.y },
      };
    }
    case "editCard": {
      const card = need(state.cards[op.cardId], `cartão ${op.cardId}`);
      const next = { ...card };
      if (op.title !== undefined) next.title = op.title;
      if (op.body !== undefined) next.body = op.body;
      return {
        state: { ...state, cards: { ...state.cards, [card.id]: next } },
        inverse: { type: "editCard", cardId: card.id, title: card.title, body: card.body ?? "" },
      };
    }
    case "linkCards": {
      const from = need(state.cards[op.link.from], `cartão ${op.link.from}`);
      const to = need(state.cards[op.link.to], `cartão ${op.link.to}`);
      if (from.boardId !== to.boardId || from.boardId !== op.link.boardId) {
        throw new MuralError("só dá para ligar cartões do mesmo quadro");
      }
      if (state.links[op.link.id]) throw new MuralError(`ligação ${op.link.id} já existe`);
      return {
        state: { ...state, links: { ...state.links, [op.link.id]: op.link } },
        inverse: { type: "unlink", linkId: op.link.id },
      };
    }
    case "unlink": {
      const link = need(state.links[op.linkId], `ligação ${op.linkId}`);
      return {
        state: { ...state, links: without(state.links, op.linkId) },
        inverse: { type: "linkCards", link },
      };
    }
    case "batch": {
      // Tudo ou nada: se uma operação falha, o estado original fica intacto.
      let s = state;
      const inverses: Op[] = [];
      for (const o of op.ops) {
        const r = apply(s, o);
        s = r.state;
        inverses.unshift(r.inverse);
      }
      return { state: s, inverse: { type: "batch", ops: inverses } };
    }
  }
}

/** Quem pediu cada ação: o log registra para o Rapha conferir e desfazer. */
export interface LogEntry {
  id: string;
  at: string;
  actor: "rapha" | "drend" | "claude" | "chatgpt";
  summary: string;
  op: Op;
  inverse: Op;
  undone: boolean;
}

export class Mural {
  state: MuralState;
  log: LogEntry[] = [];
  private seq = 0;

  constructor(state: MuralState = emptyMural(), private now: () => Date = () => new Date()) {
    this.state = state;
  }

  /** Volta um mural salvo (estado + log), para o desfazer continuar valendo depois de fechar o app. */
  static restaurar(salvo: { state: MuralState; log: LogEntry[] }, now?: () => Date): Mural {
    const m = new Mural(salvo.state, now);
    m.log = salvo.log;
    m.seq = salvo.log.reduce((max, e) => Math.max(max, Number(e.id.replace("log-", "")) || 0), 0);
    return m;
  }

  run(op: Op, actor: LogEntry["actor"], summary: string): LogEntry {
    const r = apply(this.state, op);
    this.state = r.state;
    const entry: LogEntry = {
      id: `log-${++this.seq}`,
      at: this.now().toISOString(),
      actor,
      summary,
      op,
      inverse: r.inverse,
      undone: false,
    };
    this.log.push(entry);
    return entry;
  }

  /** Desfaz a última ação ainda ativa e registra o desfazer no log. */
  undo(actor: LogEntry["actor"] = "rapha"): LogEntry | undefined {
    const last = [...this.log].reverse().find((e) => !e.undone && !e.summary.startsWith("Desfez:"));
    if (!last) return undefined;
    const entry = this.run(last.inverse, actor, `Desfez: ${last.summary}`);
    last.undone = true;
    return entry;
  }

  cardsOf(boardId: string): Card[] {
    return Object.values(this.state.cards).filter((c) => c.boardId === boardId);
  }

  linksOf(boardId: string): Link[] {
    return Object.values(this.state.links).filter((l) => l.boardId === boardId);
  }
}
