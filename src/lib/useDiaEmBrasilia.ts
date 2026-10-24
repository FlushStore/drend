import { useEffect, useState } from "react";
import { diaEmBrasilia, msAteAmanha } from "@/core/brasilia";

/**
 * O "hoje" de Brasília, reativo: vira à meia-noite e é conferido de novo quando o app
 * volta ao primeiro plano (no iPhone o relógio para com a tela em segundo plano).
 */
export function useDiaEmBrasilia(): string {
  const [dia, setDia] = useState(() => diaEmBrasilia(new Date()));
  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout>;
    const conferir = () => {
      clearTimeout(relogio);
      setDia(diaEmBrasilia(new Date()));
      relogio = setTimeout(conferir, msAteAmanha() + 1000);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") conferir();
    };
    relogio = setTimeout(conferir, msAteAmanha() + 1000);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", conferir);
    return () => {
      clearTimeout(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", conferir);
    };
  }, []);
  return dia;
}
