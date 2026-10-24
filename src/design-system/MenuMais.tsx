import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURVA, transicao, useMovimentoReduzido } from "./movimento";
import "./base.css";
import "./navegacao.css";

export interface AcaoRapida {
  id: string;
  rotulo: string;
  /** Ícone em círculo no acento suave… */
  Icone?: LucideIcon;
  /** …ou um visual próprio (ex.: foto de produto em círculo). */
  visual?: ReactNode;
  /** A ação principal do menu (círculo cheio no acento). Use em no máximo uma. */
  destaque?: boolean;
  aoEscolher: () => void;
}

export interface SecaoDoMenu {
  id: string;
  titulo: string;
  acoes: ReadonlyArray<AcaoRapida>;
}

export interface MenuMaisProps {
  aberto: boolean;
  aoFechar: () => void;
  /** `doca` sobe do + do celular (com véu); `topo` desce do + do desktop (âncora `position: relative`). */
  origem: "doca" | "topo";
  secoes: ReadonlyArray<SecaoDoMenu>;
  rotulo?: string;
}

/**
 * O "+" expandido: ações rápidas e atalhos em grade de 4. Escape ou toque fora fecham; ao abrir,
 * o foco vai para a primeira ação; ao fechar, volta para quem abriu. Escolher uma ação fecha o menu.
 */
export function MenuMais({ aberto, aoFechar, origem, secoes, rotulo = "Ações rápidas" }: MenuMaisProps) {
  const reduzido = useMovimentoReduzido();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    painel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      if (anterior?.isConnected) anterior.focus();
    };
  }, [aberto, aoFechar]);

  const deslocamento = origem === "doca" ? 24 : -8;

  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.div
            key="veu"
            className={cn("cos-mais-veu", origem === "topo" && "cos-mais-veu-topo")}
            onClick={aoFechar}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transicao(reduzido, { duration: 0.2 })}
          />
          <motion.div
            key="painel"
            ref={painel}
            className={cn("cos-mais", `cos-mais-${origem}`)}
            role="dialog"
            aria-label={rotulo}
            data-movimento={reduzido ? "reduzido" : "pleno"}
            initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: deslocamento }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: deslocamento * 0.66 }}
            transition={transicao(reduzido, { duration: 0.28, ease: CURVA })}
          >
            {secoes.map((secao, s) => (
              <section key={secao.id} aria-label={secao.titulo}>
                <p className="cos-mais-titulo" aria-hidden="true">{secao.titulo}</p>
                <div className="cos-mais-grade">
                  {secao.acoes.map((acao, a) => {
                    // Escalonamento curto (crítica de design, item 7): 20 ms por item, teto de 160 ms.
                    const atraso = Math.min(0.03 + (s * 4 + a) * 0.02, 0.16);
                    return (
                      <motion.button
                        key={acao.id}
                        type="button"
                        className="cos-mais-item"
                        data-destaque={acao.destaque || undefined}
                        onClick={() => { aoFechar(); acao.aoEscolher(); }}
                        initial={reduzido ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={transicao(reduzido, { delay: atraso, duration: 0.22, ease: CURVA })}
                      >
                        {acao.visual ? (
                          <span className="cos-icone" aria-hidden="true">{acao.visual}</span>
                        ) : (
                          <span className="cos-mais-icone" aria-hidden="true">
                            {acao.Icone && <acao.Icone size={20} strokeWidth={1.75} />}
                          </span>
                        )}
                        <span className="cos-mais-rotulo">{acao.rotulo}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
