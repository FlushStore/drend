import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { MOLA_INDICADOR, transicao, useMovimentoReduzido } from "./movimento";
import { nomeFaladoDoDestino, type AoNavegar, type ItemDeNavegacao } from "./navegacao";
import "./base.css";
import "./navegacao.css";

export interface AbasTopoProps {
  itens: ReadonlyArray<ItemDeNavegacao>;
  /** `id` do item ativo. */
  ativo: string | null;
  aoNavegar?: AoNavegar;
  rotulo?: string;
}

/**
 * Abas segmentadas centradas no topo (desktop). São links de navegação (`aria-current`), não
 * `tablist`: cada uma leva a uma rota. O destaque desliza entre elas (motion `layoutId`).
 */
export function AbasTopo({ itens, ativo, aoNavegar, rotulo = "Principal" }: AbasTopoProps) {
  const reduzido = useMovimentoReduzido();
  return (
    <nav className="cos-abas" aria-label={rotulo}>
      {itens.map((it) => {
        const atual = it.id === ativo;
        const pendentes = it.pendentes ?? 0;
        return (
          <Link
            key={it.id}
            to={it.para}
            className="cos-aba"
            aria-label={nomeFaladoDoDestino(it)}
            aria-current={atual ? "page" : undefined}
            onClick={aoNavegar ? (e) => aoNavegar(it, e) : undefined}
          >
            {atual && (
              <motion.span layoutId="cos-aba-marca" className="cos-aba-marca" transition={transicao(reduzido, MOLA_INDICADOR)} />
            )}
            <span className="cos-aba-texto" aria-hidden="true">{it.rotulo}</span>
            {it.sai && <ArrowUpRight className="cos-aba-sai" size={13} strokeWidth={2} aria-hidden="true" />}
            {pendentes > 0 && <span className="cos-aba-bolha" aria-hidden="true">{pendentes}</span>}
            {pendentes === 0 && it.alerta && <span className="cos-aba-alerta" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
