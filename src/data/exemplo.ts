/**
 * Dados de EXEMPLO para a Fase 4, enquanto nenhuma integração está ligada.
 * Toda tela que usa este arquivo mostra o selo "exemplo". Regra do DREND:
 * nenhum número fictício aparece como se fosse real.
 */
import { emptyMural, apply, type MuralState, type Op } from "../core/mural";

export const EXEMPLO = true;

export const flush = {
  faturamento: 3480,
  lucro: 1120,
  proximaTarefa: "Aprovar o painel Control OS",
  // Últimos 7 dias, hoje por último.
  semana: [
    { dia: "2026-10-18", valor: 1980 },
    { dia: "2026-10-19", valor: 2410 },
    { dia: "2026-10-20", valor: 1720 },
    { dia: "2026-10-21", valor: 2950 },
    { dia: "2026-10-22", valor: 3120 },
    { dia: "2026-10-23", valor: 2640 },
    { dia: "2026-10-24", valor: 3480 },
  ],
  saude: [
    ["Site, API e banco", "Tudo no ar"],
    ["WhatsApp Business", "4 conversas novas"],
  ],
} as const;

export const drendStatus = {
  fase: "Fase 4",
  saude: [
    ["Memória (vaults)", "Sincronizada"],
    ["Integrações", "1 de 9 ligadas"],
  ],
} as const;

export const outrosProjetos = [
  ["FlushFinance", "Em QA"],
  ["Doce Fornada", "Pausado"],
  ["Black Store", "Pausado"],
] as const;

export const dinheiroHoje = { entradas: 640, saidas: 212, atualizado: "21:04" };
export const dinheiroMes = { entradas: 7900, saidas: 5210 };

export const agenda = [
  ["09:00", "Reposição da Flush com o fornecedor"],
  ["12:00", "Resumo do dia chega no iPhone"],
  ["19:30", "Estudo · 1 h"],
] as const;

export const metas = [
  ["Reserva de emergência", 40],
  ["Estudo · 20 h no mês", 65],
] as const;

export const linhaDoTempo = {
  dia: "15 de agosto",
  itens: [
    { hora: "10:12", texto: "Foto em Unaí, centro", tipo: "fato", base: "foto + local" },
    { hora: "13:40", texto: "Pagamento no InfinitePay", tipo: "fato", base: "extrato" },
    { hora: "19:05", texto: "Provável jantar com a família", tipo: "hipótese", base: "foto sem local" },
  ],
} as const;

const seed: Op[] = [
  { type: "createBoard", board: { id: "natal", title: "Marketing Flush · Natal", project: "flushstore", tags: ["natal", "kit", "reels"] } },
  { type: "createBoard", board: { id: "vitrine", title: "Vitrine Flush", project: "flushstore", tags: [] } },
  { type: "createBoard", board: { id: "vida-ideias", title: "Vida · ideias", project: "vida", tags: [] } },
  { type: "addCard", card: { id: "c1", boardId: "natal", kind: "imagem", title: "Vitrine de sabores em grade", x: 40, y: 40, w: 250 } },
  { type: "addCard", card: { id: "c2", boardId: "natal", kind: "campanha", title: "Natal Flush 2026", body: "Kit presente, frete para Unaí, posts de 1 a 24/12", x: 420, y: 200, w: 220 } },
  { type: "addCard", card: { id: "c3", boardId: "natal", kind: "link", title: "Reels de unboxing com luz neon", source: "instagram", x: 720, y: 60, w: 240 } },
  { type: "addCard", card: { id: "c4", boardId: "natal", kind: "nota", title: "Kit presente", body: "2 pods + case + cartão escrito à mão. Testar preço com 10 clientes.", x: 720, y: 400, w: 220 } },
  { type: "addCard", card: { id: "c5", boardId: "natal", kind: "audio", title: "Tive uma ideia: kit acima de R$ 150", x: 80, y: 470, w: 250 } },
  { type: "addCard", card: { id: "c6", boardId: "natal", kind: "pdf", title: "Tabela de preços do fornecedor", source: "gmail", x: 420, y: 560, w: 230 } },
  { type: "linkCards", link: { id: "l1", boardId: "natal", from: "c1", to: "c2" } },
  { type: "linkCards", link: { id: "l2", boardId: "natal", from: "c2", to: "c4" } },
  { type: "linkCards", link: { id: "l3", boardId: "natal", from: "c2", to: "c5" } },
];

export function muralExemplo(): MuralState {
  return seed.reduce((s, op) => apply(s, op).state, emptyMural());
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
