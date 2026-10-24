import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Botao } from "@/design-system/Botao";
import { useStore, type Mensagem } from "@/store";
import { iniciarFlush } from "@/fontes/flush";
import { Cerebro } from "@/cerebro/Cerebro";

const DESTINOS = [
  ["flushstore", "FlushStore"],
  ["vida", "Vida"],
  ["drend", "DREND"],
] as const;

/** Atalhos da conversa vazia: o rótulo é curto, o toque deixa o começo da frase no campo. */
const SUGESTOES = [
  ["O que tenho hoje?", "O que tenho hoje?", true],
  ["Quanto vendi hoje?", "Quanto vendi hoje?", true],
  ["Me lembra de…", "Me lembra de ", false],
  ["Tive uma ideia", "Tive uma ideia: ", false],
] as const;

const SELO: Record<Extract<Mensagem, { de: "drend" }>["status"], string> = {
  feito: "Feito",
  proposto: "Precisa do seu ok",
  falhou: "Não deu",
  pergunta: "Preciso de você",
  dica: "",
};

/** A conversa com o DREND: no PC dentro do painel lateral, no iPhone como tela. */
export function DrendChat({ aoAbrirMural }: { aoAbrirMural: (quadro?: string) => void }) {
  const { mensagens, falar, guardarIdeia, desfazer, mural, lancamentos, apagarLancamento } = useStore();
  const [texto, setTexto] = useState("");
  // O cérebro: cada pedido é uma rajada, e ele "pensa" por um instante.
  const [atividade, setAtividade] = useState(0);
  const [pensando, setPensando] = useState(false);
  const fimDoPensar = useRef<ReturnType<typeof setTimeout>>();
  function pedir(frase: string) {
    if (!frase.trim()) return;
    setAtividade((a) => a + 1);
    setPensando(true);
    clearTimeout(fimDoPensar.current);
    fimDoPensar.current = setTimeout(() => setPensando(false), 1600);
    falar(frase);
  }
  useEffect(() => () => clearTimeout(fimDoPensar.current), []);
  const vazia = mensagens.every((m) => m.de === "drend" && m.status === "dica");
  const fim = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  // O Desfazer só volta a última ação ativa: o botão aparece só na mensagem dela.
  const ultima = [...mural.log].reverse().find((e) => !e.undone && !e.summary.startsWith("Desfez:"));

  // A conversa responde sobre a Flush mesmo quando o Hoje ainda não abriu.
  useEffect(iniciarFlush, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  return (
    <div className="dr-chat">
      <div className="dr-chat-cerebro">
        <Cerebro atividade={atividade} pensando={pensando} tamanho={vazia ? "g" : "p"} />
        <p className="dr-chat-estado" aria-live="polite">{pensando ? "Pensando…" : "\u00a0"}</p>
      </div>
      <ol className="dr-chat-lista" aria-label="Conversa com o DREND">
        {mensagens.map((m) =>
          m.de === "rapha" ? (
            <li key={m.id} className="dr-msg-eu">{m.texto}</li>
          ) : (
            <li key={m.id} className="dr-msg-drend cos-bloco">
              {SELO[m.status] && <span className="dr-selo" data-status={m.status}>{SELO[m.status]}</span>}
              <p>{m.texto}</p>
              {m.ideia && (
                <div className="dr-msg-acoes">
                  {DESTINOS.map(([id, nome]) => (
                    <Botao key={id} variante="fantasma" compacto onClick={() => guardarIdeia(m.ideia!, id)}>{nome}</Botao>
                  ))}
                </div>
              )}
              {m.lancamento && lancamentos.some((l) => l.id === m.lancamento) && (
                <div className="dr-msg-acoes">
                  <Botao variante="fantasma" compacto onClick={() => apagarLancamento(m.lancamento!)}>Desfazer</Botao>
                </div>
              )}
              {m.logId && mural.log.some((e) => e.id === m.logId && !e.undone) && (
                <div className="dr-msg-acoes">
                  <Botao variante="secundaria" compacto onClick={() => aoAbrirMural(m.quadro)}>Ver no Mural</Botao>
                  {ultima?.id === m.logId && <Botao variante="fantasma" compacto onClick={() => desfazer()}>Desfazer</Botao>}
                </div>
              )}
            </li>
          ),
        )}
      </ol>
      {vazia && (
        <ul className="dr-chat-sugestoes" aria-label="Sugestões">
          {SUGESTOES.map(([rotulo, inicio, enviar]) => (
            <li key={rotulo}>
              <button type="button" className="dr-chat-sugestao" onClick={() => { if (enviar) pedir(inicio); else { setTexto(inicio); entrada.current?.focus(); } }}>{rotulo}</button>
            </li>
          ))}
        </ul>
      )}
      <div ref={fim} />
      <form
        className="dr-chat-campo"
        onSubmit={(e) => {
          e.preventDefault();
          pedir(texto);
          setTexto("");
        }}
      >
        <label className="cos-entrada dr-chat-entrada">
          <span className="cos-sr">Falar com o DREND</span>
          <input ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Fale com o DREND…" enterKeyHint="send" />
        </label>
        <button type="submit" className="cos-circulo cos-circulo-acento dr-chat-enviar" aria-label="Enviar" disabled={!texto.trim()}>
          <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
