/**
 * Contas do mês: as contas fixas do Rapha (luz, internet, aluguel) e se já foram pagas.
 * Só anota o que ele contou; pagar aqui não move dinheiro, só marca e lança o gasto
 * (nível B: automático com desfazer). Funções puras: desfazer é voltar à lista anterior.
 * O mês e o "hoje" são sempre os de Brasília.
 */
import { lerValor } from "./financeiro";
import { acharPorTexto, normalizar } from "./fala";
import { diaEmBrasilia, mesEmBrasilia } from "./brasilia";

export interface PagamentoDeConta {
  /** "AAAA-MM": o mês que este pagamento quita. */
  mes: string;
  /** ISO do momento em que marcou paga. */
  em: string;
  /** Quanto pagou (o valor da conta ou o que ele disse). `null` = pagou sem dizer quanto. */
  valor: number | null;
  /** O gasto lançado no dinheiro por este pagamento. Sem valor, não há lançamento. */
  lancamento: string | null;
}

export interface Conta {
  id: string;
  nome: string;
  /** Dia do vencimento, 1 a 31. Mês curto vence no último dia. */
  dia: number;
  /** Em reais. `null` quando ele não disse quanto é. */
  valor: number | null;
  ativa: boolean;
  criadaEm: string;
  pagamentos: PagamentoDeConta[];
}

export type ContaLida = Pick<Conta, "nome" | "dia" | "valor">;

