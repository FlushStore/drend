import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CURVA, transicao, useMovimentoReduzido } from "./movimento";
import { useVibrarAoConfirmar } from "./toque";
import "./base.css";
import "./confirmacao.css";

export interface DadosDaConfirmacao {
  /** Muda a cada confirmação (reinicia o tempo e a animação). */
  id: number;
  /** O que foi feito, curto: "Custo atualizado". */
  titulo: string;
  /** O resultado em uma frase: "R$ 48,00 em 4 sabores. Vale para as próximas vendas." */
  detalhe?: string;
}

// 1,1 s (era 2,4 s, depois 1,6 s; pedidos do Rapha de 16/10: "ainda tá um pouco lento").
const DURACAO_MS = 1100;

/**
 * Confirmação de ação importante (pedido do Rapha, 16/10: "mudei o custo e subiu só um texto
 * esquisito"). Um cartão no meio da tela com o ✓ se desenhando, o que foi feito e o resultado;
 * some sozinho em 1,1 s ou num toque. Vibra no Android. A região viva existe sempre, para o
 * leitor de tela anunciar. Para gestos pequenos (copiar, filtrar) continua o `Aviso`.
 */
export function Confirmacao({ confirmacao, aoSumir }: { confirmacao: DadosDaConfirmacao | null; aoSumir: () => void }) {
  const reduzido = useMovimentoReduzido();
  const id = confirmacao?.id;
  useVibrarAoConfirmar(id ?? null);
  useEffect(() => {
    if (id === undefined) return;
    const relogio = window.setTimeout(aoSumir, DURACAO_MS);
    return () => window.clearTimeout(relogio);
  }, [id, aoSumir]);

  return (
    <div className="cos-confirmacao-lugar" role="status" aria-live="polite">
      <AnimatePresence>
        {confirmacao && (
          <motion.div key={`veu-${confirmacao.id}`} className="cos-confirmacao-veu" onClick={aoSumir} aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduzido ? 0 : 0.16 }} />
        )}
        {confirmacao && (
          <motion.button
            type="button"
            key={confirmacao.id}
            className="cos-confirmacao"
            onClick={aoSumir}
            aria-label={`${confirmacao.titulo}${confirmacao.detalhe ? `. ${confirmacao.detalhe}` : ""}. Toque para fechar.`}
            initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={transicao(reduzido, { duration: 0.22, ease: CURVA })}
          >
            <svg className="cos-confirmacao-marca" viewBox="0 0 52 52" aria-hidden="true">
              <circle className="cos-confirmacao-circulo" cx="26" cy="26" r="24" />
              <path className="cos-confirmacao-check" d="M15 27l7 7 15-16" />
            </svg>
            <span className="cos-confirmacao-titulo">{confirmacao.titulo}</span>
            {confirmacao.detalhe && <span className="cos-confirmacao-detalhe">{confirmacao.detalhe}</span>}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
