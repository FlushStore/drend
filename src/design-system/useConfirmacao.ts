import { useCallback, useRef, useState } from "react";
import type { DadosDaConfirmacao } from "./Confirmacao";

/** Estado de uma `<Confirmacao>`: `confirmar("Custo atualizado", "R$ 48,00 em 4 sabores")`. */
export function useConfirmacao() {
  const [confirmacao, setConfirmacao] = useState<DadosDaConfirmacao | null>(null);
  const contador = useRef(0);
  const confirmar = useCallback((titulo: string, detalhe?: string) => {
    contador.current += 1;
    setConfirmacao({ id: contador.current, titulo, detalhe });
  }, []);
  const limpar = useCallback(() => setConfirmacao(null), []);
  return { confirmacao, confirmar, limpar };
}
