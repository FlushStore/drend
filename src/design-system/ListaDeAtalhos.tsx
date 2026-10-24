import { useId } from "react";
import { Link } from "react-router-dom";
import { SetaCirculo } from "./BotaoCirculo";
import "./base.css";
import "./primitivas.css";

export interface Atalho {
  para: string;
  titulo: string;
  /** Uma linha curta do que tem lá ("Para onde foi o dinheiro"). */
  descricao: string;
  /** Leva ao painel atual: o leitor de tela ouve "abre no painel atual" e a linha mostra a etiqueta. */
  painelAtual?: boolean;
}

/**
 * Lista de atalhos de uma tela (10/10; fecha o "Atalhos" do item 10 da
 * crítica): o que não é a ação principal vira uma linha com título, uma
 * frase e a seta — em vez de uma fileira de pílulas que quebra em várias
 * linhas no celular. A ação principal continua botão. O nome acessível de
 * cada link é o título; a frase é a descrição.
 */
export function ListaDeAtalhos({ rotulo, itens }: { rotulo: string; itens: ReadonlyArray<Atalho> }) {
  const base = useId();
  return (
    <nav aria-label={rotulo} className="cos-atalhos">
      <h2 className="cos-atalhos-titulo">{rotulo}</h2>
      <ul>
        {itens.map((a, i) => (
          <li key={a.para + a.titulo}>
            <Link to={a.para} className="cos-atalho" aria-label={a.painelAtual ? `${a.titulo}, abre no painel atual` : a.titulo} aria-describedby={`${base}-d${i}`}>
              <span className="cos-atalho-texto">
                <strong>{a.titulo}</strong>
                <small id={`${base}-d${i}`}>
                  {a.descricao}
                  {a.painelAtual && <span className="cos-atalho-etiqueta" aria-hidden="true">painel atual</span>}
                </small>
              </span>
              <SetaCirculo />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
