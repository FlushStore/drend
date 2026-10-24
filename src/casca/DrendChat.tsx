import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Botao } from "@/design-system/Botao";
import { useStore, type Mensagem } from "@/store";
import { iniciarFlush } from "@/fontes/flush";

const DESTINOS = [
  ["flushstore", "FlushStore"],
  ["vape-mania", "Vape Mania"],
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
  const { mensagens, falar, guardarIdeia, desfazer, mural } = useStore();
  const [texto, setTexto] = useState("");
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
      {mensagens.every((m) => m.de === "drend" && m.status === "dica") && (
        <ul className="dr-chat-sugestoes" aria-label="Sugestões">
          {SUGESTOES.map(([rotulo, inicio, enviar]) => (
            <li key={rotulo}>
              <button type="button" className="dr-chat-sugestao" onClick={() => { if (enviar) falar(inicio); else { setTexto(inicio); entrada.current?.focus(); } }}>{rotulo}</button>
            </li>
          ))}
        </ul>
      )}
      <div ref={fim} />
      <form
        className="dr-chat-campo"
        onSubmit={(e) => {
          e.preventDefault();
          falar(texto);
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
