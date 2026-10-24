import { useCallback, useRef, useState } from "react";
import type { AcaoDoAviso, DadosDoAviso } from "./Aviso";

/** Estado de um `<Aviso>`: `avisar("Texto copiado")` mostra; o próprio Aviso chama `limpar`. */
export function useAviso() {
  const [aviso, setAviso] = useState<DadosDoAviso | null>(null);
  const contador = useRef(0);

  const avisar = useCallback((texto: string, tom: DadosDoAviso["tom"] = "sucesso", acao?: AcaoDoAviso) => {
    contador.current += 1;
    setAviso({ id: contador.current, texto, tom, acao });
  }, []);
  const limpar = useCallback(() => setAviso(null), []);

  return { aviso, avisar, limpar };
}