const limparNome = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^["“”']+|["“”'.,;:!?-]+$/g, "").trim();
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "200 reais", "R$ 99,90", "1.500", "99.90", "de 200" → reais. Qualquer outra coisa: null. */
export function lerValorDaConta(texto: string): number | null {
  const t = texto
    .trim()
    .replace(/^(?:,|-|:)\s*/, "")
    .replace(/^(?:(?:no )?valor(?: de)?|de|por|custa|é|e)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .replace(/\s*(?:reais|real|conto|contos|pila|pilas)$/i, "")
    .replace(/^r\$\s*/i, "")
    .trim();
  if (!/^\d[\d.]*(?:,\d{1,2})?(?:\s*(?:mil|k))?$/i.test(t)) return null;
  const sem = /^\d+\.\d{1,2}$/.test(t) ? t.replace(".", ",") : t;
  return lerValor(sem.replace(/\s*k$/i, " mil"));
}

// "conta de luz todo dia 10, 200 reais" · "nova conta: internet dia 15 R$ 99,90" · "aluguel dia 5 1.500" · "luz vence dia 10"
const CONTA = /^(?:(?:nova|cadastr[ae](?:r)?(?: a| uma)?|adiciona(?:r)?(?: a| uma)?|cri[ae](?:r)?(?: a| uma)?)\s+)?(conta(?:\s+fixa)?\s*[:,-]?\s+(?:de\s+|do\s+|da\s+)?)?(.+?)\s*,?\s+(?:que\s+)?(?:vence\s+|vencimento\s+)?(?:(?:todo|cada)\s+)?dia\s+(\d{1,2})(?:\s+(?:de\s+)?(?:todo|cada)\s+m[eê]s)?(?:\s*(.*))?$/i;

/**
 * Frase de cadastro de conta. Para não confundir com outra coisa ("reunião dia 10"),
 * só vale quando a frase diz "conta" ou traz um valor no fim.
 */
export function lerConta(frase: string): ContaLida | null {
  const t = frase.trim().replace(/\s+/g, " ");
  const m = t.match(CONTA);
  if (!m) return null;
  const [, prefixo, nomeBruto, diaBruto, resto = ""] = m;
  const dia = Number(diaBruto);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null;
  const nome = limparNome(nomeBruto);
  if (!nome || nome.length > 40 || nome.split(" ").length > 5 || /\d/.test(nome)) return null;
  const sobra = resto.trim();
  const valor = sobra ? lerValorDaConta(sobra) : null;
  if (sobra && valor === null) return null;
  if (!prefixo && valor === null) return null;
  return { nome: maiuscula(nome), dia, valor };
}

let seq = 0;
export function novaConta(c: ContaLida, agora = new Date()): Conta {
  return { id: `c${agora.getTime().toString(36)}-${++seq}`, nome: maiuscula(limparNome(c.nome)), dia: c.dia, valor: c.valor, ativa: true, criadaEm: agora.toISOString(), pagamentos: [] };
}

export const mesmaConta = (a: string, b: string) => normalizar(a) === normalizar(b);

/** Não duplica pelo nome ("Luz" e "luz" são a mesma conta). */
export function adicionarConta(lista: readonly Conta[], c: Conta): Conta[] {
  if (!c.nome || lista.some((x) => x.id === c.id || mesmaConta(x.nome, c.nome))) return [...lista];
  return [...lista, c];
}

export function removerConta(lista: readonly Conta[], id: string): Conta[] {
  return lista.filter((c) => c.id !== id);
}

/** Troca a conta pelo mesmo id (editar e desfazer a edição usam isto). */
export function substituirConta(lista: readonly Conta[], c: Conta): Conta[] {
  return lista.map((x) => (x.id === c.id ? c : x));
}

export type MudancaDeConta = Partial<Pick<Conta, "nome" | "dia" | "valor" | "ativa">>;

export function editarConta(lista: readonly Conta[], id: string, m: MudancaDeConta): Conta[] {
  return lista.map((c) => {
    if (c.id !== id) return c;
    const nome = m.nome !== undefined ? maiuscula(limparNome(m.nome)) || c.nome : c.nome;
    const dia = m.dia !== undefined && Number.isInteger(m.dia) && m.dia >= 1 && m.dia <= 31 ? m.dia : c.dia;
    const valor = m.valor !== undefined ? (m.valor && m.valor > 0 ? m.valor : null) : c.valor;
    return { ...c, nome, dia, valor, ativa: m.ativa ?? c.ativa };
  });
}

/** "2026-02" → 28; "2028-02" → 29. */
export function diasNoMes(mes: string): number {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** "AAAA-MM-DD" do vencimento no mês: dia 31 em setembro vence dia 30. */
export function vencimentoNoMes(c: Pick<Conta, "dia">, mes: string): string {
  return `${mes}-${String(Math.min(c.dia, diasNoMes(mes))).padStart(2, "0")}`;
}

export const pagamentoDoMes = (c: Conta, mes: string) => c.pagamentos.find((p) => p.mes === mes) ?? null;

export type EstadoDaConta = "paga" | "hoje" | "futura" | "atrasada";

export interface ContaNoMes {
  conta: Conta;
  vence: string;
  estado: EstadoDaConta;
  /** Dias até vencer (futura) ou desde que venceu (atrasada); 0 nos outros. */
  dias: number;
  pagamento: PagamentoDeConta | null;
  /** O que conta no total do mês: o que pagou ou, sem pagamento, o valor cadastrado. */
  valor: number | null;
}

const diff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);

export function situacao(c: Conta, agora: Date | string = new Date()): ContaNoMes {
  const hoje = diaEmBrasilia(agora);
  const mes = hoje.slice(0, 7);
  const vence = vencimentoNoMes(c, mes);
  const pagamento = pagamentoDoMes(c, mes);
  const valor = pagamento ? pagamento.valor ?? c.valor : c.valor;
  if (pagamento) return { conta: c, vence, estado: "paga", dias: 0, pagamento, valor };
  const d = diff(vence, hoje);
  return { conta: c, vence, estado: d === 0 ? "hoje" : d > 0 ? "futura" : "atrasada", dias: Math.abs(d), pagamento: null, valor };
}

/** As contas do mês corrente (Brasília), por vencimento. Pausada só entra se já foi paga no mês. */
export function contasDoMes(lista: readonly Conta[], agora: Date | string = new Date()): ContaNoMes[] {
  const mes = mesEmBrasilia(agora);
  return lista
    .filter((c) => c.ativa || pagamentoDoMes(c, mes))
    .map((c) => situacao(c, agora))
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.conta.nome.localeCompare(b.conta.nome));
}

export interface TotaisDoMes { total: number; pago: number; falta: number; semValor: number; abertas: number }

const centavos = (v: number) => Math.round(v * 100);

/** Total do mês, quanto já foi pago e quanto falta (em centavos por dentro). Conta sem valor só é contada. */
export function totaisDoMes(itens: readonly ContaNoMes[]): TotaisDoMes {
  let pago = 0;
  let falta = 0;
  let semValor = 0;
  let abertas = 0;
  for (const i of itens) {
    if (i.estado !== "paga") abertas += 1;
    if (i.valor === null) {
      semValor += 1;
      continue;
    }
    if (i.estado === "paga") pago += centavos(i.valor);
    else falta += centavos(i.valor);
  }
  return { total: (pago + falta) / 100, pago: pago / 100, falta: falta / 100, semValor, abertas };
}

/** Marca paga no mês (não repete: se já tem pagamento no mês, fica como está). */
export function marcarPaga(lista: readonly Conta[], id: string, p: PagamentoDeConta): Conta[] {
  return lista.map((c) => (c.id === id && !pagamentoDoMes(c, p.mes) ? { ...c, pagamentos: [...c.pagamentos, p].sort((a, b) => a.mes.localeCompare(b.mes)) } : c));
}

export function desmarcarPaga(lista: readonly Conta[], id: string, mes: string): Conta[] {
  return lista.map((c) => (c.id === id ? { ...c, pagamentos: c.pagamentos.filter((p) => p.mes !== mes) } : c));
}

/** O lançamento sumiu do dinheiro: o pagamento que ele quitava volta a "a pagar". */
export function semLancamento(lista: readonly Conta[], lancamento: string): { contas: Conta[]; removidos: { conta: string; pagamento: PagamentoDeConta }[] } {
  const removidos: { conta: string; pagamento: PagamentoDeConta }[] = [];
  const contas = lista.map((c) => {
    const p = c.pagamentos.find((x) => x.lancamento === lancamento);
    if (!p) return c;
    removidos.push({ conta: c.id, pagamento: p });
    return { ...c, pagamentos: c.pagamentos.filter((x) => x !== p) };
  });
  return { contas: removidos.length ? contas : [...lista], removidos };
}

/**
 * "paguei a luz" · "paguei 200 de luz": a conta ativa e ainda não paga no mês que a frase
 * descreve. Empate ou nada parecido: null (aí não chuta, vira um gasto comum ou pergunta).
 */
export function contaParaPagar(lista: readonly Conta[], texto: string, agora: Date | string = new Date()): { achado: Conta } | { empate: Conta[] } | null {
  if (!texto.trim()) return null;
  const mes = mesEmBrasilia(agora);
  const abertas = lista.filter((c) => c.ativa && !pagamentoDoMes(c, mes));
  const tirado = texto.replace(/^(?:a|o|as|os)\s+conta\s+(?:de|do|da)\s+/i, "").replace(/^conta\s+(?:de|do|da)\s+/i, "");
  return acharPorTexto(abertas, tirado, (c) => c.nome);
}

/** "paguei a luz" · "paguei a conta de luz" (sem valor). O que vem depois do verbo. */
export function lerPagamentoDeConta(frase: string): string | null {
  const m = frase.trim().replace(/\s+/g, " ").match(/^(?:eu\s+)?(?:paguei|quitei)\s+(?:a\s+|o\s+|as\s+|os\s+)?(.+?)[.!?]*$/i);
  if (!m) return null;
  const alvo = m[1].trim();
  return alvo && !/\d/.test(alvo) ? alvo : null;
}

/** Retrato antigo ou corrompido: só entra conta com forma válida. */
export function lerContas(x: unknown): Conta[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (c): c is Conta =>
        !!c && typeof c === "object" && typeof c.id === "string" && typeof c.nome === "string" && !!c.nome &&
        Number.isInteger(c.dia) && c.dia >= 1 && c.dia <= 31 && (c.valor === null || (typeof c.valor === "number" && c.valor > 0 && Number.isFinite(c.valor))) &&
        typeof c.criadaEm === "string",
    )
    .map((c) => ({
      ...c,
      ativa: c.ativa !== false,
      pagamentos: Array.isArray(c.pagamentos)
        ? c.pagamentos.filter(
            (p: unknown): p is PagamentoDeConta =>
              !!p && typeof p === "object" && /^\d{4}-\d{2}$/.test((p as PagamentoDeConta).mes) && typeof (p as PagamentoDeConta).em === "string" &&
              ((p as PagamentoDeConta).valor === null || typeof (p as PagamentoDeConta).valor === "number") &&
              ((p as PagamentoDeConta).lancamento === null || typeof (p as PagamentoDeConta).lancamento === "string"),
          )
        : [],
    }));
}

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

