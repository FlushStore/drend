import { useEffect, useSyncExternalStore } from "react";
import { diaLocal } from "./flush-regras";
import { resumirMes, type MesFlush } from "@/core/financeiro";
import { iniciarFlush, lerEstado, ouvir, type EstadoFlush, type ResumoFlush } from "./flush";
import type { ProdutosFlush } from "./flush-produtos";

export interface NumerosFlush {
  /** true enquanto não há leitura real: a tela não mostra número nenhum. */
  semLeitura: boolean;
  hoje: number;
  lucro: number;
  pedidos: number | null;
  semana: ReadonlyArray<{ dia: string; valor: number }>;
  /** "hoje", ou o dia da última leitura quando ela é de outro dia (ex.: aberto sem internet). */
  dia: string;
  ultimoEhHoje: boolean;
  atualizadoEm: string | null;
  /** O mês até hoje e a comparação. null sem leitura real. */
  mes: MesFlush | null;
  /** Mais vendidos, estoque baixo e formas de pagamento. null sem a leitura direta da Flush. */
  produtos: ProdutosFlush | null;
  /** true quando os números são a cópia do servidor (sem a sessão da Flush neste aparelho). */
  doServidor: boolean;
  estado: EstadoFlush;
}

/** Os números da Flush para as telas: só reais. Sem leitura, zerados e com semLeitura. */
export function useFlush(): NumerosFlush {
  useEffect(iniciarFlush, []);
  const estado = useSyncExternalStore(ouvir, lerEstado, lerEstado);
  const resumo: ResumoFlush | null = estado.fase === "ok" || estado.fase === "erro" ? estado.resumo : null;
  if (!resumo) {
    return { semLeitura: true, hoje: 0, lucro: 0, pedidos: null, semana: [], dia: "hoje", ultimoEhHoje: true, atualizadoEm: null, mes: null, produtos: null, doServidor: false, estado };
  }
  const hoje = resumo.dias[resumo.dias.length - 1];
  const ehHoje = hoje.dia === diaLocal(new Date().toISOString());
  const dia = ehHoje ? "hoje" : new Date(`${hoje.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  const mes = resumo.historico ? resumirMes(resumo.historico) : null;
  return { semLeitura: false, hoje: hoje.valor, lucro: hoje.lucro, pedidos: hoje.pedidos, semana: resumo.dias, dia, ultimoEhHoje: ehHoje, atualizadoEm: resumo.atualizadoEm, mes, produtos: resumo.produtos ?? null, doServidor: resumo.origem === "servidor", estado };
}
