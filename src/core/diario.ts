/**
 * Diário do dia: o Rapha conta como foi o dia em uma ou duas frases. Cada anotação guarda o
 * dia de Brasília em que nasceu, o horário e, só quando ele disse algo explícito ("dia 4",
 * "humor 3", "foi bom"), um humor de 1 a 5. Nada é deduzido além disso.
 * Funções puras, no jeito das metas: só a mudança mais recente (o `carimbo`) pode ser desfeita.
 */
import { normalizar } from "./fala";
import { diaEmBrasilia, horaEmBrasilia, horarioEmBrasilia, somarDias } from "./brasilia";

export interface Anotacao {
  id: string;
  /** Dia de Brasília ("AAAA-MM-DD") em que foi escrita. */
  dia: string;
  /** Instante (ISO). */
  em: string;
  texto: string;
  /** 1 a 5, só quando ele disse; null quando não disse. */
  humor: number | null;
}

/** O que a frase do chat (ou o campo de Vida) traz. */
export interface FraseDoDiario {
  texto: string;
  humor: number | null;
}

/** Depois das 20h de Brasília o Hoje lembra de anotar o dia. */
export const HORA_DE_ANOTAR = 20;
/** Uma ou duas frases: o campo e o chat cortam aqui. */
export const LIMITE_DO_TEXTO = 500;

