import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export interface StepperProps {
  valor: number;
  aoMudar: (valor: number) => void;
  /** Nome acessível do grupo (ex.: "Quantidade de Uva gelada"). */
  rotulo: string;
  minimo?: number;
  /** `null` = sem teto. */
  maximo?: number | null;
  disabled?: boolean;
  /** Versão menor (40 px), para listas densas como o carrinho da venda. */
  compacto?: boolean;
  /** No mínimo, o "−" vira lixeira e tira o item (15/10: some o "Tirar" solto da linha). */
  aoRemover?: () => void;
  /** Nome acessível da lixeira (ex.: "Tirar Manga"). */
  rotuloRemover?: string;
}

/**
 * − n + (crítica de design, item 20): dois alvos de 44 px e o número digitável
 * no meio (`inputmode=numeric`). Nunca sai do intervalo; no teto o "+" desliga
 * (vender mais do que há no estoque não é escolha).
 */
export function Stepper({ valor, aoMudar, rotulo, minimo = 1, maximo = null, disabled = false, compacto = false, aoRemover, rotuloRemover = "Tirar" }: StepperProps) {
  const limitar = (n: number) => Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, Math.floor(n) || minimo));
  const noTeto = maximo !== null && valor >= maximo;
  const tamanho = compacto ? 16 : 18;
  const remover = aoRemover && valor <= minimo;
  return (
    <div className={cn("cos-stepper", compacto && "cos-stepper-compacto")} role="group" aria-label={rotulo}>
      {remover ? (
        <button type="button" className="cos-stepper-botao cos-stepper-remover cos-tocavel" aria-label={rotuloRemover} disabled={disabled} onClick={aoRemover}>
          <Trash2 size={tamanho - 1} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="cos-stepper-botao cos-tocavel" aria-label="Menos um" disabled={disabled || valor <= minimo} onClick={() => aoMudar(limitar(valor - 1))}>
          <Minus size={tamanho} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      <input
        className="cos-stepper-campo"
        type="text"
        inputMode="numeric"
        aria-label="Quantidade"
        value={valor}
        disabled={disabled}
        onChange={(e) => { const n = Number.parseInt(e.target.value, 10); if (Number.isFinite(n)) aoMudar(limitar(n)); }}
      />
      <button type="button" className="cos-stepper-botao cos-tocavel" aria-label="Mais um" disabled={disabled || noTeto} onClick={() => aoMudar(limitar(valor + 1))}>
        <Plus size={tamanho} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
