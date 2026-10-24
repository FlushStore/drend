import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entender, opCriarQuadro } from "./core/comandos";
import { Mural, MuralError, type Op, type LogEntry } from "./core/mural";
import { VERSAO, repositorioLocal, type Repositorio, type Retrato } from "./core/persistencia";
import { baixar, maisRecente, subir, supabase, type Session } from "./core/nuvem";
import { tirarExemplos } from "./core/limpeza";
import { abertas, adicionar, concluir, novaTarefa, podar, reabrir, remover, type Tarefa } from "./core/tarefas";
import { acharPorTexto } from "./core/fala";
import { AJUDA, responderAgradecimento, responderMissao, responderPendencias, responderResumo, responderVendas, type LeituraFlush } from "./core/respostas";
import { lerEstado as lerFlush } from "./fontes/flush";
import { iniciarMissoes, lerMissoes, registrar } from "./fontes/missoes";
import { nomeDaMissao } from "./core/missao";
import { responderAgenda } from "./core/agenda";
import { eventosDa, iniciarAgenda, lerAgenda, motivoSemAgenda } from "./fontes/agenda";
import { responderProjetos, responderVault } from "./core/vault";
import { iniciarVault, lerVault, motivoSemVault, notasDo } from "./fontes/vault";
import { adicionarLancamento, confirmarLancamento, lerLancamentos, nomeDoLancamento, novoLancamento, removerLancamento, responderDinheiro, ultimos, type Lancamento } from "./core/dinheiro";
import { adicionarHabito, alternarDia, feitoNoDia, habitoParaConcluir, lerHabitos, marcarHoje, mesmoHabito, novoHabito, removerHabito, responderHabitos, sequencia, textoDaSequencia, type Habito } from "./core/habitos";
import { diaEmBrasilia, mesEmBrasilia } from "./core/brasilia";
import { adicionarConta, confirmarConta, confirmarPagamento, contaParaPagar, desmarcarPaga, editarConta as editarNaLista, lerContas, marcarPaga, mesmaConta, novaConta, pagamentoDoMes, removerConta, responderContas, semLancamento, substituirConta, type Conta, type ContaLida, type MudancaDeConta, type PagamentoDeConta } from "./core/contas";
import { responderSemana, semanaDaFlush, type SemanaFlush } from "./core/semana";
import type { ResumoFlush } from "./fontes/flush";

/** O vault como a conversa enxerga: o índice das notas, ou o motivo de não ter. */
function vaultDaConversa() {
  const e = lerVault();
  const notas = notasDo(e);
  return { notas, motivo: notas ? undefined : motivoSemVault(e) };
}

/** A agenda como a conversa enxerga: os eventos, ou o motivo de não ter. */
function agendaDaConversa() {
  const e = lerAgenda();
  const eventos = eventosDa(e);
  return { eventos, motivo: eventos ? undefined : motivoSemAgenda(e) };
}

/** A Flush como a conversa enxerga: só o resumo, nunca a sessão. */
function leituraDaFlush(): LeituraFlush {
  const e = lerFlush();
  if (e.fase === "fora") return null;
  if (e.fase === "carregando") return e;
  return e.resumo ? { fase: e.fase, dias: e.resumo.dias, historico: e.resumo.historico, atualizadoEm: e.resumo.atualizadoEm } : { fase: "erro", dias: [], atualizadoEm: "" };
}

/** A semana da Flush como a conversa enxerga: null sem a Flush ligada. */
function semanaDaConversa(): SemanaFlush | null | "carregando" {
  const e = lerFlush();
  if (e.fase === "fora") return null;
  if (e.fase === "carregando") return "carregando";
  const r: ResumoFlush | null = e.resumo;
  return r ? semanaDaFlush(r.historico, r.dias, r.produtos?.maisVendidos ?? null) : null;
}

export type Mensagem =
  | { id: string; de: "rapha"; texto: string }
  | { id: string; de: "drend"; status: "feito" | "proposto" | "falhou" | "pergunta" | "dica"; texto: string; ideia?: string; logId?: string; quadro?: string; lancamento?: string; pagamento?: { conta: string; mes: string } };

/** Banco: "sem-banco" quando o build não tem as chaves; "fora" sem login. */
export type Sincronia = "sem-banco" | "fora" | "sincronizando" | "ok" | "erro";