const limpar = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^["“”']+|["“”']+$/g, "").replace(/[.!]+$/, "").trim();
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

let seq = 0;
export function novaAnotacao(f: FraseDoDiario, agora = new Date()): Anotacao {
  const texto = maiuscula(limpar(f.texto)).slice(0, LIMITE_DO_TEXTO);
  const humor = f.humor !== null && Number.isInteger(f.humor) && f.humor >= 1 && f.humor <= 5 ? f.humor : null;
  return { id: `d${agora.getTime().toString(36)}-${++seq}`, dia: diaEmBrasilia(agora), em: agora.toISOString(), texto, humor };
}

// ——— Humor ———

const MESES_FALADOS = String.raw`(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*`;
/** "dia 4" · "humor 3" · "humor: 3/5" · "dia nota 4". Não pega data ("dia 4 de novembro", "dia 15"). */
const HUMOR_NUMERO = new RegExp(String.raw`\b(?:humor|dia)(?: (?:de|nota|e|foi))? ([1-5])(?: 5)?\b(?! (?:de )?${MESES_FALADOS}\b)(?! \d)`);
const HUMOR_PALAVRA: Record<string, number> = { otimo: 5, otima: 5, bom: 4, ok: 3, okay: 3, ruim: 2, pessimo: 1, pessima: 1 };
/** A parte da frase que é só a avaliação do dia: "hoje foi bom" · "dia ruim" · "foi um dia ótimo" · "me sinto ok". */
const CLAUSULA_DE_HUMOR = /^(?:(?:hoje|o dia|meu dia|o dia de hoje)\s+)?(?:(?:foi|esta|estou|tive|um|me sinto|sinto)\s+)*(?:dia\s+)?(?:muito\s+|bem\s+|super\s+)?(otimo|otima|bom|ok|okay|ruim|pessimo|pessima)(?:\s+dia)?$/;

/** O humor que ele disse, ou null. Número explícito vale mais que palavra; duas palavras diferentes = null. */
export function detectarHumor(texto: string): number | null {
  const n = normalizar(texto);
  const numero = n.match(HUMOR_NUMERO);
  if (numero) return Number(numero[1]);
  const achados = new Set<number>();
  for (const parte of texto.split(/[,;.!?\n]|\s+[-–—]\s+|\s+e\s+(?=(?:o dia|hoje|meu dia|foi|me sinto)\b)/i)) {
    const m = normalizar(parte).match(CLAUSULA_DE_HUMOR);
    if (m) achados.add(HUMOR_PALAVRA[m[1]]);
  }
  return achados.size === 1 ? [...achados][0] : null;
}

// ——— Leitura do chat ———

const SEPARADOR = String.raw`\s*[:–—-]\s*`;
const EXPLICITO = new RegExp(
  String.raw`^(?:(?:anot[ae]r?|escrev[ae]r?|coloc[ae]r?|p[oõ]e|registr[ae]r?)\s+(?:isso\s+)?(?:no|pro|para\s+o)\s+)?(?:(?:meu|o)\s+)?di[aá]rio(?:\s+(?:de\s+hoje|do\s+dia))?${SEPARADOR}(.+)$|^nota\s+(?:do\s+dia|de\s+hoje)${SEPARADOR}(.+)$`,
  "i",
);
const SINTO = /^como\s+(?:eu\s+)?me\s+sinto(?:\s+hoje)?\s*[:–—-]?\s*(.+)$/i;
const DIA_FOI = /^(?:hoje|o\s+dia(?:\s+de\s+hoje)?|meu\s+dia(?:\s+de\s+hoje)?)\s+(?:foi|t[aá]\s+sendo|est[aá]\s+sendo)\s+(.+)$/i;
const PERGUNTA = /^(?:quanto|quantos|quantas|qual|quais|como|onde|quando|quem|que|o\s+que|por\s*que)\b/i;

/**
 * "diário: dia puxado, fechei 3 pedidos" · "nota do dia: …" · "como me sinto: cansado" ·
 * "hoje foi bom". Pergunta ("hoje foi bom o jogo?", "como me sinto?") não grava nada.
 */
export function lerFraseDoDiario(frase: string): FraseDoDiario | null {
  const t = frase.trim().replace(/\s+/g, " ");
  const explicito = t.match(EXPLICITO);
  if (explicito) {
    // Com "diário:" na frente é anotação mesmo se terminar em "?": ele está escrevendo, não perguntando.
    const texto = limpar(explicito[1] ?? explicito[2] ?? "");
    return texto ? { texto, humor: detectarHumor(texto) } : null;
  }
  if (t.includes("?")) return null;
  const sinto = t.match(SINTO);
  if (sinto) {
    const resto = limpar(sinto[1]);
    // "como me sinto hoje" sem descrição: o "hoje" opcional recua e vira o texto.
    if (!resto || /^hoje$/i.test(resto) || PERGUNTA.test(resto)) return null;
    const texto = `Me sinto ${resto}`;
    return { texto, humor: detectarHumor(texto) };
  }
  const foi = t.match(DIA_FOI);
  if (foi) {
    const resto = limpar(foi[1]);
    if (!resto || PERGUNTA.test(resto)) return null;
    const texto = limpar(t);
    return { texto, humor: detectarHumor(texto) };
  }
  return null;
}

/** "hoje" · "ontem" · "anteontem" · "semana" · 0 a 6 (domingo a sábado: o último que passou, hoje incluso). */
export type QuandoDiario = "hoje" | "ontem" | "anteontem" | "semana" | number;

const DIAS_DA_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DOW = String.raw`(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?: feira)?(?: passad[ao])?`;
const QUANDO = String.raw`(?:(?:de|em|na|no|nessa|nesta|essa|esta|da|desta|dessa|a|o|ultima|ultimo) )*(?:(hoje|ontem|anteontem)|(semana|ultimos 7 dias|7 dias)|${DOW})`;
const ANOTEI = new RegExp(String.raw`^(?:e )?(?:o que )?(?:eu )?(?:anotei|escrevi)(?: no (?:meu )?diario)? ${QUANDO}$`);
const DIARIO_DE = new RegExp(String.raw`^(?:e )?(?:o |meu |o meu )?diario(?: ${QUANDO})?$`);
const COMO_FOI = new RegExp(String.raw`^(?:e )?como (?:foi|estava|tava|esteve) (?:o dia )?(?:(?:de|a|o|na|no|essa|esta|ultima|ultimo) )*(?:(hoje|ontem|anteontem)|${DOW})$`);

function quandoDe(dia?: string, semana?: string, dow?: string): QuandoDiario | null {
  if (dia) return dia as QuandoDiario;
  if (semana) return "semana";
  if (dow) return DIAS_DA_SEMANA.indexOf(dow);
  return null;
}

/** "o que anotei ontem?" · "meu diário da semana" · "como foi terça?" · "diário de hoje". */
export function lerConsultaDoDiario(frase: string): QuandoDiario | null {
  const n = normalizar(frase);
  const a = n.match(ANOTEI);
  if (a) return quandoDe(a[1], a[2], a[3]);
  const d = n.match(DIARIO_DE);
  if (d) return quandoDe(d[1], d[2], d[3]) ?? "semana";
  const c = n.match(COMO_FOI);
  if (c) return quandoDe(c[1], undefined, c[2]);
  return null;
}

// ——— Lista ———

const ordem = (a: Anotacao, b: Anotacao) => a.em.localeCompare(b.em);

export function doDia(lista: readonly Anotacao[], dia: string): Anotacao[] {
  return lista.filter((a) => a.dia === dia).sort(ordem);
}

/** O humor do dia: o último que ele disse naquele dia (ele pode mudar de ideia à noite). */
export function humorDoDia(doDia: readonly Anotacao[]): number | null {
  for (let i = doDia.length - 1; i >= 0; i--) if (doDia[i].humor !== null) return doDia[i].humor;
  return null;
}

export interface DiaAnotado {
  dia: string;
  anotacoes: Anotacao[];
  humor: number | null;
}

/** Os dias com anotação antes de `hoje`, do mais recente para trás, até `n` dias. */
export function diasAnotadosAntes(lista: readonly Anotacao[], hoje: string, n = 7): DiaAnotado[] {
  const dias = [...new Set(lista.filter((a) => a.dia < hoje).map((a) => a.dia))].sort().reverse().slice(0, n);
  return dias.map((dia) => {
    const anotacoes = doDia(lista, dia);
    return { dia, anotacoes, humor: humorDoDia(anotacoes) };
  });
}

/** O dia de uma consulta ("ontem", terça…), em Brasília. */
export function diaDaConsulta(q: Exclude<QuandoDiario, "semana">, agora = new Date()): string {
  const hoje = diaEmBrasilia(agora);
  if (q === "hoje") return hoje;
  if (q === "ontem") return somarDias(hoje, -1);
  if (q === "anteontem") return somarDias(hoje, -2);
  const atual = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  return somarDias(hoje, -((atual - q + 7) % 7));
}

export interface SemanaDoDiario {
  /** Dias com anotação nos 7 dias de Brasília que terminam hoje. */
  dias: number;
  /** Média do humor dos dias que têm humor; null sem nenhum. */
  humorMedio: number | null;
  /** Quantos dias entraram na média. */
  diasComHumor: number;
}

export function semanaDoDiario(lista: readonly Anotacao[], agora = new Date()): SemanaDoDiario {
  const hoje = diaEmBrasilia(agora);
  let dias = 0;
  const humores: number[] = [];
  for (let i = 0; i < 7; i++) {
    const doDiaI = doDia(lista, somarDias(hoje, -i));
    if (!doDiaI.length) continue;
    dias += 1;
    const h = humorDoDia(doDiaI);
    if (h !== null) humores.push(h);
  }
  return { dias, humorMedio: humores.length ? Math.round((humores.reduce((s, h) => s + h, 0) / humores.length) * 10) / 10 : null, diasComHumor: humores.length };
}

/** A regra do Hoje: depois das 20h de Brasília, sem anotação no dia. */
export function precisaAnotar(lista: readonly Anotacao[], agora = new Date()): boolean {
  if (horaEmBrasilia(agora) < HORA_DE_ANOTAR) return false;
  const hoje = diaEmBrasilia(agora);
  return !lista.some((a) => a.dia === hoje);
}

/** Retrato antigo ou corrompido: só entra anotação com forma válida. */
export function lerAnotacoes(x: unknown): Anotacao[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((a): a is Anotacao => !!a && typeof a === "object" && typeof a.id === "string" && typeof a.texto === "string" && !!a.texto.trim() && typeof a.em === "string" && !Number.isNaN(Date.parse(a.em)))
    .map((a) => ({
      id: a.id,
      em: a.em,
      dia: typeof a.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.dia) ? a.dia : diaEmBrasilia(a.em),
      texto: a.texto,
      humor: typeof a.humor === "number" && Number.isInteger(a.humor) && a.humor >= 1 && a.humor <= 5 ? a.humor : null,
    }))
    .sort(ordem);
}

