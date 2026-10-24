import { useEffect, useRef, type ReactNode } from "react";
import { Botao } from "./Botao";
import "./base.css";
import "./primitivas.css";

export interface ConfirmarAcaoProps {
  /** Nome acessível do grupo (ex.: "Confirmar descarte"). */
  rotulo: string;
  /** O que vai acontecer, em linguagem simples. */
  children: ReactNode;
  textoConfirmar: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  ocupado?: boolean;
  /** `primaria` quando confirmar É a ação principal da tela (registrar venda). */
  variante?: "primaria" | "secundaria";
}

/**
 * Segundo toque antes de uma ação que não volta (descartar, registrar venda).
 * "Voltar" recebe o foco: o caminho seguro é o padrão. Escape cancela SÓ a
 * confirmação: o ouvinte fica na captura da `window`, antes do vaul/Radix (que
 * escutam no `document`), então o painel não fecha junto.
 */
export function ConfirmarAcao({ rotulo, children, textoConfirmar, aoConfirmar, aoCancelar, ocupado = false, variante = "secundaria" }: ConfirmarAcaoProps) {
  const voltar = useRef<HTMLButtonElement>(null);
  const cancelar = useRef(aoCancelar);
  cancelar.current = aoCancelar;

  useEffect(() => {
    voltar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      cancelar.current();
    };
    window.addEventListener("keydown", tecla, { capture: true });
    return () => window.removeEventListener("keydown", tecla, { capture: true });
  }, []);

  return (
    <div className="cos-confirma" role="group" aria-label={rotulo}>
      <p>{children}</p>
      <div className="cos-confirma-botoes">
        <Botao ref={voltar} variante="fantasma" onClick={aoCancelar} disabled={ocupado}>Voltar</Botao>
        <Botao variante={variante} onClick={aoConfirmar} ocupado={ocupado}>{textoConfirmar}</Botao>
      </div>
    </div>
  );
}
