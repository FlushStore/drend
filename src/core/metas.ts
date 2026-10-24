/**
 * Metas do mês: a meta de faturamento da Flush e os limites de gasto do Rapha (Vida).
 * Só o que ele definiu fica guardado (em `metas`, no retrato, como chave → reais); o
 * faturamento vem da leitura da Flush na hora e o gasto, dos lançamentos reais. Nada é
 * copiado da Flush. Funções puras: desfazer é voltar ao valor anterior da chave.
 * O mês e o "hoje" são sempre os de Brasília; os limites valem para todo mês (o gasto zera na virada).
 */
import { normalizar } from "./fala";
import { diasRestantesNoMes } from "./brasilia";
import { lerValorDaConta } from "./contas";
import { doMes, type Lancamento } from "./dinheiro";
import type { MesFlush } from "./financeiro";

export type Metas = Record<string, number>;

/** A meta de faturamento da Flush no mês. */
export const META_FLUSH_MES = "flush-mes";
const PREFIXO = "limite:";
/** O limite do mês inteiro (todos os gastos). */
export const LIMITE_GERAL = `${PREFIXO}geral`;

const centavos = (v: number) => Math.round(v * 100);
const arred = (v: number) => Math.round(v * 100) / 100;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Retrato antigo ou corrompido: só fica chave com valor positivo. */
export function lerMetas(x: unknown): Metas {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const metas: Metas = {};
  for (const [k, v] of Object.entries(x)) if (typeof v === "number" && Number.isFinite(v) && v > 0) metas[k] = v;
  return metas;
}

/** Põe (valor > 0) ou tira (null) a chave. Devolve outro objeto. */
export function mudarMeta(metas: Metas, chave: string, valor: number | null): Metas {
  const novas = { ...metas };
  if (valor && valor > 0) novas[chave] = valor;
  else delete novas[chave];
  return novas;
}

// ——— Leitura do chat ———

/** "do mês", "geral", "de gastos": é o limite do mês inteiro. */
const GERAL = /^(?:(?:do|no|por|desse|deste|neste|nesse|ao|o)\s+)?m[eê]s$|^(?:geral|total|mensal|tudo|do m[eê]s todo)$/i;
const LIGACAO = /^(?:do|da|de|dos|das|no|na|nos|nas|pro|pra|para o|para a|para|com|em|o|a)\s+/i;

