import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entender, opCriarQuadro } from "./core/comandos";
import { Mural, MuralError, type Op, type LogEntry } from "./core/mural";
import { VERSAO, repositorioLocal, type Repositorio, type Retrato } from "./core/persistencia";
import { baixar, maisRecente, subir, supabase, type Session } from "./core/nuvem";
import { muralExemplo } from "./data/exemplo";
import { abertas, adicionar, concluir, novaTarefa, podar, reabrir, remover, type Tarefa } from "./core/tarefas";
import { acharPorTexto } from "./core/fala";
import { AJUDA, responderAgradecimento, responderMissao, responderPendencias, responderResumo, responderVendas, type LeituraFlush } from "./core/respostas";
import { lerEstado as lerFlush } from "./fontes/flush";
import { iniciarMissoes, lerMissoes, registrar } from "./fontes/missoes";
import { nomeDaMissao } from "./core/missao";
import { responderAgenda } from "./core/agenda";
import { eventosDa, iniciarAgenda, lerAgenda, motivoSemAgenda } from "./fontes/agenda";

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

export type Mensagem =
  | { id: string; de: "rapha"; texto: string }
  | { id: string; de: "drend"; status: "feito" | "proposto" | "falhou" | "pergunta" | "dica"; texto: string; ideia?: string; logId?: string; quadro?: string };

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
}

export const META_FLUSH_MES = "flush-mes";

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
  if (!muralRef.current) muralRef.current = salvo ? Mural.restaurar(salvo.mural) : new Mural(muralExemplo());
  const mural = muralRef.current;
  const [versao, setVersao] = useState(0);
  const [caixaDeEntrada, setCaixa] = useState<string[]>(salvo?.caixaDeEntrada ?? []);
  const [mensagens, setMensagens] = useState<Mensagem[]>(salvo?.mensagens.length ? salvo.mensagens : BOAS_VINDAS);
  const [tarefas, setTarefas] = useState<Tarefa[]>(() => podar(salvo?.tarefas ?? []));
  const [metas, setMetas] = useState<Record<string, number>>(salvo?.metas ?? {});

  useEffect(() => {
    repo.salvar({ mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens, tarefas, metas });
  }, [repo, mural, versao, caixaDeEntrada, mensagens, tarefas, metas]);

  // As missões ficam ouvindo desde a abertura: a conversa responde sem precisar abrir a tela.
  useEffect(iniciarMissoes, []);
  useEffect(iniciarAgenda, []);

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
          setCaixa(remoto.caixaDeEntrada);
          setMensagens(remoto.mensagens.length ? remoto.mensagens : BOAS_VINDAS);
          setTarefas(podar(remoto.tarefas ?? []));
          setMetas(remoto.metas ?? {});
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
      const r: Retrato<Mensagem> = { v: VERSAO, salvoEm: new Date().toISOString(), mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens, tarefas, metas };
      subir(r).then(() => setSincronia("ok"), () => setSincronia("erro"));
    }, 1000);
    return () => clearTimeout(t);
  }, [usuario, mural, versao, caixaDeEntrada, mensagens, tarefas, metas]);

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
    const cmd = entender(limpo);
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
  }, [mural, tarefas, caixaDeEntrada.length, metas]);

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
  const definirMeta = useCallback((chave: string, valor: number | null) => setMetas((m) => {
    const novas = { ...m };
    if (valor) novas[chave] = valor;
    else delete novas[chave];
    return novas;
  }), []);

  const value = useMemo(
    () => ({ mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, email: sessao?.user.email ?? null, entrar, criarAcesso, sair, tarefas, criarTarefa, concluirTarefa, reabrirTarefa, metas, definirMeta }),
    [mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, sessao, entrar, criarAcesso, sair, tarefas, criarTarefa, concluirTarefa, reabrirTarefa, metas, definirMeta],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
