import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Restrito } from "./Restrito";
import { partesDeMoeda, type TomValor } from "./formato";
import { useMovimentoReduzido } from "./movimento";
import "./base.css";
import "./primitivas.css";

export type TamanhoValor = "p" | "m" | "g" | "gg";

export type { TomValor } from "./formato";

export interface ValorProps {
  /** Em reais (número, não centavos). `null` = informação restrita (nunca R$ 0,00). */
  valor: number | null;
  tamanho?: TamanhoValor;
  /** Cor do sinal (padrão neutro). A cor nunca é a única pista: o rótulo diz o que é. */
  tom?: TomValor;
  /**
   * Quando o valor MUDA (atualização, venda nova), os algarismos correm até o
   * novo número em 600 ms (crítica de design, item 18). Nunca na primeira
   * pintura, nunca com movimento reduzido; o leitor de tela ouve só o final.
   */
  animar?: boolean;
  /**
   * `false` nos resumos (fase Aparência, 14/10): mostra o real arredondado, sem centavos.
   * O leitor de tela continua ouvindo o valor exato; o detalhe mostra os centavos.
   */
  centavos?: boolean;
  className?: string;
}

const DURACAO_MS = 600;

/** Corre de um valor ao outro com saída suave; sem `ligado`, devolve o alvo na hora. */
function useValorAnimado(alvo: number, ligado: boolean): number {
  const reduzido = useMovimentoReduzido();
  const [mostrado, setMostrado] = useState(alvo);
  const anterior = useRef(alvo);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = alvo;
    if (!ligado || reduzido || de === alvo || typeof requestAnimationFrame !== "function") {
      setMostrado(alvo);
      return;
    }
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / DURACAO_MS);
      const suave = 1 - (1 - p) ** 3;
      setMostrado(Math.round((de + (alvo - de) * suave) * 100) / 100);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ligado, reduzido]);

  return ligado ? mostrado : alvo;
}

/**
 * Número em reais para destaque: "R$" a ~45%, centavos discretos, algarismos tabulares.
 * O leitor de tela ouve o valor inteiro ("R$ 1.234,50"), não os pedaços.
 */
export function Valor({ valor, ...resto }: ValorProps) {
  if (valor === null) return <Restrito tamanho={resto.tamanho} className={resto.className} />;
  return <ValorEmReais valor={valor} {...resto} />;
}

function ValorEmReais({ valor, tamanho = "m", tom = "neutro", animar = false, centavos: comCentavos = true, className }: ValorProps & { valor: number }) {
  const visivel = useValorAnimado(valor, animar);
  const { negativo, inteiro, centavos } = partesDeMoeda(comCentavos ? visivel : Math.round(visivel));
  const { texto } = partesDeMoeda(valor);
  return (
    <span className={cn("cos-valor", `cos-valor-${tamanho}`, tom !== "neutro" && `cos-valor-${tom}`, className)}>
      <span className="cos-sr">{texto}</span>
      <span className="cos-valor-rs" aria-hidden="true">R$</span>
      <span className="cos-valor-int" aria-hidden="true">{negativo ? "−" : ""}{inteiro}</span>
      {comCentavos && <span className="cos-valor-cent" aria-hidden="true">,{centavos}</span>}
    </span>
  );
}
