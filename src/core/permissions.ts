/**
 * Níveis de permissão do DREND (documento mestre, seção "Dados, fontes de verdade e permissões").
 *
 * A: automático (ler). B: automático com desfazer (organizar). C: um toque de "pode".
 * D: aprovação específica, com o detalhe do que vai acontecer.
 * Ação desconhecida cai no nível mais alto: o padrão é pedir, nunca agir.
 */

export type Level = "A" | "B" | "C" | "D";

const LEVELS: Record<string, Level> = {
  "ler.email": "A",
  "ler.extrato": "A",
  "ler.mensagens": "A",
  "ler.status": "A",
  "ler.vault": "A",
  "capturar.ideia": "B",
  "mural.organizar": "B",
  "mural.criar": "B",
  "resumo.diario": "B",
  "mensagem.responder": "C",
  "arquivo.mover": "C",
  "arquivo.apagar": "C",
  "tarefa.criar": "C",
  // Dinheiro e hábitos pessoais: só anota o que o Rapha contou (não move dinheiro). Automático, com desfazer.
  "dinheiro.anotar": "B",
  "dinheiro.apagar": "B",
  "habito.criar": "B",
  "habito.marcar": "B",
  "habito.apagar": "B",
  // Contas fixas do mês: anotar, marcar paga (lança o gasto), editar e apagar. Tudo com desfazer.
  "conta.criar": "B",
  "conta.pagar": "B",
  "conta.editar": "B",
  "conta.apagar": "B",
  "dinheiro.mover": "D",
  "deploy": "D",
  "migration": "D",
  "codigo.alterar": "D",
  "apagar.importante": "D",
};

export function levelOf(action: string): Level {
  return LEVELS[action] ?? "D";
}

/** A e B rodam sozinhas e ficam no log; C e D esperam o Rapha. */
export function needsApproval(action: string): boolean {
  const level = levelOf(action);
  return level === "C" || level === "D";
}
