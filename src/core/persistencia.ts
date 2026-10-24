/**
 * Onde o DREND guarda o que muda: mural, log, caixa de entrada e conversa.
 *
 * Hoje fica no próprio aparelho (localStorage). Quando o projeto Supabase do DREND
 * existir, outro `Repositorio` com a mesma forma entra no lugar sem mexer nas telas.
 */
import type { LogEntry, MuralState } from "./mural";
import type { Tarefa } from "./tarefas";
import type { Lancamento } from "./dinheiro";
import type { Habito } from "./habitos";
import type { Conta } from "./contas";
import type { Anotacao } from "./diario";

export const VERSAO = 1;
export const CHAVE = "drend:dados:v1";

export interface Retrato<M = unknown> {
  v: typeof VERSAO;
  salvoEm: string;
  mural: { state: MuralState; log: LogEntry[] };
  caixaDeEntrada: string[];
  mensagens: M[];
  /** Opcional: retratos salvos antes das tarefas continuam válidos. */
  tarefas?: Tarefa[];
  /** Metas em reais, por chave ("flush-mes"). Opcional pelo mesmo motivo. */
  metas?: Record<string, number>;
  /** Dinheiro pessoal (Vida). Opcional: retrato antigo sem o campo = lista vazia. */
  lancamentos?: Lancamento[];
  /** Hábitos (Vida). Opcional pelo mesmo motivo. */
  habitos?: Habito[];
  /** Contas fixas do mês (Vida). Opcional pelo mesmo motivo: ausente = nenhuma conta. */
  contas?: Conta[];
  /** Diário do dia (Vida). Opcional pelo mesmo motivo: ausente = nenhuma anotação. */
  diario?: Anotacao[];
}

export interface Repositorio<M = unknown> {
  carregar(): Retrato<M> | null;
  salvar(r: Omit<Retrato<M>, "v" | "salvoEm">): void;
  apagar(): void;
}

/** Guarda as últimas N mensagens: a conversa inteira não precisa morar no aparelho. */
export const LIMITE_MENSAGENS = 60;

function valido(x: unknown): x is Retrato {
  if (!x || typeof x !== "object") return false;
  const r = x as Partial<Retrato>;
  return (
    r.v === VERSAO &&
    !!r.mural &&
    typeof r.mural.state === "object" &&
    Array.isArray(r.mural.log) &&
    Array.isArray(r.caixaDeEntrada) &&
    Array.isArray(r.mensagens) &&
    (r.tarefas === undefined || Array.isArray(r.tarefas)) &&
    (r.metas === undefined || (typeof r.metas === "object" && r.metas !== null)) &&
    (r.lancamentos === undefined || Array.isArray(r.lancamentos)) &&
    (r.habitos === undefined || Array.isArray(r.habitos)) &&
    (r.contas === undefined || Array.isArray(r.contas)) &&
    (r.diario === undefined || Array.isArray(r.diario))
  );
}

/** `storage` é injetável para teste; no app é o localStorage. Qualquer falha vira "sem dados". */
export function repositorioLocal<M>(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = acessoLocal(), agora = () => new Date()): Repositorio<M> {
  return {
    carregar() {
      try {
        const bruto = storage?.getItem(CHAVE);
        if (!bruto) return null;
        const r = JSON.parse(bruto);
        return valido(r) ? (r as Retrato<M>) : null;
      } catch {
        return null;
      }
    },
    salvar(dados) {
      try {
        const r: Retrato<M> = { v: VERSAO, salvoEm: agora().toISOString(), ...dados, mensagens: dados.mensagens.slice(-LIMITE_MENSAGENS) };
        storage?.setItem(CHAVE, JSON.stringify(r));
      } catch {
        // Aba privada ou armazenamento cheio: o app segue funcionando, só não lembra.
      }
    },
    apagar() {
      try {
        storage?.removeItem(CHAVE);
      } catch {
        /* nada a fazer */
      }
    },
  };
}

function acessoLocal() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