// ——— Texto ———

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dow = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const diaMes = (dia: string) => `${Number(dia.slice(8, 10))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;

/** "sex, 23 out". */
export const dataCurta = (dia: string) => `${SEMANA_CURTA[dow(dia)]}, ${diaMes(dia)}`;
export const horario = (a: Anotacao) => horarioEmBrasilia(a.em);
export const textoDoHumor = (h: number) => `humor ${h}`;
/** "3,5" · "4". */
export const mediaDoHumor = (m: number) => m.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function nomeDoDia(dia: string, agora: Date): string {
  const hoje = diaEmBrasilia(agora);
  if (dia === hoje) return `Hoje (${diaMes(dia)})`;
  if (dia === somarDias(hoje, -1)) return `Ontem (${SEMANA_LONGA[dow(dia)]}, ${diaMes(dia)})`;
  const d = SEMANA_LONGA[dow(dia)];
  return `${maiuscula(d)} (${diaMes(dia)})`;
}

const linhas = (as: readonly Anotacao[]) => as.map((a) => `• ${horario(a)} · ${a.texto}`).join("\n");

/** "o que anotei ontem?" · "como foi terça?" · "meu diário da semana": só o que ele anotou. */
export function responderDiario(lista: readonly Anotacao[], q: QuandoDiario, agora = new Date()): string {
  if (q === "semana") {
    const hoje = diaEmBrasilia(agora);
    const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, -i)).filter((d) => lista.some((a) => a.dia === d)).reverse();
    if (!dias.length) return "Nada anotado nos últimos 7 dias. Diga “diário: …” para anotar o dia.";
    const s = semanaDoDiario(lista, agora);
    const blocos = dias.map((d) => {
      const as = doDia(lista, d);
      const h = humorDoDia(as);
      return `${maiuscula(dataCurta(d))}${h !== null ? ` · ${textoDoHumor(h)}` : ""}\n${linhas(as)}`;
    });
    const rodape = `${s.dias === 1 ? "1 dia anotado" : `${s.dias} dias anotados`} de 7${s.humorMedio !== null ? `, humor médio ${mediaDoHumor(s.humorMedio)}` : ""}.`;
    return `Seu diário, 7 dias:\n\n${blocos.join("\n\n")}\n\n${rodape}`;
  }
  const dia = diaDaConsulta(q, agora);
  const as = doDia(lista, dia);
  const nome = nomeDoDia(dia, agora);
  if (!as.length) return `Nada anotado: ${nome.charAt(0).toLowerCase()}${nome.slice(1)}.`;
  const h = humorDoDia(as);
  return `${nome}${h !== null ? ` · ${textoDoHumor(h)}` : ""}:\n${linhas(as)}`;
}

/** A resposta de "diário: …": o que guardou, a hora e o humor (só se ele disse). */
export function confirmarAnotacao(a: Anotacao, lista: readonly Anotacao[]): string {
  const n = lista.filter((x) => x.dia === a.dia).length;
  const humor = a.humor !== null ? ` ${maiuscula(textoDoHumor(a.humor))}.` : "";
  const quantas = n > 1 ? ` É a ${n}ª anotação de hoje.` : "";
  return `Anotei no diário, ${horario(a)}: “${a.texto}”.${humor}${quantas} Está em Vida.`;
}

// ——— Desfazer ———

/** Uma anotação nova, com identidade própria (o `carimbo`). */
export interface MudancaDoDiario {
  anotacao: Anotacao;
  carimbo: string;
}

/** Acrescenta (mais de uma no mesmo dia se acumula) e passa a ser a mudança mais recente do diário. */
export function anotar(lista: readonly Anotacao[], a: Anotacao, carimbo: string): { diario: Anotacao[]; carimbo: string; mudanca: MudancaDoDiario } {
  const diario = lista.some((x) => x.id === a.id) ? [...lista] : [...lista, a].sort(ordem);
  return { diario, carimbo, mudanca: { anotacao: a, carimbo } };
}

/** Só a mais recente: depois de outra anotação (ou de um desfazer), a antiga não volta mais. */
export const podeDesfazerDiario = (m: MudancaDoDiario, carimbo: string | null) => carimbo === m.carimbo;

/** Tira a anotação. A volta também é uma mudança (não dá para desfazer duas vezes). null quando não é a mais recente. */
export function desfazerAnotacao(lista: readonly Anotacao[], carimboAtual: string | null, m: MudancaDoDiario, novoCarimbo: string): { diario: Anotacao[]; carimbo: string } | null {
  if (!podeDesfazerDiario(m, carimboAtual)) return null;
  return { diario: lista.filter((a) => a.id !== m.anotacao.id), carimbo: novoCarimbo };
}