interface Store {
  sincronia: Sincronia;
  email: string | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  criarAcesso: (email: string, senha: string) => Promise<string | null>;
  sair: () => void;
  mural: Mural;
  versao: number;
  mensagens: Mensagem[];
  caixaDeEntrada: string[];
  executar: (op: Op, ator: LogEntry["actor"], resumo: string) => LogEntry;
  desfazer: () => LogEntry | undefined;
  falar: (texto: string) => void;
  guardarIdeia: (ideia: string, projeto: string) => void;
  tarefas: Tarefa[];
  criarTarefa: (texto: string) => void;
  concluirTarefa: (id: string) => void;
  reabrirTarefa: (id: string) => void;
  /** Metas em reais ("flush-mes"). Moram no retrato: vão para o banco junto com o resto. */
  metas: Record<string, number>;
  definirMeta: (chave: string, valor: number | null) => void;
  /** Dinheiro pessoal (Vida), contado pelo chat. Nível B: automático, com desfazer. */
  lancamentos: Lancamento[];
  apagarLancamento: (id: string) => void;
  restaurarLancamento: (l: Lancamento) => void;
  /** Hábitos (Vida). Nível B. */
  habitos: Habito[];
  criarHabito: (nome: string) => void;
  /** Marca/desmarca o dia; `dia` é o "hoje" que a tela mostra (padrão: hoje em Brasília). */
  alternarHabitoHoje: (id: string, dia?: string) => void;
  apagarHabito: (id: string) => void;
  restaurarHabito: (h: Habito) => void;
  /** Contas fixas do mês (Vida). Nível B: criar, pagar, editar e apagar, tudo com desfazer. */
  contas: Conta[];
  /** Devolve a conta criada, ou `null` se já existe uma com o mesmo nome. */
  criarConta: (c: ContaLida) => Conta | null;
  editarConta: (id: string, m: MudancaDeConta) => void;
  apagarConta: (id: string) => void;
  /** Volta a conta como estava (desfazer de editar ou de apagar). */
  restaurarConta: (c: Conta) => void;
  /** Marca paga no mês de agora e lança o gasto (quando tem valor). Devolve o pagamento para o desfazer. */
  pagarConta: (id: string) => PagamentoDeConta | null;
  /** Desmarca e tira o gasto que o pagamento lançou. Devolve o que tirou, para refazer. */
  desfazerPagamento: (id: string, mes: string) => { pagamento: PagamentoDeConta; lancamento: Lancamento | null } | null;
  restaurarPagamento: (id: string, p: PagamentoDeConta, l: Lancamento | null) => void;
}

export const META_FLUSH_MES = "flush-mes";

/** Quita a conta no mês de agora: com valor, o gasto nasce junto e fica vinculado. Já paga: nada muda. */
function pagarAgora(contas: readonly Conta[], cid: string, agora: Date): { contas: Conta[]; pagamento: PagamentoDeConta | null; lancamento: Lancamento | null } {
  const c = contas.find((x) => x.id === cid);
  const mes = mesEmBrasilia(agora);
  if (!c || pagamentoDoMes(c, mes)) return { contas: [...contas], pagamento: null, lancamento: null };
  const lancamento = c.valor ? novoLancamento({ tipo: "gasto", valor: c.valor, descricao: c.nome }, agora) : null;
  const pagamento: PagamentoDeConta = { mes, em: agora.toISOString(), valor: c.valor, lancamento: lancamento?.id ?? null };
  return { contas: marcarPaga(contas, cid, pagamento), pagamento, lancamento };
}

const Ctx = createContext<Store | null>(null);
const NOMES_PROJETO: Record<string, string> = { flushstore: "Flush", vida: "Vida", drend: "DREND" };
// Ids de mensagem únicos entre aberturas do app (as salvas voltam com os ids antigos).
let seq = 0;
const id = () => `m${Date.now().toString(36)}-${++seq}`;

const BOAS_VINDAS: Mensagem[] = [
  { id: "m-inicio", de: "drend", status: "dica", texto: "Fala comigo do seu jeito: “me lembra de…”, “o que tenho hoje?”, “quanto vendi hoje?”. Diga “ajuda” para ver tudo." },
];

