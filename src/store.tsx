import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Mural, type Op, type LogEntry } from "./core/mural";
import { muralExemplo } from "./data/exemplo";

export type Mensagem =
  | { id: string; de: "rapha"; texto: string }
  | { id: string; de: "drend"; status: "feito" | "proposto" | "falhou" | "pergunta"; texto: string; ideia?: string; logId?: string };

interface Store {
  mural: Mural;
  versao: number;
  mensagens: Mensagem[];
  caixaDeEntrada: string[];
  executar: (op: Op, ator: LogEntry["actor"], resumo: string) => LogEntry;
  desfazer: () => void;
  falar: (texto: string) => void;
  guardarIdeia: (ideia: string, projeto: string) => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 0;
const id = () => `m${++seq}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const muralRef = useRef(new Mural(muralExemplo()));
  const [versao, setVersao] = useState(0);
  const [caixaDeEntrada, setCaixa] = useState<string[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: id(), de: "drend", status: "falhou", texto: "Não consegui ler o PicPay: a conexão ainda não foi feita." },
  ]);

  const executar = useCallback((op: Op, ator: LogEntry["actor"], resumo: string) => {
    const e = muralRef.current.run(op, ator, resumo);
    setVersao((v) => v + 1);
    return e;
  }, []);

  const desfazer = useCallback(() => {
    if (muralRef.current.undo()) setVersao((v) => v + 1);
  }, []);

  const falar = useCallback((texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    const ideia = limpo.match(/^tive uma ideia[:,]?\s*(.*)$/i);
    setMensagens((ms) => {
      const novas: Mensagem[] = [...ms, { id: id(), de: "rapha", texto: limpo }];
      if (ideia) {
        const conteudo = ideia[1] || limpo;
        setCaixa((c) => [...c, conteudo]);
        novas.push({ id: id(), de: "drend", status: "pergunta", texto: "Guardei na caixa de entrada. Em qual projeto eu salvo?", ideia: conteudo });
      } else {
        // Fase 4: ainda sem modelo de IA ligado. Dizer isso é melhor que fingir.
        novas.push({ id: id(), de: "drend", status: "falhou", texto: "Ainda não estou ligado a uma IA. Por enquanto entendo “tive uma ideia…”. Conversa livre chega na Fase 6." });
      }
      return novas;
    });
  }, []);

  const guardarIdeia = useCallback(
    (ideia: string, projeto: string) => {
      const quadro = Object.values(muralRef.current.state.boards).find((b) => b.project === projeto);
      if (!quadro) {
        setMensagens((ms) => [...ms, { id: id(), de: "drend", status: "falhou", texto: `Não achei um quadro de ${projeto}.` }]);
        return;
      }
      const n = muralRef.current.cardsOf(quadro.id).length;
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
    [executar],
  );

  const value = useMemo(
    () => ({ mural: muralRef.current, versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia }),
    [versao, mensagens, caixaDeEntrada, executar, desfazer, falar, guardarIdeia],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}