/** O nome do limite como ele falou: null = geral; undefined = não dá para ser nome. */
function nomeDoLimite(bruto: string): string | null | undefined {
  let nome = bruto.trim().replace(/^[:,-]\s*/, "").replace(/\s*[:,=-]$/, "").trim();
  nome = nome.replace(/^de\s+gastos?\b\s*/i, "").replace(/^gastos?\b\s*/i, "");
  if (!nome || GERAL.test(nome)) return null;
  nome = nome.replace(LIGACAO, "").replace(/\s+(?:do|no|por|ao|neste|nesse|deste|desse)\s+m[eê]s$/i, "").replace(/^["“”']+|["“”']+$/g, "").trim();
  if (!nome || GERAL.test(nome)) return null;
  if (/\d/.test(nome) || nome.length > 30 || nome.split(" ").length > 4) return undefined;
  return nome.toLowerCase();
}

export interface LimiteLido {
  /** Como ele falou, em minúsculas ("mercado"). null = o limite geral do mês. */
  categoria: string | null;
  valor: number;
}

/**
 * "limite mercado 800" · "limite do mercado: R$ 800" · "limite de gasto com uber 200" ·
 * "limite do mês 3000" · "limite geral 3 mil" · "limite mercado 800 por mês".
 */
export function lerLimite(frase: string): LimiteLido | null {
  const t = frase.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  const m = t.match(/^(?:(?:defin[ae]r?|coloc[ae]r?|bot[ae]r?|p[oõ]e|cri[ae]r?|novo|meu|o)\s+(?:o\s+|um\s+)?)?limite\b\s*(.*)$/i);
  if (!m) return null;
  const corpo = m[1].replace(/\s+(?:por|ao|no|todo)\s+m[eê]s$/i, "").replace(/\s+mensal$/i, "");
  const v = corpo.match(/^(?:(.*?)(?:\s*[:=-]\s*|\s+))?(?:(?:é|e|de|em|fica(?:r)?|vai ser)\s+)?((?:r\$\s*)?\d[\d.]*(?:,\d{1,2})?(?:\s*(?:mil|k))?(?:\s*(?:reais|real|conto|contos|pila|pilas))?)$/i);
  if (!v) return null;
  const valor = lerValorDaConta(v[2]);
  if (!valor) return null;
  const categoria = nomeDoLimite(v[1] ?? "");
  if (categoria === undefined) return null;
  return { categoria, valor };
}

export type TirarLido = { tipo: "meta" } | { tipo: "limite"; categoria: string | null };

/** "tirar meta da flush" · "tira a meta" · "tirar limite mercado" · "remove o limite do mês". */
export function lerTirar(frase: string): TirarLido | null {
  const t = frase.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  const m = t.match(/^(?:tir[ae]r?|remov[ae]r?|apag[ae]r?|exclu[ia]r?|delet[ae]r?|cancel[ae]r?|sem)\s+(?:(?:a|o|minha|meu)\s+){0,2}(meta|limite)\b\s*(.*)$/i);
  if (!m) return null;
  const resto = m[2].trim();
  if (m[1].toLowerCase() === "meta") {
    const n = normalizar(resto);
    return /^(?:(?:da|de|do|das) )?(?:flush|vendas?|faturamento|mes)?(?: (?:da|de|do) (?:flush|mes))?$/.test(n) ? { tipo: "meta" } : null;
  }
  const categoria = nomeDoLimite(resto);
  return categoria === undefined ? null : { tipo: "limite", categoria };
}

// ——— Limites ———

/** A chave do limite: reaproveita a que já existe com o mesmo nome ("Mercado" = "mercado"). */
export function chaveDoLimite(metas: Metas, categoria: string | null): string {
  if (categoria === null) return LIMITE_GERAL;
  const alvo = normalizar(categoria);
  if (alvo === "geral") return LIMITE_GERAL;
  return Object.keys(metas).find((k) => k.startsWith(PREFIXO) && normalizar(k.slice(PREFIXO.length)) === alvo) ?? `${PREFIXO}${categoria.toLowerCase()}`;
}

export type EstadoDoLimite = "dentro" | "perto" | "passou";

export interface LimiteNoMes {
  chave: string;
  /** null = geral. */
  categoria: string | null;
  rotulo: string;
  limite: number;
  gasto: number;
  /** gasto / limite (passa de 1 quando passou). */
  parte: number;
  estado: EstadoDoLimite;
  /** Quanto ainda cabe (0 quando passou). */
  sobra: number;
  /** Quanto passou (0 quando está dentro). */
  excesso: number;
}

/** Perto a partir de 80% do limite; passou quando o gasto fica acima do valor. */
export function estadoDoLimite(gasto: number, limite: number): EstadoDoLimite {
  if (centavos(gasto) > centavos(limite)) return "passou";
  return centavos(gasto) >= centavos(limite) * 0.8 ? "perto" : "dentro";
}

/** O gasto bate com o limite quando a categoria é a mesma ou começa com ela ("mercado do bairro" conta em "mercado"). */
const daCategoria = (l: Lancamento, alvo: string) => l.categoria === alvo || l.categoria.startsWith(`${alvo} `);

/** Os limites definidos, com o gasto real do mês (Brasília). O geral vem primeiro; o resto, pelo nome. */
export function limitesDoMes(metas: Metas, lancamentos: readonly Lancamento[], agora = new Date()): LimiteNoMes[] {
  const gastos = doMes(lancamentos, agora).filter((l) => l.tipo === "gasto");
  const itens: LimiteNoMes[] = [];
  for (const [chave, limite] of Object.entries(metas)) {
    if (!chave.startsWith(PREFIXO) || !(limite > 0)) continue;
    const geral = chave === LIMITE_GERAL;
    const nome = chave.slice(PREFIXO.length);
    const alvo = normalizar(nome);
    const c = gastos.filter((l) => geral || daCategoria(l, alvo)).reduce((s, l) => s + centavos(l.valor), 0);
    const gasto = c / 100;
    itens.push({
      chave,
      categoria: geral ? null : nome,
      rotulo: geral ? "Geral" : maiuscula(nome),
      limite,
      gasto,
      parte: gasto / limite,
      estado: estadoDoLimite(gasto, limite),
      sobra: Math.max(0, (centavos(limite) - c) / 100),
      excesso: Math.max(0, (c - centavos(limite)) / 100),
    });
  }
  return itens.sort((a, b) => (a.categoria === null ? -1 : b.categoria === null ? 1 : a.rotulo.localeCompare(b.rotulo, "pt-BR")));
}

export const passaram = (limites: readonly LimiteNoMes[]) => limites.filter((l) => l.estado === "passou");

/** A linha do "o que pede atenção": "Mercado passou R$ 50" · "Mercado e Geral passaram do limite". */
export function textoDosEstourados(estourados: readonly LimiteNoMes[]): string {
  if (estourados.length === 1) return `${estourados[0].rotulo} passou ${reais(estourados[0].excesso)}`;
  const nomes = estourados.map((l) => l.rotulo);
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]} passaram do limite`;
}

// ——— Meta da Flush ———

export interface ProgressoDaMeta {
  meta: number;
  faturado: number;
  /** 0 a 1 (passa de 1 quando bate). */
  feito: number;
  falta: number;
  /** Dias que restam no mês, hoje incluso (Brasília). */
  diasRestantes: number;
  /** Quanto precisa por dia, nos dias que restam, para bater. null quando já bateu. */
  porDia: number | null;
  batida: boolean;
}

export function progressoDaMeta(meta: number, faturado: number, agora = new Date()): ProgressoDaMeta {
  const falta = Math.max(0, arred(meta - faturado));
  const restam = diasRestantesNoMes(agora);
  return {
    meta,
    faturado,
    feito: meta > 0 ? faturado / meta : 0,
    falta,
    diasRestantes: restam,
    porDia: falta > 0 ? arred(falta / restam) : null,
    batida: falta === 0,
  };
}

// ——— Chat ———

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** O mês da Flush como as metas enxergam: o mês lido, "carregando" ou null (sem leitura). */
export type MesParaMeta = MesFlush | "carregando" | null;

function linhaDaFlush(meta: number, mes: MesParaMeta, agora: Date): string {
  if (mes === "carregando") return `Flush: meta de ${reais(meta)}. Estou lendo as vendas; pergunte de novo em instantes.`;
  if (!mes) return `Flush: meta de ${reais(meta)}. Falta a leitura da Flush para ver o progresso.`;
  const p = progressoDaMeta(meta, mes.atual.valor, agora);
  if (p.batida) return `Flush: meta de ${reais(meta)} batida, com ${reais(p.faturado)} em ${mes.nome}.`;
  const dias = p.diasRestantes === 1 ? "só hoje" : `${p.diasRestantes} dias`;
  return `Flush: ${reais(p.faturado)} de ${reais(meta)} (${pct(p.feito)}). Faltam ${reais(p.falta)}: ${reais(p.porDia!)} por dia em ${dias}.`;
}

function linhaDoLimite(l: LimiteNoMes): string {
  const base = `• ${l.rotulo}: ${reais(l.gasto)} de ${reais(l.limite)}`;
  if (l.estado === "passou") return `${base}, passou ${reais(l.excesso)}`;
  return `${base} (${pct(l.parte)}${l.estado === "perto" ? ", perto" : ""})`;
}

/** "como estão as metas?". Sem meta nem limite, diz como criar. */
export function responderMetas(metas: Metas, mes: MesParaMeta, lancamentos: readonly Lancamento[], agora = new Date()): string {
  const meta = metas[META_FLUSH_MES] ?? null;
  const limites = limitesDoMes(metas, lancamentos, agora);
  if (!meta && !limites.length) return "Você ainda não tem meta nem limite. Diga “meta da flush 20 mil” ou “limite mercado 800”.";
  const partes: string[] = [];
  if (meta) partes.push(linhaDaFlush(meta, mes, agora));
  if (limites.length) partes.push(`Limites do mês:\n${limites.map(linhaDoLimite).join("\n")}`);
  return partes.join("\n\n");
}

/** A confirmação de "limite mercado 800": já diz como está o mês. */
export function confirmarLimite(chave: string, metas: Metas, lancamentos: readonly Lancamento[], antes: number | null, agora = new Date()): string {
  const l = limitesDoMes(metas, lancamentos, agora).find((x) => x.chave === chave);
  if (!l) return "Não consegui guardar esse limite.";
  const nome = l.categoria === null ? "Limite do mês" : `Limite de ${l.rotulo.toLowerCase()}`;
  const troca = antes && antes !== l.limite ? ` (era ${reais(antes)})` : "";
  const agoraNoMes = l.estado === "passou" ? `já passou ${reais(l.excesso)}` : `gastou ${reais(l.gasto)} até agora`;
  return `${nome}: ${reais(l.limite)}${troca}. Neste mês ${agoraNoMes}. Está em Vida.`;
}

/** "Limite de mercado" · "Limite do mês": para a resposta do "tirar". */
export function nomeDoLimiteNaFrase(chave: string): string {
  return chave === LIMITE_GERAL ? "o limite do mês" : `o limite de ${chave.slice(PREFIXO.length)}`;
}

// ——— Desfazer ———

/** Chave → carimbo da última mudança. Só a mudança mais recente de cada chave pode ser desfeita. */
export type Carimbos = Record<string, string>;

/** Uma mudança de meta ou limite, com identidade própria (o `carimbo`). */
export interface MudancaDeMeta {
  chave: string;
  antes: number | null;
  depois: number | null;
  carimbo: string;
}

/** Aplica a mudança e passa a ser a mais recente da chave (vale para chat, tela e o próprio desfazer). */
export function registrarMudanca(metas: Metas, carimbos: Carimbos, chave: string, valor: number | null, carimbo: string): { metas: Metas; carimbos: Carimbos; mudanca: MudancaDeMeta } {
  const depois = valor && valor > 0 ? valor : null;
  return {
    metas: mudarMeta(metas, chave, depois),
    carimbos: { ...carimbos, [chave]: carimbo },
    mudanca: { chave, antes: metas[chave] ?? null, depois, carimbo },
  };
}

/** Só a mais recente da chave: um valor que se repete não reativa uma mudança antiga. */
export const podeDesfazer = (m: MudancaDeMeta, carimbos: Carimbos) => carimbos[m.chave] === m.carimbo;

/** Volta a chave para `antes`. A volta é uma mudança nova (não dá para desfazer duas vezes). null quando não é a mais recente. */
export function desfazerMudanca(metas: Metas, carimbos: Carimbos, m: MudancaDeMeta, carimbo: string): { metas: Metas; carimbos: Carimbos } | null {
  if (!podeDesfazer(m, carimbos)) return null;
  const r = registrarMudanca(metas, carimbos, m.chave, m.antes, carimbo);
  return { metas: r.metas, carimbos: r.carimbos };
}
