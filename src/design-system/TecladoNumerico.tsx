import { Delete } from "lucide-react";
import { teclar } from "./teclado";
import { teclarCentavos } from "./dinheiro-digitado";
import "./base.css";
import "./primitivas.css";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "apagar"] as const;
// Dinheiro de maquininha (16/10): sem vírgula; o "00" fecha os reais de uma vez (1, 5, 00 = 15,00).
const TECLAS_CENTAVOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "apagar"] as const;

export interface TecladoNumericoProps {
  /** Texto em reais como digitado ("200", "12,5"). */
  valor: string;
  aoMudar: (valor: string) => void;
  /** Nome acessível do grupo (ex.: "Valor recebido"). */
  rotulo: string;
  /** Limite de casas decimais (centavos = 2). */
  decimais?: number;
  disabled?: boolean;
  /** Dinheiro de maquininha: cada dígito entra pela direita (1500 = 15,00). */
  centavos?: boolean;
}

/**
 * Teclado próprio do balcão (crítica de design, item 23): teclas de 56 px na
 * zona do polegar, nunca o teclado do sistema (que cobre a tela e muda de
 * aparelho para aparelho). Quem usa guarda o texto e mostra o número.
 */
export function TecladoNumerico({ valor, aoMudar, rotulo, decimais = 2, disabled = false, centavos = false }: TecladoNumericoProps) {
  return (
    <div className="cos-teclado" role="group" aria-label={rotulo}>
      {(centavos ? TECLAS_CENTAVOS : TECLAS).map((t) => (
        <button
          key={t}
          type="button"
          className="cos-teclado-tecla cos-tocavel"
          aria-label={t === "apagar" ? "Apagar" : t === "," ? "Vírgula" : t === "00" ? "Dois zeros" : t}
          disabled={disabled}
          onClick={() => aoMudar(centavos ? teclarCentavos(valor, t) : teclar(valor, t, decimais))}
        >
          {t === "apagar" ? <Delete size={22} strokeWidth={2} aria-hidden="true" /> : t}
        </button>
      ))}
    </div>
  );
}
