import { useId, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronDown, Lightbulb, LayoutGrid, MessageCircle, type LucideIcon } from "lucide-react";
import { Anel } from "@/design-system/Anel";
import { Bloco, BlocoHeroi, TituloBloco } from "@/design-system/Bloco";
import { BotaoCirculo, SetaCirculo } from "@/design-system/BotaoCirculo";
import { Sparkline } from "@/design-system/Sparkline";
import { Valor } from "@/design-system/Valor";
import { useRecolhivel } from "@/design-system/useRecolhivel";
import { useTelaLarga } from "@/design-system/useTelaLarga";
import { agenda, dinheiroHoje, drendStatus, flush, metas, vapeMania } from "@/data/exemplo";
import { moneyBRL } from "@/lib/store-utils";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { Estado, Linhas } from "./partes";

interface Pendencia { id: string; titulo: string; onde: string; para: string; urgente?: boolean }

/** O herói da tela (regra da Flush: um por tela): o que espera o Rapha agora. */
function HeroiPendencias({ itens }: { itens: Pendencia[] }) {
  const largo = useTelaLarga();
  const [aberto, setAberto] = useState(largo);
  const corpo = useId();
  const recolhe = useRecolhivel<HTMLOListElement>(aberto);
  const [primeira] = itens;
  return (
    <BlocoHeroi className={cn("ini-heroi", itens.length === 0 && "ini-heroi-vazio")} aria-labelledby="dr-heroi-titulo">
      <div className="ini-heroi-cab">
        <button type="button" className="ini-heroi-alternar" aria-expanded={aberto} aria-controls={corpo} disabled={itens.length === 0} onClick={() => setAberto((a) => !a)}>
          <h2 id="dr-heroi-titulo" className="ini-heroi-titulo">
            <span className="ini-num">{itens.length}</span> {itens.length === 1 ? "coisa espera você" : "coisas esperam você"}
          </h2>
          <small className="ini-nota">{itens.length === 0 ? "Tudo em dia" : "Do mais urgente para o resto"}</small>
          {itens.length > 0 && <ChevronDown size={18} className={cn("ini-heroi-seta", aberto && "ini-heroi-seta-aberta")} aria-hidden="true" />}
        </button>
      </div>
      {!aberto && primeira && (
        <Link to={primeira.para} className="ini-heroi-proximo">
          <span className="ini-heroi-proximo-texto"><strong>{primeira.titulo}</strong><small>{primeira.onde}</small></span>
          <span className="ini-heroi-atender">Resolver</span>
        </Link>
      )}
      <ol ref={recolhe.ref} id={corpo} hidden={recolhe.hidden} className="ini-fila" aria-label="O que espera você">
        {itens.map((p) => (
          <li key={p.id}>
            <Link to={p.para} className="ini-fila-item">
              <span className="ini-fila-nome"><strong>{p.titulo}</strong><small>{p.onde}</small></span>
              {p.urgente ? <span className="ini-fila-min ini-urgente">Hoje</span> : <span />}
              <SetaCirculo tom="heroi" />
            </Link>
          </li>
        ))}
      </ol>
    </BlocoHeroi>
  );
}

