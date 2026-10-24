import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entender, opCriarQuadro } from "./core/comandos";
import { Mural, MuralError, type Op, type LogEntry } from "./core/mural";
import { VERSAO, repositorioLocal, type Repositorio, type Retrato } from "./core/persistencia";
import { baixar, maisRecente, subir, supabase, type Session } from "./core/nuvem";
import { muralExemplo } from "./data/exemplo";

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
}

const Ctx = createContext<Store | null>(null);
// Ids de mensagem únicos entre aberturas do app (as salvas voltam com os ids antigos).
let seq = 0;
const id = () => `m${Date.now().toString(36)}-${++seq}`;

const BOAS_VINDAS: Mensagem[] = [
  { id: "m-inicio", de: "drend", status: "dica", texto: "Peça um quadro assim: “crie um quadro Natal da Flush com cartões vídeo, cupom e stories”." },
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

  useEffect(() => {
    repo.salvar({ mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens });
  }, [repo, mural, versao, caixaDeEntrada, mensagens]);

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
      const r: Retrato<Mensagem> = { v: VERSAO, salvoEm: new Date().toISOString(), mural: { state: mural.state, log: mural.log }, caixaDeEntrada, mensagens };
      subir(r).then(() => setSincronia("ok"), () => setSincronia("erro"));
    }, 1000);
    return () => clearTimeout(t);
  }, [usuario, mural, versao, caixaDeEntrada, mensagens]);

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
    } else if (cmd?.tipo === "desfazer") {
      const e = mural.undo();
      if (e) setVersao((v) => v + 1);
      novas.push(e
        ? { id: id(), de: "drend", status: "feito", texto: `Desfeito: ${e.summary.replace(/^Desfez: /, "")}.` }
        : { id: id(), de: "drend", status: "falhou", texto: "Não há nada para desfazer." });
    } else {
      // Fase 4: ainda sem modelo de IA ligado. Dizer isso é melhor que fingir.
      novas.push({ id: id(), de: "drend", status: "falhou", texto: "Ainda não entendo conversa livre. Por enquanto: “crie um quadro … com cartões …”, “tive uma ideia…” e “desfaz”." });
    }
    setMensagens((ms) => [...ms, ...novas]);
  }, [mural]);

  const guardarIdeia = useCallback(
    (ideia: string, projeto: string) => {
      const quadro = Object.values(mural.state.boards).find((b) => b.project === projeto);
      if (!quadro) {
        setMensagens((ms) => [...ms, { id: id(), de: "drend", status: "falhou", texto: `Não achei um quadro de ${projeto}.` }]);
        return;
      }
      const n = mural.cardsOf(quadro.id).length;
      const e = executar(
        { type: "addCard", card: { id: `ideia-${Date.now()}`, boardId: quadro.id, kind: "nota", title: ideia, x: 60 + (n % 4) * 230, y: 680, w: 220 } },
        "drend",
        `Guardou a ideia em ${quadro.title}`,
      );
      setCaixa((c) => c.filter((i) => i !== ideia));
      setMensagens((ms) => [
        ...ms.map((m) => (m.de === "drend" && m.ideia === ideia ? { ...m, ideia: undefined } : m)),
        { id: id(), de: "drend", status: "feito", texto: `Guardei em “${quadro.title}”.`, logId: e.id },
      ]);
    },
    [executar, mural],
  );

  const value = useMemo(
    () => ({ mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, email: sessao?.user.email ?? null, entrar, criarAcesso, sair }),
    [mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia, sincronia, sessao, entrar, criarAcesso, sair],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
