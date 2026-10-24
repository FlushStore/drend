import type { MouseEvent } from "react";
import type { LucideIcon } from "lucide-react";

/** Um destino da navegação principal (doca no celular, abas no desktop). */
export interface ItemDeNavegacao {
  id: string;
  rotulo: string;
  /** Caminho da rota. */
  para: string;
  Icone: LucideIcon;
  /** Quantos itens esperam ação (bolha no acento). 0/undefined = sem bolha. */
  pendentes?: number;
  /**
   * Alerta discreto (fase Facilidade, 14/10): um ponto no ícone, sem número, com o texto
   * para o leitor de tela (ex.: "3 sabores acabando"). A bolha de pendentes tem prioridade.
   */
  alerta?: string;
  /**
   * Destino fora desta casca (ex.: tela ainda não migrada). Texto para o leitor de tela;
   * presente = marca visual discreta (seta pequena nas abas, ponto na doca).
   */
  sai?: string;
}

/** Chamado no clique; o chamador pode `preventDefault()` para navegar do seu jeito. */
export type AoNavegar = (item: ItemDeNavegacao, evento: MouseEvent<HTMLAnchorElement>) => void;

/** Texto para o leitor de tela quando há pendentes. */
export const textoPendentes = (n: number) => `, ${n} ${n === 1 ? "pendente" : "pendentes"}`;

/**
 * Nome falado de um destino: "Vendas", "Vendas, 3 pendentes", "Artes, abre o painel atual".
 * Para `aria-label`: pedaços `.cos-sr` soltos o navegador lia "Vendas , 3 pendentes".
 */
export function nomeFaladoDoDestino(it: Pick<ItemDeNavegacao, "rotulo" | "pendentes" | "sai" | "alerta">): string {
  const pendentes = it.pendentes ?? 0;
  const alerta = pendentes === 0 && it.alerta ? `, ${it.alerta}` : "";
  return `${it.rotulo}${it.sai ? `, ${it.sai}` : ""}${pendentes > 0 ? textoPendentes(pendentes) : ""}${alerta}`;
}
