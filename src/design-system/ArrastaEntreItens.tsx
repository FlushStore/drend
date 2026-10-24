import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useMovimentoReduzido } from "./movimento";
import { chegar, useArrastoLateral, type Lado, type RefDaChegada } from "./useArrastoLateral";

export interface ArrastaEntreItensProps {
  /** Só no celular. */
  ligado: boolean;
  podeIr: (lado: Lado) => boolean;
  /** Vai para o vizinho (quem chama navega). */
  aoIr: (lado: Lado) => void;
  /** Guardada por quem monta a lista: sobrevive à troca de item. */
  chegada: RefDaChegada;
  children: ReactNode;
}

/**
 * Detalhe que troca de item arrastando para o lado (ex.: produto anterior e próximo
 * dentro da folha). Monte com `key` do item para cada um ter a própria rolagem.
 */
export function ArrastaEntreItens({ ligado, podeIr, aoIr, chegada, children }: ArrastaEntreItensProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduzido = useMovimentoReduzido();
  useArrastoLateral(ref, { tipo: "item", chegada, ligado, podeIr, aoIr });
  // Só na montagem: cada item novo monta de novo (key). Antes da pintura, para a troca não piscar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => (ref.current ? chegar(ref.current, chegada, reduzido) ?? undefined : undefined), []);
  return <div ref={ref} data-arrasto-lateral={ligado ? "item" : undefined}>{children}</div>;
}
