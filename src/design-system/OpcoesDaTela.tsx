import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotaoCirculo } from "./BotaoCirculo";
import { textoDaAtualizacao } from "./formato";
import { useLugarDoTopo } from "./LugarDoTopo";
import "./base.css";
import "./primitivas.css";

export interface OpcaoDaTela {
  id: string;
  rotulo: string;
  icone?: ReactNode;
  aoEscolher: () => void;
}

export interface OpcoesDaTelaProps {
  /** Quando os dados chegaram (`null` = ainda não carregou). */
  atualizadoEm: Date | null;
  aoAtualizar: () => void;
  atualizando?: boolean;
  /** A última tentativa falhou: o botão ganha um ponto de aviso. */
  desatualizado?: boolean;
  /** Ações próprias da tela (ex.: "Organizar" na Início). */
  opcoes?: ReadonlyArray<OpcaoDaTela>;
}

/**
 * O "⋯" do cabeçalho de cada tela (pedido do Rapha, 09/10: tirar o que polui).
 * Desde 11/10 a tela se relê sozinha (`useReleitura` na carga), então o ⋯ só
 * aparece quando a tela tem ações próprias (ex.: "Organizar" na Início). Sem
 * ações, nada aparece; se a última releitura falhou, aparece só o botão de
 * atualizar, com o ponto de aviso. Menu acessível: botão com `aria-expanded`,
 * itens `menuitem`, setas percorrem, Escape e clique fora fecham e devolvem o
 * foco ao botão.
 */
export const OpcoesDaTela = forwardRef<HTMLButtonElement, OpcoesDaTelaProps>(function OpcoesDaTela(
  { atualizadoEm, aoAtualizar, atualizando = false, desatualizado = false, opcoes = [] },
  ref,
) {
  const [aberto, setAberto] = useState(false);
  const lugar = useLugarDoTopo();
  const noLugar = (conteudo: ReactNode) => (lugar ? createPortal(conteudo, lugar) : conteudo);
  const menu = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement | null>(null);

  const fechar = (devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return;
    caixa.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const fora = (e: PointerEvent) => { if (!caixa.current?.parentElement?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const teclar = (e: React.KeyboardEvent) => {
    const itens = [...(caixa.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); itens[(i + 1) % itens.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); itens[(i - 1 + itens.length) % itens.length]?.focus(); }
    else if (e.key === "Tab") setAberto(false);
  };

  const escolher = (acao: () => void) => { fechar(true); acao(); };
  const estado = textoDaAtualizacao(atualizadoEm, { atualizando, desatualizado });

  if (opcoes.length === 0) {
    if (!desatualizado) return null;
    return noLugar(
      <BotaoCirculo ref={ref} rotulo={`Atualizar agora (${estado})`} onClick={aoAtualizar} disabled={atualizando}
        className={cn("cos-opcoes-alerta", atualizando && "cos-opcoes-ocupado")}>
        <RefreshCw size={18} strokeWidth={1.75} className={atualizando ? "cos-gira" : undefined} />
      </BotaoCirculo>,
    );
  }

  return noLugar(
    <div className="cos-opcoes">
      <BotaoCirculo
        ref={(el) => { gatilho.current = el; if (typeof ref === "function") ref(el); else if (ref) ref.current = el; }}
        rotulo="Opções da tela"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menu : undefined}
        onClick={() => setAberto((a) => !a)}
        className={cn(desatualizado && "cos-opcoes-alerta", atualizando && "cos-opcoes-ocupado")}
      >
        <MoreHorizontal size={20} strokeWidth={1.75} />
      </BotaoCirculo>
      <span className="cos-sr" role="status">{atualizando ? "Atualizando…" : ""}</span>
      {aberto && (
        <div ref={caixa} id={menu} role="menu" aria-label="Opções da tela" className="cos-opcoes-menu" onKeyDown={teclar}>
          {desatualizado && (
            <button type="button" role="menuitem" className="cos-opcoes-item" disabled={atualizando} onClick={() => escolher(aoAtualizar)}>
              <RefreshCw size={16} strokeWidth={1.75} className={atualizando ? "cos-gira" : undefined} aria-hidden="true" />
              Atualizar agora
            </button>
          )}
          {opcoes.map((o) => (
            <button key={o.id} type="button" role="menuitem" className="cos-opcoes-item" onClick={() => escolher(o.aoEscolher)}>
              {o.icone && <span aria-hidden="true">{o.icone}</span>}
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>,
  );
});