function DinheiroDeHoje() {
  const [aberto, setAberto] = useState(false);
  const corpo = useId();
  const recolhe = useRecolhivel<HTMLDivElement>(aberto);
  const resultado = dinheiroHoje.entradas - dinheiroHoje.saidas;
  return (
    <section className="cos-bloco ini-dia" aria-labelledby="dr-dia-titulo">
      <h2 id="dr-dia-titulo" className="cos-sr">Seu dinheiro hoje</h2>
      <div className="ini-dia-topo">
        <dl className="ini-dia-numeros">
          <div className="ini-dia-principal">
            <dt className="ini-dia-rotulo"><span>Entrou hoje</span><span className="dr-dia-onde">· pessoal</span></dt>
            <dd><Valor valor={dinheiroHoje.entradas} tamanho="g" centavos={false} animar /></dd>
          </div>
          <div>
            <dt>Saiu</dt>
            <dd><Valor valor={dinheiroHoje.saidas} tamanho="m" centavos={false} /></dd>
          </div>
        </dl>
        <BotaoCirculo rotulo={aberto ? "Recolher o detalhe de hoje" : "Ver o detalhe de hoje"} aria-expanded={aberto} aria-controls={corpo} onClick={() => setAberto((a) => !a)}>
          <ChevronDown size={18} strokeWidth={1.75} className="ini-hoje-seta" data-aberto={aberto || undefined} />
        </BotaoCirculo>
      </div>
      <div id={corpo} ref={recolhe.ref} hidden={recolhe.hidden}>
        <div className="ini-dia-detalhe">
          <dl className="ini-dia-linhas">
            <div><dt>Resultado do dia</dt><dd><Valor valor={resultado} tamanho="m" centavos={false} tom={resultado < 0 ? "negativo" : "positivo"} /></dd></div>
          </dl>
          <p className="ini-dia-nota" role="note">Itaú, PicPay e InfinitePay, só leitura. Separado da FlushStore. Lido às {dinheiroHoje.atualizado}.</p>
          <Link to="/vida" className="ini-link-rodape">Abrir a Vida <SetaCirculo /></Link>
        </div>
      </div>
    </section>
  );
}

interface Acao { id: string; rotulo: string; curto?: string; desc: string; Icone: LucideIcon; para: string }

function AcoesRapidas({ ideias }: { ideias: number }) {
  const lista: Acao[] = [
    { id: "atender", rotulo: "Falar com o DREND", curto: "DREND", desc: "Texto ou voz, tudo fica no log", Icone: MessageCircle, para: "/drend" },
    { id: "ideia", rotulo: "Tive uma ideia", curto: "Ideia", desc: ideias > 0 ? `${ideias} na caixa de entrada` : "Guarda e pergunta o projeto", Icone: Lightbulb, para: "/drend" },
    { id: "mural", rotulo: "Mural", desc: "Quadros, notas e campanhas", Icone: LayoutGrid, para: "/mural" },
    { id: "agenda", rotulo: "Agenda", desc: `${agenda.length} compromissos hoje`, Icone: CalendarDays, para: "/vida" },
  ];
  return (
    <nav className="ini-acoes" aria-label="Ações rápidas" style={{ "--ini-n": lista.length } as CSSProperties}>
      {lista.map(({ id, rotulo, curto, desc, Icone, para }) => (
        <Link key={id} to={para} className="ini-acao" data-acao={id}>
          <span className="ini-acao-icone" aria-hidden="true"><Icone size={20} strokeWidth={1.75} /></span>
          <span className="ini-acao-texto">
            {curto
              ? <strong><span className="ini-acao-longo">{rotulo}</span><span className="ini-acao-curto" aria-hidden="true">{curto}</span></strong>
              : <strong>{rotulo}</strong>}
            <small>{desc}</small>
          </span>
          <SetaCirculo className="ini-acao-seta" />
        </Link>
      ))}
    </nav>
  );
}

