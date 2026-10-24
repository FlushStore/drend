import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useBarraAoRolar } from "@/app-shell/useBarraAoRolar";
import { MOLA_ICONE, MOLA_INDICADOR, CURVA, transicao, useMovimentoReduzido } from "./movimento";
import { nomeFaladoDoDestino, type AoNavegar, type ItemDeNavegacao } from "./navegacao";
import { useEsfregarDoca } from "./useEsfregarDoca";
import "./base.css";
import "./navegacao.css";

export interface DocaProps {
  /** Destinos (o + fica no meio: metade antes, metade depois). Pensada para 4. */
  itens: ReadonlyArray<ItemDeNavegacao>;
  /** `id` do item ativo. */
  ativo: string | null;
  /** O botão + que abre o `MenuMais`. Enquanto aberto, a doca não some. */
  /**
   * O botão do meio. `aoSegurar` (segurar ~0,45 s) abre o menu completo quando o toque
   * simples já faz a ação mais usada (fase Produtividade: + abre a venda direto).
   */
  mais: { aberto: boolean; aoAlternar: () => void; aoSegurar?: () => void; rotulo?: string };
  aoNavegar?: AoNavegar;
  /** Elemento que rola (padrão: a janela). */
  elementoDeRolagem?: HTMLElement | null;
  /** Mantém visível (ex.: teclado aberto). */
  forcarVisivel?: boolean;
  /**
   * Arrastar o dedo pela doca troca de aba (`useEsfregarDoca`). Ausente = o gesto fica
   * desligado. `primeira` = a primeira troca do gesto (as outras podem substituir no histórico).
   */
  aoEsfregar?: (item: ItemDeNavegacao, lado: 1 | -1, primeira: boolean) => void;
  rotulo?: string;
}

/**
 * Doca flutuante do celular (some ao rolar para baixo, volta ao subir; some no desktop pelo CSS).
 * Sem faixa de fundo: só a pílula, acima da área segura.
 */
export function Doca({
  itens, ativo, mais, aoNavegar, elementoDeRolagem, forcarVisivel = false, rotulo = "Navegação do celular", aoEsfregar,
}: DocaProps) {
  const reduzido = useMovimentoReduzido();
  const { pathname } = useLocation();
  /* Foco de teclado dentro da doca também a mantém visível (nunca focar algo escondido). */
  const [focada, setFocada] = useState(false);
  // Arrasto: o cursor segue o dedo fora do React (`useEsfregarDoca`). A troca que vem dele
  // já foi vista no cursor, então a marca pula para a aba nova sem deslizar de novo.
  const nav = useRef<HTMLElement>(null);
  const doArrasto = useRef(false);
  useEffect(() => { doArrasto.current = false; }, [ativo]);
  useEsfregarDoca(nav, ativo, {
    ligado: Boolean(aoEsfregar),
    aoEscolher: (id, lado, primeira) => {
      const it = itens.find((i) => i.id === id);
      if (!it) return;
      doArrasto.current = true;
      aoEsfregar?.(it, lado, primeira);
    },
  });
  const marcado = ativo;
  const visivel = useBarraAoRolar({ elemento: elementoDeRolagem, forcarVisivel: forcarVisivel || mais.aberto || focada });
  const meio = Math.ceil(itens.length / 2);
  // Segurar o +: abre o menu e engole o clique que viria ao soltar.
  const segurando = useRef<{ relogio: number; disparou: boolean } | null>(null);
  const soltarSegurar = () => { if (segurando.current) window.clearTimeout(segurando.current.relogio); };
  const comecarSegurar = () => {
    if (!mais.aoSegurar) return;
    soltarSegurar();
    const estado = { relogio: 0, disparou: false };
    estado.relogio = window.setTimeout(() => { estado.disparou = true; mais.aoSegurar?.(); }, 450);
    segurando.current = estado;
  };

  const item = (it: ItemDeNavegacao) => {
    const atual = it.id === ativo;
    const pendentes = it.pendentes ?? 0;
    return (
      <Link
        key={it.id}
        to={it.para}
        className="cos-doca-item"
        aria-label={nomeFaladoDoDestino(it)}
        data-doca-aba={it.id}
        aria-current={atual ? "page" : undefined}
        onClick={(e) => {
          // Tocar na aba em que já se está volta ao topo (como nos apps do celular);
          // numa tela de dentro dela (ex.: um produto), o toque volta para a lista.
          if (atual && it.para === pathname && !e.defaultPrevented) {
            e.preventDefault();
            (elementoDeRolagem ?? window).scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" });
            return;
          }
          aoNavegar?.(it, e);
        }}
      >
        {it.id === marcado && (
          <motion.span layoutId="cos-doca-marca" className="cos-doca-marca" transition={doArrasto.current ? { duration: 0 } : transicao(reduzido, MOLA_INDICADOR)} />
        )}
        <motion.span
          className="cos-doca-icone"
          animate={atual && !reduzido ? { y: [0, -3, 0] } : { y: 0 }}
          transition={{ duration: reduzido ? 0 : 0.32, ease: CURVA }}
        >
          <it.Icone size={21} strokeWidth={atual ? 2.1 : 1.75} aria-hidden="true" />
          {pendentes > 0 && <span className="cos-doca-bolha" aria-hidden="true">{pendentes}</span>}
          {pendentes === 0 && it.alerta && <span className="cos-doca-alerta" aria-hidden="true" />}
          {pendentes === 0 && !it.alerta && it.sai && <span className="cos-doca-sai" aria-hidden="true" />}
        </motion.span>
        <span className="cos-doca-rotulo" aria-hidden="true">{it.rotulo}</span>
      </Link>
    );
  };

  return (
    <nav
      ref={nav}
      className="cos-doca"
      aria-label={rotulo}
      data-escondida={!visivel || undefined}
      onFocus={() => setFocada(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocada(false); }}
      data-movimento={reduzido ? "reduzido" : "pleno"}
    >
      {aoEsfregar && <span className="cos-doca-cursor" data-doca-cursor="" aria-hidden="true" />}
      {itens.slice(0, meio).map(item)}
      <button
        type="button"
        className="cos-doca-mais"
        data-doca-fora=""
        aria-label={mais.rotulo ?? "Ações rápidas"}
        aria-expanded={mais.aberto}
        aria-haspopup="dialog"
        onClick={() => {
          if (segurando.current?.disparou) { segurando.current = null; return; }
          soltarSegurar();
          mais.aoAlternar();
        }}
        onPointerDown={comecarSegurar}
        onPointerUp={soltarSegurar}
        onPointerLeave={soltarSegurar}
        onContextMenu={mais.aoSegurar ? (e) => e.preventDefault() : undefined}
      >
        <motion.span
          className="cos-icone"
          animate={{ rotate: mais.aberto ? 45 : 0 }}
          transition={transicao(reduzido, MOLA_ICONE)}
        >
          <Plus size={26} strokeWidth={2.25} aria-hidden="true" />
        </motion.span>
      </button>
      {itens.slice(meio).map(item)}
    </nav>
  );
}
