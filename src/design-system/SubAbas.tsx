import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export interface SubAba {
  rotulo: string;
  para: string;
  /** `true` = só a rota exata (a primeira aba costuma ser a raiz da seção). */
  exata?: boolean;
}

/** Marca na lista se há abas escondidas antes ou depois da parte visível. */
export function marcarSobra(lista: HTMLElement): void {
  const max = lista.scrollWidth - lista.clientWidth;
  lista.toggleAttribute("data-mais-antes", max > 1 && lista.scrollLeft > 1);
  lista.toggleAttribute("data-mais-depois", max > 1 && lista.scrollLeft < max - 1);
}

/**
 * Sub-abas de uma seção (crítica de design, 09/10, item 15): Produtos ·
 * Estoque · Sabores debaixo da aba Produtos; Resumo · Caixa · Fiado · Compras
 * debaixo de Financeiro. São links de verdade: a URL diz onde se está e a
 * doca/abas de cima continuam acesas na aba-mãe (`itemAtivo`).
 *
 * No celular as abas rolam para o lado: a ativa entra inteira na vista (15/10, antes
 * "Compras" ficava cortada como "Comp" estando aberta). Se ainda sobra aba escondida de
 * um lado, `data-mais-antes`/`data-mais-depois` acendem o degradê da borda (QA de 16/10).
 */
export function SubAbas({ rotulo, abas, className }: { rotulo: string; abas: ReadonlyArray<SubAba>; className?: string }) {
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const lista = nav.current;
    const ativa = lista?.querySelector<HTMLElement>("[aria-current=\"page\"]");
    if (!lista || !ativa) return;
    const aba = ativa.getBoundingClientRect(), faixa = lista.getBoundingClientRect();
    if (aba.right > faixa.right) lista.scrollLeft += aba.right - faixa.right + 16;
    else if (aba.left < faixa.left) lista.scrollLeft -= faixa.left - aba.left + 16;
    marcarSobra(lista);
  }, [pathname]);
  useEffect(() => {
    const lista = nav.current;
    if (!lista) return;
    const atualizar = () => marcarSobra(lista);
    atualizar();
    lista.addEventListener("scroll", atualizar, { passive: true });
    const observador = typeof ResizeObserver === "function" ? new ResizeObserver(atualizar) : null;
    observador?.observe(lista);
    return () => {
      lista.removeEventListener("scroll", atualizar);
      observador?.disconnect();
    };
  }, []);
  return (
    <nav ref={nav} aria-label={rotulo} className={cn("cos-subabas", className)}>
      {abas.map((a) => (
        <NavLink key={a.para} to={a.para} end={a.exata ?? false} className="cos-subaba">
          {a.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