export function Hoje() {
  const { caixaDeEntrada } = useStore();
  const pendencias: Pendencia[] = [
    ...caixaDeEntrada.map((ideia, i) => ({ id: `ideia-${i}`, titulo: ideia, onde: "Ideia sem projeto · caixa de entrada", para: "/drend", urgente: true })),
    { id: "control-os", titulo: flush.proximaTarefa, onde: "FlushStore · próxima tarefa", para: "/negocios", urgente: true },
    { id: "fornecedor", titulo: "Responder o fornecedor no WhatsApp", onde: "FlushStore · o DREND já escreveu a resposta", para: "/drend" },
    { id: "picpay", titulo: "Conectar o PicPay", onde: "Integrações · leitura do extrato", para: "/vida" },
  ];
  const meta = metas[0];

  return (
    <>
      <h1 className="cos-sr">Hoje</h1>
      <div className="ini-topo">
        <DinheiroDeHoje />
        <HeroiPendencias itens={pendencias} />
      </div>
      <AcoesRapidas ideias={caixaDeEntrada.length} />

      <div className="ini-grade">
        <div className="ini-lugar" style={{ "--ini-cl": 5, "--ini-cm": 2 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="flushstore" aria-label="FlushStore">
            <TituloBloco titulo="FlushStore" sub="Loja de pods em Unaí" acao={<Estado tom="ok">Operando</Estado>} />
            <dl className="ini-dia-numeros dr-proj-num">
              <div className="ini-dia-principal"><dt>Faturamento hoje</dt><dd><Valor valor={flush.faturamento} tamanho="g" centavos={false} /></dd></div>
              <div><dt>Lucro</dt><dd><Valor valor={flush.lucro} tamanho="m" centavos={false} /></dd></div>
            </dl>
            <Sparkline className="dr-proj-spark" valores={flush.semana.map((d) => d.valor)} rotulo={`Faturamento dos últimos 7 dias: ${flush.semana.map((d) => moneyBRL(d.valor)).join(", ")}`} />
            <Linhas linhas={flush.saude} />
            <Link to="/negocios" className="ini-link-rodape">Ver os negócios <SetaCirculo /></Link>
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 4, "--ini-cm": 1 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="vape-mania" aria-label="Vape Mania">
            <TituloBloco titulo="Vape Mania" sub="Só a saúde do sistema" acao={<Estado tom="ok">No ar</Estado>} />
            <Linhas linhas={vapeMania.saude} />
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 3, "--ini-cm": 1 } as CSSProperties}>
          <Bloco className="dr-proj" data-proj="drend" aria-label="DREND">
            <TituloBloco titulo="DREND" sub="Este painel" acao={<Estado tom="acento">{drendStatus.fase}</Estado>} />
            <Linhas linhas={drendStatus.saude} />
          </Bloco>
        </div>

        <div className="ini-lugar" style={{ "--ini-cl": 7, "--ini-cm": 2 } as CSSProperties}>
          <Bloco className="ini-tl" aria-label="Agenda de hoje">
            <TituloBloco titulo="Agenda de hoje" />
            <ol className="ini-tl-lista">
              {agenda.map(([h, t], i) => (
                <li key={h} className="ini-tl-item" data-tipo={i === 0 ? "pedido" : i === 1 ? "venda" : "entrada"} style={{ "--i": i } as CSSProperties}>
                  <span className="ini-tl-link">
                    <time className="ini-tl-hora">{h}</time>
                    <span className="ini-tl-marca" aria-hidden="true"><CalendarDays size={14} strokeWidth={2} /></span>
                    <span className="ini-tl-texto"><small className="ini-tl-tipo">Google Agenda</small><strong>{t}</strong></span>
                  </span>
                </li>
              ))}
            </ol>
          </Bloco>
        </div>
        <div className="ini-lugar" style={{ "--ini-cl": 5, "--ini-cm": 2 } as CSSProperties}>
          <Bloco className="ini-mod ini-meta" aria-label="Meta do mês">
            <TituloBloco titulo="Meta do mês" sub={meta[0]} />
            <div className="ini-meta-corpo">
              <Anel fatias={[{ valor: meta[1] / 100, tom: "acento" }]} total={1} tamanho={124} espessura={13}>
                <strong className="ini-meta-pct">{meta[1]}%</strong>
                <small>feito</small>
              </Anel>
              <dl className="ini-meta-numeros">
                {metas.map(([nome, pct]) => (
                  <div key={nome}><dt>{nome}</dt><dd>{pct}%</dd></div>
                ))}
              </dl>
            </div>
          </Bloco>
        </div>
      </div>
    </>
  );
}
