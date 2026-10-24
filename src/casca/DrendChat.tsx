import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Botao } from "@/design-system/Botao";
import { useStore, type Mensagem } from "@/store";

const DESTINOS = [
  ["flushstore", "FlushStore"],
  ["vape-mania", "Vape Mania"],
] as const;

const SELO: Record<Extract<Mensagem, { de: "drend" }>["status"], string> = {
  feito: "Feito",
  proposto: "Precisa do seu ok",
  falhou: "Não deu",
  pergunta: "Preciso de você",
};

/** A conversa com o DREND: no PC dentro do painel lateral, no iPhone como tela. */
export function DrendChat({ aoAbrirMural }: { aoAbrirMural: () => void }) {
  const { mensagens, falar, guardarIdeia, desfazer, mural } = useStore();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

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
              <span className="dr-selo" data-status={m.status}>{SELO[m.status]}</span>
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
                  <Botao variante="secundaria" compacto onClick={aoAbrirMural}>Ver no Mural</Botao>
                  <Botao variante="fantasma" compacto onClick={desfazer}>Desfazer</Botao>
                </div>
              )}
            </li>
          ),
        )}
      </ol>
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
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Tive uma ideia…" enterKeyHint="send" />
        </label>
        <button type="submit" className="cos-circulo cos-circulo-acento dr-chat-enviar" aria-label="Enviar" disabled={!texto.trim()}>
          <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
