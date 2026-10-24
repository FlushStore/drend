import { useEffect, useSyncExternalStore } from "react";
import { flush as exemplo } from "@/data/exemplo";
import { iniciarFlush, lerEstado, ouvir, type EstadoFlush } from "./flush";

export interface NumerosFlush {
  /** true enquanto não há leitura real: a tela mostra o selo de exemplo. */
  exemplo: boolean;
  hoje: number;
  lucro: number;
  pedidos: number | null;
  semana: ReadonlyArray<{ dia: string; valor: number }>;
  atualizadoEm: string | null;
  estado: EstadoFlush;
}

/** Os números da Flush para as telas: reais quando conectado, de exemplo quando não. */
export function useFlush(): NumerosFlush {
  useEffect(iniciarFlush, []);
  const estado = useSyncExternalStore(ouvir, lerEstado, lerEstado);
  const resumo = estado.fase === "ok" || estado.fase === "erro" ? estado.resumo : null;
  if (!resumo) {
    return { exemplo: true, hoje: exemplo.faturamento, lucro: exemplo.lucro, pedidos: null, semana: exemplo.semana, atualizadoEm: null, estado };
  }
  const hoje = resumo.dias[resumo.dias.length - 1];
  return { exemplo: false, hoje: hoje.valor, lucro: hoje.lucro, pedidos: hoje.pedidos, semana: resumo.dias, atualizadoEm: resumo.atualizadoEm, estado };
}
