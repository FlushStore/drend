/**
 * Onde o DREND guarda o que muda: mural, log, caixa de entrada e conversa.
 *
 * Hoje fica no próprio aparelho (localStorage). Quando o projeto Supabase do DREND
 * existir, outro `Repositorio` com a mesma forma entra no lugar sem mexer nas telas.
 */
import type { LogEntry, MuralState } from "./mural";
import type { Tarefa } from "./tarefas";

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
    (r.tarefas === undefined || Array.isArray(r.tarefas))
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
