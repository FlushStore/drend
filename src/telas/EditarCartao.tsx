import { useEffect, useState } from "react";
import { Botao } from "@/design-system/Botao";
import { Painel } from "@/design-system/Painel";
import type { Card } from "@/core/mural";

interface Props {
  cartao: Card | null;
  aoFechar: () => void;
  aoSalvar: (c: Card, titulo: string, texto: string) => void;
  aoApagar: (c: Card) => void;
}

/** Abre um cartão para mudar o título e o texto, ou apagar. Tudo vira operação do Mural (com desfazer). */
export function EditarCartao({ cartao, aoFechar, aoSalvar, aoApagar }: Props) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!cartao) return;
    setTitulo(cartao.title);
    setTexto(cartao.body ?? "");
  }, [cartao]);

  const mudou = !!cartao && (titulo.trim() !== cartao.title || texto.trim() !== (cartao.body ?? ""));
  return (
    <Painel aberto={!!cartao} aoFechar={aoFechar} titulo="Cartão">
      {cartao && (
        <form
          className="dr-editar"
          onSubmit={(e) => {
            e.preventDefault();
            if (mudou && titulo.trim()) aoSalvar(cartao, titulo.trim(), texto.trim());
            aoFechar();
          }}
        >
          <label className="dr-editar-campo">
            <span>Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoComplete="off" />
          </label>
          <label className="dr-editar-campo">
            <span>Texto</span>
            <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Detalhes, links, o que for" />
          </label>
          <Botao type="submit" largo disabled={!titulo.trim()}>{mudou ? "Salvar" : "Fechar"}</Botao>
          <Botao variante="fantasma" largo onClick={() => { aoApagar(cartao); aoFechar(); }}>Apagar cartão</Botao>
        </form>
      )}
    </Painel>
  );
}
