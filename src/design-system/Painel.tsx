import { useRef, type ReactNode } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotaoCirculo } from "./BotaoCirculo";
import { useTelaLarga } from "./useTelaLarga";
import { usePonteiroFino } from "./usePonteiroFino";
import { useTecladoDoPainel } from "./useTecladoDoPainel";
import "./base.css";
import "./primitivas.css";
import "./sobreposicoes.css";

export type LadoDoPainel = "auto" | "baixo" | "direita";

export interface PainelProps {
  aberto: boolean;
  aoFechar: () => void;
  /** Nome do painel (cabeçalho e nome acessível). */
  titulo: string;
  /** Esconde o cabeçalho visual (o conteúdo traz o próprio); o título segue para o leitor de tela. */
  ocultarCabecalho?: boolean;
  /** `auto` (padrão): de baixo no celular, pela direita no desktop. */
  lado?: LadoDoPainel;
  /** Ações fixas embaixo (ex.: "Registrar venda"); não rolam com o conteúdo. */
  rodape?: ReactNode;
  /** Troque para reiniciar a rolagem quando o conteúdo muda (ex.: id do item aberto). */
  chave?: string;
  children: ReactNode;
}

/**
 * Painel deslizante (vaul): sobe de baixo com arrasto no celular, entra pela direita no desktop.
 * Foco preso, Escape/arrasto/toque no véu fecham. Leva `.cos-raiz` porque vive num portal.
 */
export function Painel({
  aberto, aoFechar, titulo, ocultarCabecalho = false, lado = "auto", rodape, chave, children,
}: PainelProps) {
  const telaLarga = useTelaLarga();
  const ponteiroFino = usePonteiroFino();
  const direita = lado === "direita" || (lado === "auto" && telaLarga);
  const conteudo = useRef<HTMLDivElement>(null);
  useTecladoDoPainel(conteudo, aberto && !direita);

  return (
    // Arrastar para fechar só pela faixa da alça, também no toque (16/10, "às vezes tenho de tocar duas
    // vezes"): com a folha inteira arrastável, o vaul tomava o toque que mexia uns pixels (e a rolagem
    // perto do topo) como começo de arrasto, e o botão não recebia o clique. Com mouse já era assim (11/10).
    // Fecha também por X, Esc e toque no véu.
    <Drawer.Root open={aberto} onOpenChange={(abrir) => { if (!abrir) aoFechar(); }} direction={direita ? "right" : "bottom"} handleOnly
      // O teclado é tratado por `useTecladoDoPainel`: o do vaul cortava a folha no iPhone (15/10).
      repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="cos-raiz cos-painel-veu" />
        <Drawer.Content
          ref={conteudo}
          className={cn("cos-raiz cos-painel", direita ? "cos-painel-direita" : "cos-painel-baixo")}
          aria-describedby={undefined}
        >
          {!direita && (ponteiroFino
            ? <div className="cos-painel-alca" aria-hidden="true" />
            : <Drawer.Handle className="cos-painel-puxador"><span className="cos-painel-alca" /></Drawer.Handle>)}
          {ocultarCabecalho ? (
            <Drawer.Title className="cos-sr">{titulo}</Drawer.Title>
          ) : (
            <div className="cos-painel-cabeca">
              <Drawer.Title className="cos-painel-titulo">{titulo}</Drawer.Title>
              <BotaoCirculo rotulo="Fechar" onClick={aoFechar}>
                <X size={18} strokeWidth={1.75} />
              </BotaoCirculo>
            </div>
          )}
          <div className="cos-painel-rolagem" key={chave}>{children}</div>
          {rodape && <div className="cos-painel-rodape">{rodape}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