const diaCurto = (dia: string) => Number(dia.slice(8, 10));

/** "Vence hoje" · "Vence amanhã" · "Vence em 5 dias" · "Atrasada há 2 dias" · "Paga". */
export function textoDoEstado(i: Pick<ContaNoMes, "estado" | "dias">): string {
  if (i.estado === "paga") return "Paga";
  if (i.estado === "hoje") return "Vence hoje";
  if (i.estado === "futura") return i.dias === 1 ? "Vence amanhã" : `Vence em ${i.dias} dias`;
  return i.dias === 1 ? "Atrasada há 1 dia" : `Atrasada há ${i.dias} dias`;
}

/** A confirmação do cadastro no chat. */
export function confirmarConta(c: Conta, agora: Date | string = new Date()): string {
  const s = situacao(c, agora);
  const quanto = c.valor === null ? "sem valor (diga quanto quando souber)" : reais(c.valor);
  return `Conta nova: ${c.nome}, todo dia ${c.dia}, ${quanto}. Neste mês: ${textoDoEstado(s).toLowerCase()}. Está em Vida.`;
}

/** "minhas contas" · "quais contas vencem?": o mês, com o que falta. */
export function responderContas(lista: readonly Conta[], agora: Date | string = new Date()): string {
  const itens = contasDoMes(lista, agora);
  if (!itens.length) return "Você ainda não tem conta fixa cadastrada. Diga “conta de luz todo dia 10, 200 reais” ou cadastre em Vida.";
  const t = totaisDoMes(itens);
  const mes = new Date(`${mesEmBrasilia(agora)}-15T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long" });
  const cabeca = t.abertas
    ? `Contas de ${mes}: ${reais(t.total)} no mês, faltam ${reais(t.falta)} (${t.abertas === 1 ? "1 conta" : `${t.abertas} contas`} a pagar).`
    : `Contas de ${mes}: todas pagas (${reais(t.total)}).`;
  const linhas = itens.map((i) => `• ${i.conta.nome}, dia ${diaCurto(i.vence)}: ${textoDoEstado(i).toLowerCase()}${i.valor !== null ? ` (${reais(i.valor)})` : ""}`);
  return [cabeca, ...linhas].join("\n");
}

/** A confirmação de "paguei a luz". */
export function confirmarPagamento(c: Conta, p: PagamentoDeConta, lista: readonly Conta[], agora: Date | string = new Date()): string {
  const t = totaisDoMes(contasDoMes(lista, agora));
  const gasto = p.lancamento && p.valor !== null ? ` Lancei o gasto de ${reais(p.valor)} no dinheiro.` : " Sem valor cadastrado, não lancei gasto; diga “paguei 200 de luz” da próxima vez.";
  const resto = t.abertas ? ` Falta pagar ${reais(t.falta)} neste mês.` : " Todas as contas do mês pagas.";
  return `${c.nome} paga.${gasto}${resto}`;
}
