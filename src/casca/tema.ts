import { useCallback, useLayoutEffect, useState } from "react";

export type Tema = "sistema" | "claro" | "escuro";

const CHAVE = "drend:tema";
const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function resolver(tema: Tema): "claro" | "escuro" {
  if (tema !== "sistema") return tema;
  try {
    return window.matchMedia?.(CONSULTA_ESCURO).matches ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

/**
 * O mesmo mecanismo do painel da Flush: `data-v2-tema` no <html> decide os tokens.
 * "Sistema" segue o iPhone (claro de dia, escuro à noite, se ele estiver no automático).
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const aplicar = () => raiz.setAttribute("data-v2-tema", resolver(tema));
    aplicar();
    if (tema !== "sistema" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(CONSULTA_ESCURO);
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [tema]);

  const escolher = useCallback((t: Tema) => {
    setTema(t);
    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      // Sem armazenamento (aba privada): vale só nesta visita.
    }
  }, []);

  return { tema, escolher };
}
