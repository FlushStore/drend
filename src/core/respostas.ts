/**
 * O que o DREND responde quando o Rapha pergunta. Funções puras: recebem o que o app
 * já sabe (tarefas, leitura da Flush, hora) e devolvem o texto. Sem leitura real, ele
 * diz que não tem o número em vez de mostrar exemplo como se fosse verdade.
 */
import type { DiaFlush } from "../fontes/flush-regras";
import type { Periodo } from "./comandos";
import { abertas, type Tarefa } from "./tarefas";

/** O que a conversa sabe da Flush: `null` quando ela não está ligada neste aparelho. */
export type LeituraFlush = { fase: "carregando" } | { fase: "ok" | "erro"; dias: readonly DiaFlush[]; atualizadoEm: string } | null;

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
const pedidos = (n: number) => `${n} ${n === 1 ? "pedido" : "pedidos"}`;

/** "2026-10-24" → "sexta" (com o dia local, sem fuso deslocar a data). */
export function nomeDoDia(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
}

function diaLocal(agora: Date) {
  const d = new Date(agora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ontemDe(agora: Date) {
  const d = new Date(agora);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return diaLocal(d);
}

function frase(d: DiaFlush, quando: string) {
  if (!d.valor) return `${quando} ainda não teve venda na Flush.`;
  const lucro = d.lucro >= 0 ? `${reais(d.lucro)} de lucro` : `${reais(-d.lucro)} de prejuízo`;
  return `${quando} a Flush vendeu ${reais(d.valor)} em ${pedidos(d.pedidos)}, com ${lucro}.`;
}

export function responderVendas(periodo: Periodo, leitura: LeituraFlush, agora = new Date()): string {
  if (!leitura) return "A Flush ainda não está ligada aqui. Ligue em Sua conta → Ligar a FlushStore, que eu passo a responder com os números de verdade.";
  if (leitura.fase === "carregando") return "Estou lendo a Flush agora. Pergunte de novo em instantes.";
  const dias = leitura.dias;
  if (!dias.length) return "Não consegui ler a Flush agora.";
  const aviso = leitura.fase === "erro" ? " (Não consegui atualizar agora: é a última leitura.)" : "";

  if (periodo === "semana") {
    const total = dias.reduce((s, d) => s + d.valor, 0);
    const lucro = dias.reduce((s, d) => s + d.lucro, 0);
    const n = dias.reduce((s, d) => s + d.pedidos, 0);
    if (!total) return `Nos últimos ${dias.length} dias não teve venda na Flush.${aviso}`;
    const melhor = dias.reduce((a, b) => (b.valor > a.valor ? b : a));
    return `Nos últimos ${dias.length} dias: ${reais(total)} em ${pedidos(n)}, ${reais(lucro)} de lucro. Melhor dia: ${nomeDoDia(melhor.dia)}, com ${reais(melhor.valor)}.${aviso}`;
  }

  const alvo = periodo === "hoje" ? diaLocal(agora) : ontemDe(agora);
  const d = dias.find((x) => x.dia === alvo);
  if (d) return frase(d, periodo === "hoje" ? "Hoje" : "Ontem") + aviso;
  // A leitura é de outro dia (o app abriu sem internet, por exemplo): diz de quando é.
  const ultimo = dias[dias.length - 1];
  const quando = nomeDoDia(ultimo.dia);
  if (!ultimo.valor) return `Não tenho a leitura de ${periodo}. Na última, de ${quando}, não teve venda.`;
  return `Não tenho a leitura de ${periodo}. Na última, de ${quando}: ${reais(ultimo.valor)} em ${pedidos(ultimo.pedidos)}, ${reais(ultimo.lucro)} de lucro.`;
}

export function responderPendencias(tarefas: readonly Tarefa[], ideiasSoltas: number): string {
  const lista = abertas(tarefas);
  const ideias = ideiasSoltas ? `${ideiasSoltas === 1 ? "1 ideia espera" : `${ideiasSoltas} ideias esperam`} um projeto.` : "";
  if (!lista.length) return ideias ? `Nenhuma tarefa aberta. ${ideias}` : "Nenhuma tarefa aberta.";
  const mostrar = lista.slice(0, 5).map((t) => `• ${t.texto}`).join("\n");
  const mais = lista.length > 5 ? `\n…e mais ${lista.length - 5}.` : "";
  return `${lista.length === 1 ? "Uma tarefa aberta" : `${lista.length} tarefas abertas`}:\n${mostrar}${mais}${ideias ? `\nE ${ideias.charAt(0).toLowerCase()}${ideias.slice(1)}` : ""}`;
}

export function cumprimento(agora = new Date()): string {
  const h = agora.getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/** O dia em duas linhas: tarefas e Flush. É o que a saudação e o "resumo" respondem. */
export function responderResumo(tarefas: readonly Tarefa[], leitura: LeituraFlush, agora = new Date(), abertura = `${cumprimento(agora)}, Rapha.`): string {
  const n = abertas(tarefas).length;
  const parteTarefas = n ? `Você tem ${n === 1 ? "1 tarefa aberta" : `${n} tarefas abertas`}.` : "Nenhuma tarefa aberta.";
  let parteFlush = "";
  if (leitura && leitura.fase !== "carregando") {
    const hoje = leitura.dias.find((d) => d.dia === diaLocal(agora));
    if (hoje) parteFlush = hoje.valor ? ` A Flush vendeu ${reais(hoje.valor)} hoje, em ${pedidos(hoje.pedidos)}.` : " A Flush ainda não vendeu hoje.";
  }
  return `${abertura} ${parteTarefas}${parteFlush}`;
}

export const AJUDA = [
  "Comigo dá para:",
  "• anotar: “me lembra de pagar o fornecedor”",
  "• concluir: “feito: pagar o fornecedor”",
  "• ver o que falta: “o que tenho hoje?”",
  "• números da Flush: “quanto vendi hoje?”, “e a semana?”",
  "• guardar ideia: “tive uma ideia: kit de natal”",
  "• montar quadro: “crie um quadro Natal com cartões vídeo, cupom e stories”",
  "• voltar atrás: “desfaz”",
].join("\n");

const AGRADECIMENTOS = ["Tamo junto.", "Por nada.", "Tô aqui."];
export function responderAgradecimento(agora = new Date()): string {
  return AGRADECIMENTOS[agora.getMinutes() % AGRADECIMENTOS.length];
}
