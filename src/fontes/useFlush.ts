import { useEffect, useSyncExternalStore } from "react";
import { flush as exemplo } from "@/data/exemplo";
import { diaLocal } from "./flush-regras";
import { iniciarFlush, lerEstado, ouvir, type EstadoFlush } from "./flush";

export interface NumerosFlush {
  /** true enquanto não há leitura real: a tela mostra o selo de exemplo. */
  exemplo: boolean;
  hoje: number;
  lucro: number;
  pedidos: number | null;
  semana: ReadonlyArray<{ dia: string; valor: number }>;
  /** "hoje", ou o dia da última leitura quando ela é de outro dia (ex.: aberto sem internet). */
  dia: string;
  ultimoEhHoje: boolean;
  atualizadoEm: string | null;
  estado: EstadoFlush;
}

/** Os números da Flush para as telas: reais quando conectado, de exemplo quando não. */
export function useFlush(): NumerosFlush {
  useEffect(iniciarFlush, []);
  const estado = useSyncExternalStore(ouvir, lerEstado, lerEstado);
  const resumo = estado.fase === "ok" || estado.fase === "erro" ? estado.resumo : null;
  if (!resumo) {
    return { exemplo: true, hoje: exemplo.faturamento, lucro: exemplo.lucro, pedidos: null, semana: exemplo.semana, dia: "hoje", ultimoEhHoje: true, atualizadoEm: null, estado };
  }
  const hoje = resumo.dias[resumo.dias.length - 1];
  const ehHoje = hoje.dia === diaLocal(new Date().toISOString());
  const dia = ehHoje ? "hoje" : new Date(`${hoje.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return { exemplo: false, hoje: hoje.valor, lucro: hoje.lucro, pedidos: hoje.pedidos, semana: resumo.dias, dia, ultimoEhHoje: ehHoje, atualizadoEm: resumo.atualizadoEm, estado };
}
