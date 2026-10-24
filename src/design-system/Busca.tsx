import { useRef, type ReactNode } from "react";
import * as Dialogo from "@radix-ui/react-dialog";
import { Command, defaultFilter } from "cmdk";
import { Search, X } from "lucide-react";
import { BotaoCirculo } from "./BotaoCirculo";
import "./base.css";
import "./primitivas.css";
import "./sobreposicoes.css";

export interface ResultadoDaBusca {
  id: string;
  titulo: string;
  /** O título como aparece (ex.: com o trecho achado marcado). Sem ele, `titulo`. */
  tituloRico?: ReactNode;
  subtitulo?: ReactNode;
  /** Termos extras que também acham este resultado (código, sabores, apelidos). */
  palavras?: ReadonlyArray<string>;
  /** Visual à esquerda (avatar, foto, ícone em círculo). Decorativo. */
  visual?: ReactNode;
  /** Complemento à direita (ex.: valor). */
  fim?: ReactNode;
  aoEscolher: () => void;
}

export interface GrupoDaBusca {
  id: string;
  titulo: string;
  resultados: ReadonlyArray<ResultadoDaBusca>;
}

export interface BuscaProps {
  aberto: boolean;
  aoFechar: () => void;
  /** A fonte de resultados. Sem dados fixos: quem usa decide o que entra. */
  grupos: ReadonlyArray<GrupoDaBusca>;
  /** Consulta controlada (para fontes remotas). Sem ela, o campo é livre. */
  consulta?: string;
  aoMudarConsulta?: (consulta: string) => void;
  /** `false` quando a fonte já devolve os grupos filtrados (ex.: busca no servidor). */
  filtrar?: boolean;
  carregando?: boolean;
  placeholder?: string;
  textoVazio?: string;
  rotulo?: string;
}

/** Filtra pelo título e pelas palavras; o `value` interno (ids) nunca casa com a busca. */
const filtroPorPalavras = (_valor: string, busca: string, palavras: string[] = []) =>
  defaultFilter(palavras.join(" "), busca);

/**
 * Busca universal (cmdk sobre um diálogo Radix: foco preso, Escape fecha, rolagem travada).
 * Quase tela cheia no celular, janela central no desktop. Escolher um resultado fecha a busca.
 */
export function Busca({
  aberto, aoFechar, grupos, consulta, aoMudarConsulta, filtrar = true, carregando = false,
  placeholder = "Buscar", textoVazio = "Nada encontrado com esse nome.", rotulo = "Busca universal",
}: BuscaProps) {
  // Digitou: a lista volta ao topo, onde fica o resultado mais próximo, mesmo que ela
  // já estivesse rolada para baixo (pedido do Rapha, 15/10).
  const lista = useRef<HTMLDivElement>(null);
  const mudou = (texto: string) => {
    aoMudarConsulta?.(texto);
    requestAnimationFrame(() => lista.current?.scrollTo?.({ top: 0 }));
  };
  return (
    <Dialogo.Root open={aberto} onOpenChange={(abrir) => { if (!abrir) aoFechar(); }}>
      <Dialogo.Portal>
        <Dialogo.Overlay className="cos-raiz cos-busca-fundo" />
        <Dialogo.Content className="cos-raiz cos-busca" aria-describedby={undefined}>
          <Dialogo.Title className="cos-sr">{rotulo}</Dialogo.Title>
          <Command label={rotulo} loop shouldFilter={filtrar} filter={filtroPorPalavras}>
            <div className="cos-busca-campo">
              <Search size={20} strokeWidth={1.75} aria-hidden="true" />
              <Command.Input autoFocus placeholder={placeholder} value={consulta} onValueChange={mudou} />
              <BotaoCirculo rotulo="Fechar busca" onClick={aoFechar}>
                <X size={16} strokeWidth={2} />
              </BotaoCirculo>
            </div>
            <Command.List ref={lista} className="cos-busca-lista">
              {carregando && <Command.Loading className="cos-busca-carregando">Buscando…</Command.Loading>}
              {!carregando && <Command.Empty className="cos-busca-vazio">{textoVazio}</Command.Empty>}
              {grupos.map((grupo) => (
                <Command.Group key={grupo.id} heading={grupo.titulo}>
                  {grupo.resultados.map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${grupo.id}/${r.id}`}
                      keywords={[r.titulo, ...(r.palavras ?? [])]}
                      onSelect={() => { aoFechar(); r.aoEscolher(); }}
                    >
                      {r.visual && <span className="cos-icone" aria-hidden="true">{r.visual}</span>}
                      <span className="cos-busca-item-texto">
                        <strong>{r.tituloRico ?? r.titulo}</strong>
                        {r.subtitulo && <small>{r.subtitulo}</small>}
                      </span>
                      {r.fim && <span className="cos-busca-item-fim">{r.fim}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialogo.Content>
      </Dialogo.Portal>
    </Dialogo.Root>
  );
}
