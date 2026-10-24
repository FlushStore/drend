import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entender, opCriarQuadro } from "./core/comandos";
import { Mural, MuralError, type Op, type LogEntry } from "./core/mural";
import { repositorioLocal, type Repositorio } from "./core/persistencia";
import { muralExemplo } from "./data/exemplo";

export type Mensagem =
  | { id: string; de: "rapha"; texto: string }
  | { id: string; de: "drend"; status: "feito" | "proposto" | "falhou" | "pergunta" | "dica"; texto: string; ideia?: string; logId?: string; quadro?: string };

interface Store {
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
    () => ({ mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia }),
    [mural, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
