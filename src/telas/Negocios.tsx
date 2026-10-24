import { Bloco } from "@/design-system/Bloco";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { Valor } from "@/design-system/Valor";
import { Link } from "react-router-dom";
import { SetaCirculo } from "@/design-system/BotaoCirculo";
import { outrosProjetos } from "@/data/exemplo";
import { atualizarStatusVM, rotulo, useStatusVM } from "@/fontes/status";
import { useFlush } from "@/fontes/useFlush";
import { CurvaDaSemana } from "./VendasDaSemana";

/** Um projeto por bloco: o número que importa e o estado. Operar é no painel do projeto. */
export function Negocios() {
  const flush = useFlush();
  const vm = useStatusVM();
  const semana = flush.semana.reduce((t, d) => t + d.valor, 0);
  return (
    <>
      <CabecalhoDeTela titulo="Negócios" />
      <div className="dr-negocios">
        <Bloco className="dr-proj dr-proj-flush" aria-label="FlushStore">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">FlushStore</h2>
            <span className="dr-estado"><i className="dr-ponto" data-tom={flush.exemplo ? undefined : "ok"} aria-hidden="true" />{flush.exemplo ? "Exemplo" : flush.pedidos === 1 ? `1 pedido ${flush.dia}` : `${flush.pedidos} pedidos ${flush.dia}`}</span>
          </div>
          <dl className="dr-numeros">
            <div><dt>{flush.dia.charAt(0).toUpperCase() + flush.dia.slice(1)}</dt><dd><Valor valor={flush.hoje} tamanho="g" centavos={false} /></dd></div>
            <div><dt>Lucro</dt><dd><Valor valor={flush.lucro} tamanho="g" centavos={false} /></dd></div>
            <div><dt>Semana</dt><dd><Valor valor={semana} tamanho="g" centavos={false} /></dd></div>
          </dl>
          <CurvaDaSemana dias={flush.semana} ultimoEhHoje={flush.ultimoEhHoje} />
        </Bloco>

        <Bloco className="dr-proj" aria-label="Vape Mania">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">Vape Mania</h2>
            <button type="button" className="dr-mi-mais" onClick={() => void atualizarStatusVM(true)} disabled={vm.verificando}>{vm.verificando ? "Verificando…" : "Verificar"}</button>
          </div>
          <dl className="dr-saude">
            <div><dt>Site</dt><dd><i className="dr-ponto" data-tom={vm.site.ok === null ? undefined : vm.site.ok ? "ok" : "alerta"} aria-hidden="true" />{rotulo(vm.site, "site")}</dd></div>
            <div><dt>Banco</dt><dd><i className="dr-ponto" data-tom={vm.banco.ok === null ? undefined : vm.banco.ok ? "ok" : "alerta"} aria-hidden="true" />{rotulo(vm.banco, "banco")}</dd></div>
          </dl>
        </Bloco>

        <Link to="/missoes" className="cos-bloco dr-proj" aria-label="Missões">
          <div className="dr-proj-cab">
            <h2 className="dr-proj-nome">Missões</h2>
            <SetaCirculo />
          </div>
          <p className="dr-proj-linha">Tudo que está andando em cada projeto, ao vivo.</p>
        </Link>
      </div>

      <section className="dr-pausados" aria-label="Outros projetos">
        <h2 className="dr-rotulo">Outros</h2>
        <ul className="dr-lista">
          {outrosProjetos.map(([nome, estado]) => (
            <li key={nome} className="dr-lista-item dr-lista-estatico"><span>{nome}</span><small>{estado}</small></li>
          ))}
        </ul>
      </section>
    </>
  );
}
