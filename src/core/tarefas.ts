/**
 * Tarefas do Rapha: o que aparece em "Para você". Funções puras: recebem a lista e
 * devolvem outra, então desfazer é só voltar para a lista anterior.
 */
export interface Tarefa {
  id: string;
  texto: string;
  criadaEm: string;
  feitaEm?: string;
  /** De onde veio: conversa, mural, flush... */
  origem?: string;
}

let seq = 0;
export function novaTarefa(texto: string, agora = new Date(), origem = "conversa"): Tarefa {
  const limpo = texto.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  return { id: `t${agora.getTime().toString(36)}-${++seq}`, texto: limpo.charAt(0).toUpperCase() + limpo.slice(1), criadaEm: agora.toISOString(), origem };
}

export function adicionar(lista: readonly Tarefa[], t: Tarefa): Tarefa[] {
  if (!t.texto || lista.some((x) => !x.feitaEm && x.texto.toLowerCase() === t.texto.toLowerCase())) return [...lista];
  return [...lista, t];
}

export function concluir(lista: readonly Tarefa[], id: string, agora = new Date()): Tarefa[] {
  return lista.map((t) => (t.id === id && !t.feitaEm ? { ...t, feitaEm: agora.toISOString() } : t));
}

export function reabrir(lista: readonly Tarefa[], id: string): Tarefa[] {
  return lista.map((t) => (t.id === id && t.feitaEm ? { ...t, feitaEm: undefined } : t));
}

export function remover(lista: readonly Tarefa[], id: string): Tarefa[] {
  return lista.filter((t) => t.id !== id);
}

/** Abertas, as mais antigas primeiro (o que espera há mais tempo vem antes). */
export function abertas(lista: readonly Tarefa[]): Tarefa[] {
  return lista.filter((t) => !t.feitaEm).sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

/** Feitas há mais de 7 dias saem da lista: o histórico não precisa morar no aparelho. */
export function podar(lista: readonly Tarefa[], agora = new Date()): Tarefa[] {
  const limite = agora.getTime() - 7 * 864e5;
  return lista.filter((t) => !t.feitaEm || new Date(t.feitaEm).getTime() >= limite);
}
