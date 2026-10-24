import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURVA, transicao, useMovimentoReduzido } from "./movimento";
import { useVibrarAoConfirmar } from "./toque";
import "./base.css";
import "./estados.css";

export interface DadosDoAviso {
  /** Muda a cada aviso (reinicia o tempo e a animação). */
  id: number | string;
  texto: string;
  tom?: "sucesso" | "erro";
  /** Um botão no aviso (ex.: "Enviar recibo"). Com ele o aviso fica mais tempo na tela. */
  acao?: AcaoDoAviso;
}

export interface AcaoDoAviso { rotulo: string; aoTocar: () => void }

const DURACAO_COM_ACAO_MS = 8000;

export interface AvisoProps {
  aviso: DadosDoAviso | null;
  /** Chamado quando o tempo acaba. */
  aoSumir: () => void;
  duracaoMs?: number;
}

const DURACAO_PADRAO_MS = 3400;

/**
 * Aviso curto (toast) que confirma um gesto. A região viva existe sempre (o leitor de tela só
 * anuncia mudanças em regiões já presentes). Fica dentro da `.cos-raiz` da casca.
 */
export function Aviso({ aviso, aoSumir, duracaoMs = DURACAO_PADRAO_MS }: AvisoProps) {
  const reduzido = useMovimentoReduzido();
  const id = aviso?.id;

  const comAcao = Boolean(aviso?.acao);
  useEffect(() => {
    if (id === undefined) return;
    const relogio = window.setTimeout(aoSumir, comAcao ? Math.max(duracaoMs, DURACAO_COM_ACAO_MS) : duracaoMs);
    return () => window.clearTimeout(relogio);
  }, [id, duracaoMs, aoSumir, comAcao]);

  const erro = aviso?.tom === "erro";
  useVibrarAoConfirmar(aviso && !erro ? aviso.id : null);
  return (
    <div className="cos-aviso-lugar" role={erro ? "alert" : "status"} aria-live={erro ? "assertive" : "polite"}>
      <AnimatePresence>
        {aviso && (
          <motion.div
            key={aviso.id}
            className={cn("cos-aviso", erro && "cos-aviso-erro")}
            initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={transicao(reduzido, { duration: 0.24, ease: CURVA })}
          >
            <span className="cos-aviso-marca" aria-hidden="true">
              {erro ? <AlertCircle size={15} strokeWidth={2.5} /> : <Check size={15} strokeWidth={2.5} />}
            </span>
            <span className="cos-aviso-texto">{aviso.texto}</span>
            {aviso.acao && (
              <button type="button" className="cos-aviso-acao" onClick={() => { aviso.acao?.aoTocar(); aoSumir(); }}>{aviso.acao.rotulo}</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
