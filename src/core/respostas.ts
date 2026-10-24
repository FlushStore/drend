/**
 * O que o DREND responde quando o Rapha pergunta. Funções puras: recebem o que o app
 * já sabe (tarefas, leitura da Flush, hora) e devolvem o texto. Sem leitura real, ele
 * diz que não tem o número em vez de mostrar exemplo como se fosse verdade.
 */
import type { DiaFlush } from "../fontes/flush-regras";
import type { Periodo } from "./comandos";
import { abertas, type Tarefa } from "./tarefas";
import { progressoMeta, resumirMes, type MesFlush } from "./financeiro";
import { estaParado, nomeDaMissao, projetos, type EventoMissao } from "./missao";

/** O que a conversa sabe da Flush: `null` quando ela não está ligada neste aparelho. */
export type LeituraFlush = { fase: "carregando" } | { fase: "ok" | "erro"; dias: readonly DiaFlush[]; historico?: readonly DiaFlush[]; atualizadoEm: string } | null;

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

export function responderVendas(periodo: Periodo, leitura: LeituraFlush, agora = new Date(), meta: number | null = null): string {
  if (!leitura) return "A Flush ainda não está ligada aqui. Ligue em Sua conta → Ligar a FlushStore, que eu passo a responder com os números de verdade.";
  if (leitura.fase === "carregando") return "Estou lendo a Flush agora. Pergunte de novo em instantes.";
  const dias = leitura.dias;
  if (!dias.length) return "Não consegui ler a Flush agora.";
  const aviso = leitura.fase === "erro" ? " (Não consegui atualizar agora: é a última leitura.)" : "";

  if (periodo === "mes") {
    const mes = leitura.historico ? resumirMes(leitura.historico, agora) : null;
    return mes ? responderMes(mes, meta, agora) + aviso : "Ainda não tenho o mês inteiro da Flush. Abra o app com internet que eu leio.";
  }

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

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** O mês em três linhas: quanto, contra o mês passado, e a meta (quando tem). */
export function responderMes(mes: MesFlush, meta: number | null, agora?: Date): string {
  const { atual, anterior } = mes;
  if (!atual.valor) return `Em ${mes.nome} a Flush ainda não vendeu.${meta ? ` Meta: ${reais(meta)}.` : ""}`;
  const linhas = [`Em ${mes.nome}, até hoje: ${reais(atual.valor)} em ${pedidos(atual.pedidos)}, ${reais(atual.lucro)} de lucro${mes.margem !== null ? ` (margem de ${pct(mes.margem)})` : ""}.`];
  if (mes.variacao !== null) {
    const v = mes.variacao;
    const sentido = Math.abs(v) < 0.005 ? "igual a" : v > 0 ? `${pct(v)} acima de` : `${pct(-v)} abaixo de`;
    linhas.push(`Está ${sentido} ${anterior.nome} no mesmo ponto (${reais(anterior.ateHoje.valor)}).`);
  }
  if (meta) {
    const p = progressoMeta(mes, meta, agora);
    linhas.push(p.falta === 0
      ? `Meta de ${reais(meta)} batida.`
      : `Meta de ${reais(meta)}: ${pct(p.feito)} feito, faltam ${reais(p.falta)}${p.porDia ? `, ${reais(p.porDia)} por dia` : ""}.${p.noRitmo ? " No ritmo de agora, bate." : ""}`);
  } else {
    linhas.push(`No ritmo de agora, o mês fecha em ${reais(mes.projecao)}. Para ter meta, diga “meta do mês 10 mil”.`);
  }
  return linhas.join("\n");
}

/** O que está andando numa missão (ou em todas), para a conversa. */
export function responderMissao(eventos: readonly EventoMissao[] | null, missao: string | null, agora = new Date()): string {
  if (!eventos) return "Não consegui ler as Missões agora. Entre na sua conta do DREND e tente de novo.";
  const ps = projetos(eventos, agora).filter((p) => (missao ? p.missao === missao : p.ultimo));
  if (!ps.length) return missao ? `A missão ${nomeDaMissao(missao)} ainda não tem nada.` : "Nenhuma missão ainda.";
  if (missao) {
    const p = ps[0];
    const agoraItens = p.itens.agora.slice(0, 5).map((i) => `• ${i.titulo}`).join("\n");
    const parado = p.pausado ? "\nPausada." : estaParado(p) ? `\nParada há ${p.parado} dias.` : "";
    return `${p.nome}: ${p.itens.agora.length} em andamento, ${p.itens.feito.length} feitos, ${p.itens.depois.length} para depois.${agoraItens ? `\n${agoraItens}` : ""}${parado}`;
  }
  return ps.map((p) => `• ${p.nome}: ${p.itens.agora.length} em andamento${p.pausado ? ", pausada" : estaParado(p) ? `, parada há ${p.parado} dias` : ""}`).join("\n");
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
  "• números da Flush: “quanto vendi hoje?”, “e a semana?”, “e o mês?”",
  "• metas do mês: “meta da flush 20 mil”, “limite mercado 800”, “limite do mês 3000”, “como estão as metas?”, “tirar limite mercado”",
  "• seu dinheiro: “gastei 50 no mercado”, “recebi 1.200 do freela”, “quanto gastei?”, “apaga o último lançamento”",
  "• contas do mês: “conta de luz todo dia 10, 200 reais”, “paguei a luz”, “quais contas vencem?”",
  "• hábitos: “novo hábito academia”, “fiz academia”, “meus hábitos”",
  "• a semana: “como foi a semana?”, “resumo da semana”",
  "• agenda: “o que tenho amanhã?”, “minha agenda da semana”, “próximo compromisso”",
  "• missões: “anota na missão: terminei o login”, “como está a missão da flush?”",
  "• vault do Obsidian: “o que o vault diz sobre a Black Store?”, “como estão os projetos?”",
  "• guardar ideia: “tive uma ideia: kit de natal”",
  "• montar quadro: “crie um quadro Natal com cartões vídeo, cupom e stories”",
  "• voltar atrás: “desfaz”",
].join("\n");

const AGRADECIMENTOS = ["Tamo junto.", "Por nada.", "Tô aqui."];
export function responderAgradecimento(agora = new Date()): string {
  return AGRADECIMENTOS[agora.getMinutes() % AGRADECIMENTOS.length];
}
