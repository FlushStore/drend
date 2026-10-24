import { useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "./base.css";
import "./primitivas.css";

export interface CampoDeBuscaProps {
  valor: string;
  aoMudar: (valor: string) => void;
  /** Nome acessível e texto de exemplo ("Buscar modelo ou sabor"). */
  rotulo: string;
  className?: string;
}

/**
 * Campo de busca de lista (10/10): pílula com a lupa, nome acessível igual ao
 * texto de exemplo e o anel de foco no campo inteiro (o mesmo do resto do
 * Control OS). Antes havia cinco cópias por tela, uma delas sem foco visível.
 * Filtra o que já está na tela; quem consulta o banco é a busca da casca.
 */
export function CampoDeBusca({ valor, aoMudar, rotulo, className }: CampoDeBuscaProps) {
  const campo = useRef<HTMLInputElement>(null);
  return (
    <label className={cn("cos-busca-campo", className)}>
      <Search size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="cos-sr">{rotulo}</span>
      <input ref={campo} type="search" enterKeyHint="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={rotulo} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      {/* Limpar próprio (16/10): o X nativo era azul no Chrome, miúdo no iPhone e fora do tema. */}
      {valor !== "" && (
        <button type="button" className="cos-busca-limpar" aria-label="Limpar busca" onClick={(e) => { e.preventDefault(); aoMudar(""); campo.current?.focus(); }}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}