export function StoreProvider({ children, repositorio }: { children: ReactNode; repositorio?: Repositorio<Mensagem> }) {
  const repo = useMemo(() => repositorio ?? repositorioLocal<Mensagem>(), [repositorio]);
  // Lido uma vez, na abertura: o que estava no aparelho volta como estava, desfazer incluso.
  const [salvo] = useState(() => repo.carregar());
  const muralRef = useRef<Mural | null>(null);
  if (!muralRef.current) {
    muralRef.current = salvo ? Mural.restaurar(salvo.mural) : new Mural();
    tirarExemplos(muralRef.current);
  }
  const mural = muralRef.current;
  const [versao, setVersao] = useState(0);
  const [caixaDeEntrada, setCaixa] = useState<string[]>(salvo?.caixaDeEntrada ?? []);
  const [mensagens, setMensagens] = useState<Mensagem[]>(salvo?.mensagens.length ? salvo.mensagens : BOAS_VINDAS);
  const [tarefas, setTarefas] = useState<Tarefa[]>(() => podar(salvo?.tarefas ?? []));
  const [metas, setMetas] = useState<Record<string, number>>(salvo?.metas ?? {});
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(() => lerLancamentos(salvo?.lancamentos));
  const [habitos, setHabitos] = useState<Habito[]>(() => lerHabitos(salvo?.habitos));
  const [contas, setContas] = useState<Conta[]>(() => lerContas(salvo?.contas));
  // O Desfazer de um aviso roda depois de outros toques: lê sempre a lista de agora, não a do toque.
  const contasAgora = useRef(contas);
  const lancamentosAgora = useRef(lancamentos);
  useEffect(() => {
    contasAgora.current = contas;
    lancamentosAgora.current = lancamentos;
  }, [contas, lancamentos]);

  useEffect(() => {
    repo.salvar({ mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens, tarefas, metas, lancamentos, habitos, contas });
  }, [repo, mural, versao, caixaDeEntrada, mensagens, tarefas, metas, lancamentos, habitos, contas]);

  // As missões ficam ouvindo desde a abertura: a conversa responde sem precisar abrir a tela.
  useEffect(iniciarMissoes, []);
  useEffect(iniciarAgenda, []);
  useEffect(iniciarVault, []);

  // Banco: ao entrar, a versão mais nova (aparelho ou banco) vence; depois cada mudança sobe em ~1 s.
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sincronia, setSincronia] = useState<Sincronia>(supabase ? "fora" : "sem-banco");
  const conciliado = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const usuario = sessao?.user.id;
  useEffect(() => {
    conciliado.current = false;
    if (!usuario) {
      if (supabase) setSincronia("fora");
      return;
    }
    let vivo = true;
    setSincronia("sincronizando");
    (async () => {
      try {
        const remoto = await baixar<Mensagem>();
        const local = repo.carregar();
        if (!vivo) return;
        if (maisRecente(local, remoto) === "remoto" && remoto) {
          muralRef.current = Mural.restaurar(remoto.mural);
          tirarExemplos(muralRef.current);
          setCaixa(remoto.caixaDeEntrada);
          setMensagens(remoto.mensagens.length ? remoto.mensagens : BOAS_VINDAS);
          setTarefas(podar(remoto.tarefas ?? []));
          setMetas(remoto.metas ?? {});
          setLancamentos(lerLancamentos(remoto.lancamentos));
          setHabitos(lerHabitos(remoto.habitos));
          setContas(lerContas(remoto.contas));
          setVersao((v) => v + 1);
        } else if (local) {
          await subir(local);
        }
        conciliado.current = true;
        if (vivo) setSincronia("ok");
      } catch {
        if (vivo) setSincronia("erro");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usuario, repo]);

  useEffect(() => {
    if (!usuario || !conciliado.current) return;
    const t = setTimeout(() => {
      const r: Retrato<Mensagem> = { v: VERSAO, salvoEm: new Date().toISOString(), mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens, tarefas, metas, lancamentos, habitos, contas };
      subir(r).then(() => setSincronia("ok"), () => setSincronia("erro"));
    }, 1000);
    return () => clearTimeout(t);
  }, [usuario, mural, versao, caixaDeEntrada, mensagens, tarefas, metas, lancamentos, habitos, contas]);

  const entrar = useCallback(async (email: string, senha: string) => {
    if (!supabase) return "O banco ainda não está ligado.";
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return error ? (error.message.includes("Invalid") ? "E-mail ou senha errados." : error.message) : null;
  }, []);

  const criarAcesso = useCallback(async (email: string, senha: string) => {
    if (!supabase) return "O banco ainda não está ligado.";
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: window.location.origin } });
    return error ? error.message : null;
  }, []);

  const sair = useCallback(() => {
    void supabase?.auth.signOut();
  }, []);

  const executar = useCallback((op: Op, ator: LogEntry["actor"], resumo: string) => {
    const e = mural.run(op, ator, resumo);
    setVersao((v) => v + 1);
    return e;
  }, [mural]);

  const desfazer = useCallback(() => {
    const e = mural.undo();
    if (e) setVersao((v) => v + 1);
    return e;
  }, [mural]);

  const falar = useCallback((texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    const lido = entender(limpo);
    // "paguei o fornecedor": sem conta do mês parecida, é o mesmo que "já paguei o fornecedor" (concluir).
    const cmd = lido?.tipo === "pagarConta" && !contaParaPagar(contas, lido.texto) ? { tipo: "concluir" as const, texto: lido.frase } : lido;
    /** Quita pelo chat: a resposta leva o Desfazer, que tira o pagamento e o gasto juntos. */
    const pagarPeloChat = (texto: string): Mensagem[] => {
      const r = contaParaPagar(contas, texto);
      if (!r) return [];
      if ("empate" in r) return [{ id: id(), de: "drend", status: "pergunta", texto: `Qual delas? ${r.empate.slice(0, 4).map((c) => `“${c.nome}”`).join(", ")}.` }];
      const { contas: depois, pagamento, lancamento } = pagarAgora(contas, r.achado.id, new Date());
      if (!pagamento) return [{ id: id(), de: "drend", status: "dica", texto: `${r.achado.nome} já estava paga neste mês.` }];
      if (lancamento) setLancamentos((ls) => adicionarLancamento(ls, lancamento));
      setContas(depois);
      return [{ id: id(), de: "drend", status: "feito", texto: confirmarPagamento(r.achado, pagamento, depois), lancamento: lancamento?.id, pagamento: { conta: r.achado.id, mes: pagamento.mes } }];
    };
    const contaDoJaPaguei = (texto: string) => texto.replace(/^(?:paguei|quitei)\s+(?:a |o |as |os )?/i, "");
    // As mensagens novas saem prontas daqui: o updater fica puro (o StrictMode roda ele duas vezes).
    const novas: Mensagem[] = [{ id: id(), de: "rapha", texto: limpo }];
    if (cmd?.tipo === "ideia") {
      setCaixa((c) => [...c, cmd.texto]);
      novas.push({ id: id(), de: "drend", status: "pergunta", texto: "Guardei na caixa de entrada. Em qual projeto eu salvo?", ideia: cmd.texto });
    } else if (cmd?.tipo === "criarQuadro") {
      try {
        const { op, board } = opCriarQuadro(mural.state, cmd);
        const n = cmd.cartoes.length;
        const e = mural.run(op, "drend", `Criou o quadro ${board.title} com ${n} ${n === 1 ? "cartão" : "cartões"}`);
        setVersao((v) => v + 1);
        novas.push({ id: id(), de: "drend", status: "feito", texto: `Criei “${board.title}” com ${n} ${n === 1 ? "cartão" : "cartões"}.`, logId: e.id, quadro: board.id });
      } catch (erro) {
        novas.push({ id: id(), de: "drend", status: "falhou", texto: erro instanceof MuralError ? `Não deu: ${erro.message}.` : "Não consegui criar o quadro." });
      }
    } else if (cmd?.tipo === "tarefa") {
      const t = novaTarefa(cmd.texto);
      const repetida = abertas(tarefas).find((x) => x.texto.toLowerCase() === t.texto.toLowerCase());
      setTarefas((l) => adicionar(l, t));
      novas.push(repetida
        ? { id: id(), de: "drend", status: "dica", texto: `“${repetida.texto}” já está na sua lista.` }
        : { id: id(), de: "drend", status: "feito", texto: `Anotei: “${t.texto}”. Está em Para você, no Hoje.` });
    } else if (cmd?.tipo === "lancamento") {
      // Nível B (dinheiro.anotar): grava na hora; o Desfazer da mensagem tira o lançamento.
      // "paguei 200 de luz": se casa com uma conta do mês ainda não paga, o mesmo gasto quita a conta (sem lançar duas vezes).
      const l = novoLancamento(cmd.lancamento);
      setLancamentos((ls) => adicionarLancamento(ls, l));
      const alvo = l.tipo === "gasto" && l.descricao && /^(?:eu\s+)?(?:paguei|quitei)\b/i.test(limpo) ? contaParaPagar(contas, l.descricao) : null;
      if (alvo && "achado" in alvo) {
        const p: PagamentoDeConta = { mes: mesEmBrasilia(new Date()), em: l.em, valor: l.valor, lancamento: l.id };
        setContas(marcarPaga(contas, alvo.achado.id, p));
        novas.push({ id: id(), de: "drend", status: "feito", texto: `${confirmarLancamento(l, [...lancamentos, l]).replace(/ Está em Vida\.$/, "")} ${alvo.achado.nome} ficou paga neste mês.`, lancamento: l.id, pagamento: { conta: alvo.achado.id, mes: p.mes } });
      } else {
        novas.push({ id: id(), de: "drend", status: "feito", texto: confirmarLancamento(l, [...lancamentos, l]), lancamento: l.id });
      }
    } else if (cmd?.tipo === "dinheiro") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderDinheiro(lancamentos) });
    } else if (cmd?.tipo === "apagarLancamento") {
      const [l] = ultimos(lancamentos, 1);
      if (l) setLancamentos((ls) => removerLancamento(ls, l.id));
      novas.push(l
        ? { id: id(), de: "drend", status: "feito", texto: `Apaguei o último lançamento: ${nomeDoLancamento(l).toLowerCase()}, ${l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.` }
        : { id: id(), de: "drend", status: "falhou", texto: "Não há lançamento para apagar." });
    } else if (cmd?.tipo === "novoHabito") {
      const h = novoHabito(cmd.nome);
      const repetido = habitos.find((x) => mesmoHabito(x.nome, h.nome));
      if (!repetido) setHabitos((hs) => adicionarHabito(hs, h));
      novas.push(repetido
        ? { id: id(), de: "drend", status: "dica", texto: `“${repetido.nome}” já é um hábito seu. Diga “fiz ${repetido.nome.toLowerCase()}” para marcar hoje.` }
        : { id: id(), de: "drend", status: "feito", texto: `Hábito novo: “${h.nome}”. Está em Vida; diga “fiz ${h.nome.toLowerCase()}” para marcar hoje.` });
    } else if (cmd?.tipo === "habitos") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderHabitos(habitos) });
    } else if (cmd?.tipo === "novaConta") {
      const c = novaConta(cmd.conta);
      const repetida = contas.find((x) => mesmaConta(x.nome, c.nome));
      if (!repetida) setContas((cs) => adicionarConta(cs, c));
      novas.push(repetida
        ? { id: id(), de: "drend", status: "dica", texto: `“${repetida.nome}” já é uma conta sua (dia ${repetida.dia}). Para mudar, toque nela em Vida.` }
        : { id: id(), de: "drend", status: "feito", texto: confirmarConta(c) });
    } else if (cmd?.tipo === "contas") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderContas(contas) });
    } else if (cmd?.tipo === "pagarConta") {
      novas.push(...pagarPeloChat(cmd.texto));
    } else if (cmd?.tipo === "concluir" && !cmd.tarefa && habitoParaConcluir(habitos, abertas(tarefas), cmd.texto)) {
      // "fiz academia": só vira hábito quando nenhuma tarefa aberta casa e a frase não disse "tarefa".
      const h = habitoParaConcluir(habitos, abertas(tarefas), cmd.texto)!;
      const ja = feitoNoDia(h, diaEmBrasilia(new Date()));
      if (!ja) setHabitos((hs) => marcarHoje(hs, h.id));
      const n = ja ? sequencia(h) : sequencia({ ...h, feitos: [...h.feitos, diaEmBrasilia(new Date())] });
      novas.push({ id: id(), de: "drend", status: ja ? "dica" : "feito", texto: ja ? `“${h.nome}” já estava marcado hoje. ${textoDaSequencia(n)}.` : `Marquei “${h.nome}” hoje. ${textoDaSequencia(n)}.` });
    } else if (cmd?.tipo === "concluir" && !cmd.tarefa && /^(?:paguei|quitei)\s/i.test(cmd.texto) && !acharPorTexto(abertas(tarefas), cmd.texto, (t) => t.texto) && contaParaPagar(contas, contaDoJaPaguei(cmd.texto))) {
      // "já paguei a luz": nenhuma tarefa aberta casa, mas uma conta do mês casa.
      novas.push(...pagarPeloChat(contaDoJaPaguei(cmd.texto)));
    } else if (cmd?.tipo === "concluir" || cmd?.tipo === "reabrir" || cmd?.tipo === "apagarTarefa") {
      // Concluir e apagar procuram nas abertas; reabrir, nas feitas. Empate vira pergunta, nunca chute.
      const base = cmd.tipo === "reabrir" ? tarefas.filter((t) => t.feitaEm) : abertas(tarefas);
      const r = acharPorTexto(base, cmd.texto, (t) => t.texto);
      if (!r) {
        novas.push({ id: id(), de: "drend", status: "falhou", texto: cmd.tipo === "reabrir" ? `Não achei uma tarefa feita parecida com “${cmd.texto}”.` : `Não achei “${cmd.texto}” nas suas tarefas abertas. Diga “o que tenho” para ver a lista.` });
      } else if ("empate" in r) {
        novas.push({ id: id(), de: "drend", status: "pergunta", texto: `Qual delas? ${r.empate.slice(0, 4).map((t) => `“${t.texto}”`).join(", ")}.` });
      } else if (cmd.tipo === "concluir") {
        setTarefas((l) => concluir(l, r.achado.id));
        novas.push({ id: id(), de: "drend", status: "feito", texto: `Feita: “${r.achado.texto}”. Se errei, diga “reabre ${r.achado.texto.toLowerCase()}”.` });
      } else if (cmd.tipo === "reabrir") {
        setTarefas((l) => reabrir(l, r.achado.id));
        novas.push({ id: id(), de: "drend", status: "feito", texto: `Voltou para a lista: “${r.achado.texto}”.` });
      } else {
        setTarefas((l) => remover(l, r.achado.id));
        novas.push({ id: id(), de: "drend", status: "feito", texto: `Apaguei a tarefa “${r.achado.texto}”.` });
      }
    } else if (cmd?.tipo === "pendencias") {
      // "O que tenho hoje?" junta as tarefas e o que falta na agenda de hoje.
      const { eventos } = agendaDaConversa();
      const agendaHoje = eventos ? responderAgenda(eventos, "hoje") : "";
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderPendencias(tarefas, caixaDeEntrada.length) + (agendaHoje.startsWith("Hoje:") ? `\n\n${agendaHoje.replace(/^Hoje:/, "Na agenda hoje:")}` : "") });
    } else if (cmd?.tipo === "agenda") {
      const { eventos, motivo } = agendaDaConversa();
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderAgenda(eventos, cmd.quando, new Date(), motivo) });
    } else if (cmd?.tipo === "vault") {
      const { notas, motivo } = vaultDaConversa();
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderVault(notas, cmd.termo, motivo) });
    } else if (cmd?.tipo === "projetosVault") {
      const { notas, motivo } = vaultDaConversa();
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderProjetos(notas, motivo) });
    } else if (cmd?.tipo === "vendas") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderVendas(cmd.periodo, leituraDaFlush(), new Date(), metas[META_FLUSH_MES] ?? null) });
    } else if (cmd?.tipo === "meta") {
      setMetas((m) => ({ ...m, [META_FLUSH_MES]: cmd.valor }));
      const leitura = leituraDaFlush();
      const valor = cmd.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
      novas.push({ id: id(), de: "drend", status: "feito", texto: leitura && leitura.fase !== "carregando"
        ? `Meta do mês: ${valor}.\n${responderVendas("mes", leitura, new Date(), cmd.valor)}`
        : `Meta do mês: ${valor}. Aparece em Negócios assim que a Flush estiver ligada.` });
    } else if (cmd?.tipo === "missaoNota") {
      // Grava no banco (as Missões atualizam ao vivo); a resposta chega quando o banco confirmar.
      const { missao, texto } = cmd;
      void registrar({ missao, tipo: "nota", titulo: texto }).then((erro) => {
        setMensagens((ms) => [...ms, erro
          ? { id: id(), de: "drend", status: "falhou", texto: `Não consegui anotar na missão: ${erro}` }
          : { id: id(), de: "drend", status: "feito", texto: `Anotei na missão ${nomeDaMissao(missao)}: “${texto}”.` }]);
      });
    } else if (cmd?.tipo === "missaoStatus") {
      const m = lerMissoes();
      novas.push({ id: id(), de: "drend", status: "dica", texto: m.fase === "carregando" ? "Estou lendo as Missões. Pergunte de novo em instantes." : responderMissao(m.fase === "ok" ? m.eventos : null, cmd.missao) });
    } else if (cmd?.tipo === "semana") {
      const { eventos } = agendaDaConversa();
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderSemana({ flush: semanaDaConversa(), tarefas, habitos, lancamentos, agenda: eventos }) });
    } else if (cmd?.tipo === "resumo") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderResumo(tarefas, leituraDaFlush(), new Date(), "Resumo de agora:") });
    } else if (cmd?.tipo === "saudacao") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderResumo(tarefas, leituraDaFlush()) });
    } else if (cmd?.tipo === "agradecimento") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: responderAgradecimento() });
    } else if (cmd?.tipo === "ajuda") {
      novas.push({ id: id(), de: "drend", status: "dica", texto: AJUDA });
    } else if (cmd?.tipo === "desfazer") {
      const e = mural.undo();
      if (e) setVersao((v) => v + 1);
      novas.push(e
        ? { id: id(), de: "drend", status: "feito", texto: `Desfeito: ${e.summary.replace(/^Desfez: /, "")}.` }
        : { id: id(), de: "drend", status: "falhou", texto: "Não há nada para desfazer." });
    } else {
      // Ainda sem modelo de IA ligado: dizer isso é melhor que fingir. Se era uma ideia, dá para guardar num toque.
      novas.push({ id: id(), de: "drend", status: "pergunta", texto: "Não entendi isso como pedido. Se for uma ideia, escolha onde eu guardo. Diga “ajuda” para ver o que eu entendo.", ideia: limpo });
    }
    setMensagens((ms) => [...ms, ...novas]);
  }, [mural, tarefas, caixaDeEntrada.length, metas, lancamentos, habitos, contas]);

  const guardarIdeia = useCallback(
    (ideia: string, projeto: string) => {
      // Sem quadro do projeto ainda: nasce um "Ideias", no mesmo lote (um desfazer tira os dois).
      const existente = Object.values(mural.state.boards).find((b) => b.project === projeto);
      const quadro = existente ?? { id: `ideias-${projeto}`, title: `${NOMES_PROJETO[projeto] ?? projeto} · ideias`, project: projeto, tags: [] };
      const n = existente ? mural.cardsOf(quadro.id).length : 0;
      const card: Op = { type: "addCard", card: { id: `ideia-${Date.now()}`, boardId: quadro.id, kind: "nota", title: ideia, x: 60 + (n % 4) * 230, y: existente ? 680 : 40, w: 220 } };
      const e = executar(existente ? card : { type: "batch", ops: [{ type: "createBoard", board: quadro }, card] }, "drend", `Guardou a ideia em ${quadro.title}`);
      setCaixa((c) => c.filter((i) => i !== ideia));
      setMensagens((ms) => [
        ...ms.map((m) => (m.de === "drend" && m.ideia === ideia ? { ...m, ideia: undefined } : m)),
        { id: id(), de: "drend", status: "feito", texto: `Guardei em “${quadro.title}”.`, logId: e.id },
      ]);
    },
    [executar, mural],
  );

  const criarTarefa = useCallback((texto: string) => setTarefas((l) => adicionar(l, novaTarefa(texto))), []);
  const concluirTarefa = useCallback((tid: string) => setTarefas((l) => concluir(l, tid)), []);
  const reabrirTarefa = useCallback((tid: string) => setTarefas((l) => reabrir(l, tid)), []);
  // Apagar um gasto que quitava uma conta devolve a conta para "a pagar"; o desfazer do gasto quita de novo.
  const pagamentosSoltos = useRef(new Map<string, { conta: string; pagamento: PagamentoDeConta }[]>());
  const apagarLancamento = useCallback((lid: string) => {
    const { contas: depois, removidos } = semLancamento(contasAgora.current, lid);
    if (removidos.length) {
      pagamentosSoltos.current.set(lid, removidos);
      contasAgora.current = depois;
      setContas(depois);
    }
    setLancamentos((ls) => removerLancamento(ls, lid));
  }, []);
  const restaurarLancamento = useCallback((l: Lancamento) => {
    setLancamentos((ls) => adicionarLancamento(ls, l));
    const soltos = pagamentosSoltos.current.get(l.id);
    if (soltos) {
      pagamentosSoltos.current.delete(l.id);
      setContas((cs) => soltos.reduce((acc, x) => marcarPaga(acc, x.conta, x.pagamento), cs));
    }
  }, []);
  const criarConta = useCallback((c: ContaLida) => {
    const nova = novaConta(c);
    if (!nova.nome || contasAgora.current.some((x) => mesmaConta(x.nome, nova.nome))) return null;
    setContas((cs) => adicionarConta(cs, nova));
    return nova;
  }, []);
  const editarConta = useCallback((cid: string, m: MudancaDeConta) => setContas((cs) => editarNaLista(cs, cid, m)), []);
  const apagarConta = useCallback((cid: string) => setContas((cs) => removerConta(cs, cid)), []);
  const restaurarConta = useCallback((c: Conta) => setContas((cs) => (cs.some((x) => x.id === c.id) ? substituirConta(cs, c) : [...cs, c])), []);
  const pagarConta = useCallback((cid: string) => {
    const { contas: depois, pagamento, lancamento } = pagarAgora(contasAgora.current, cid, new Date());
    if (!pagamento) return null;
    if (lancamento) setLancamentos((ls) => adicionarLancamento(ls, lancamento));
    contasAgora.current = depois;
    setContas(depois);
    return pagamento;
  }, []);
  const desfazerPagamento = useCallback((cid: string, mes: string) => {
    const c = contasAgora.current.find((x) => x.id === cid);
    const pagamento = c ? pagamentoDoMes(c, mes) : null;
    if (!pagamento) return null;
    const lid = pagamento.lancamento;
    const lancamento = lid ? lancamentosAgora.current.find((l) => l.id === lid) ?? null : null;
    contasAgora.current = desmarcarPaga(contasAgora.current, cid, mes);
    setContas((cs) => desmarcarPaga(cs, cid, mes));
    if (lid) setLancamentos((ls) => removerLancamento(ls, lid));
    return { pagamento, lancamento };
  }, []);
  const restaurarPagamento = useCallback((cid: string, p: PagamentoDeConta, l: Lancamento | null) => {
    if (l) setLancamentos((ls) => adicionarLancamento(ls, l));
    setContas((cs) => marcarPaga(cs, cid, p));
  }, []);
  const criarHabito = useCallback((nome: string) => setHabitos((hs) => adicionarHabito(hs, novoHabito(nome))), []);
  const alternarHabitoHoje = useCallback((hid: string, dia?: string) => setHabitos((hs) => alternarDia(hs, hid, dia ?? diaEmBrasilia(new Date()))), []);
  const apagarHabito = useCallback((hid: string) => setHabitos((hs) => removerHabito(hs, hid)), []);
  const restaurarHabito = useCallback((h: Habito) => setHabitos((hs) => adicionarHabito(hs, h)), []);
  const definirMeta = useCallback((chave: string, valor: number | null) => setMetas((m) => {
    const novas = { ...m };
    if (valor) novas[chave] = valor;
    else delete novas[chave];
    return novas;
  }), []);

  const value = useMemo(
    () => ({ mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, email: sessao?.user.email ?? null, entrar, criarAcesso, sair, tarefas, criarTarefa, concluirTarefa, reabrirTarefa, metas, definirMeta, lancamentos, apagarLancamento, restaurarLancamento, habitos, criarHabito, alternarHabitoHoje, apagarHabito, restaurarHabito, contas, criarConta, editarConta, apagarConta, restaurarConta, pagarConta, desfazerPagamento, restaurarPagamento }),
    [mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, sessao, entrar, criarAcesso, sair, tarefas, criarTarefa, concluirTarefa, reabrirTarefa, metas, definirMeta, lancamentos, apagarLancamento, restaurarLancamento, habitos, criarHabito, alternarHabitoHoje, apagarHabito, restaurarHabito, contas, criarConta, editarConta, apagarConta, restaurarConta, pagarConta, desfazerPagamento, restaurarPagamento],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
