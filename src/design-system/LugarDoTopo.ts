import { createContext, useContext } from "react";

/**
 * Onde o ⋯ da tela mora (pedido do Rapha, 13/10: "do lado da foto e da lupa").
 * A casca do painel guarda aqui o elemento do topo; `OpcoesDaTela` se desenha
 * nele por portal. Fora da casca (laboratório, testes) é `null` e o ⋯ fica no
 * próprio cabeçalho da tela.
 */
export const LugarDoTopo = createContext<HTMLElement | null>(null);

export const useLugarDoTopo = () => useContext(LugarDoTopo);
