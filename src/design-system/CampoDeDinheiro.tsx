import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { colarValor, digitarNoCampo, valorNoCampo } from "./dinheiro-digitado";

export interface CampoDeDinheiroProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  /** Texto do valor como `lerValorBR` lê ("15,00"); "" = vazio. */
  valor: string;
  aoMudar: (valor: string) => void;
}

/**
 * Campo de dinheiro do painel (pedido do Rapha, 16/10): digita como na maquininha, cada
 * dígito entra pela direita (1 → 0,01; 15 → 0,15; 1500 → 15,00). O cursor fica sempre no
 * fim, onde o próximo dígito entra. Teclado só de números no celular. Quem usa guarda o
 * texto e lê com `lerValorBR`, como antes. Negativo nunca entra: "-" digitado ou colado é
 * recusado, e o texto colado é lido por `lerValorBR` (não dígito a dígito).
 */
export const CampoDeDinheiro = forwardRef<HTMLInputElement, CampoDeDinheiroProps>(function CampoDeDinheiro(
  { valor, aoMudar, placeholder = "0,00", onFocus, onPaste, ...resto },
  ref,
) {
  const campo = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => campo.current as HTMLInputElement);
  const mostrado = valorNoCampo(valor);

  const cursorNoFim = () => {
    const el = campo.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  };
  // A cada valor novo (o "1.234,56" muda de tamanho), o cursor volta para o fim.
  useLayoutEffect(cursorNoFim, [mostrado]);

  return (
    <input
      {...resto}
      ref={campo}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={mostrado}
      onChange={(e) => {
        const novo = digitarNoCampo(e.target.value);
        if (novo !== null) aoMudar(novo);
      }}
      onPaste={(e) => {
        onPaste?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        const colado = colarValor(e.clipboardData.getData("text"));
        if (colado !== null) aoMudar(colado);
      }}
      onFocus={(e) => { onFocus?.(e); requestAnimationFrame(cursorNoFim); }}
      onClick={cursorNoFim}
    />
  );
});
