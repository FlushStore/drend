import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Briefcase, Heart, LayoutGrid, Lightbulb, MessageCircle, Plus, StickyNote, Sun } from "lucide-react";
import { AbasTopo } from "@/design-system/AbasTopo";
import { BotaoCirculo } from "@/design-system/BotaoCirculo";
import { Doca } from "@/design-system/Doca";
import { MenuMais, type SecaoDoMenu } from "@/design-system/MenuMais";
import { Painel } from "@/design-system/Painel";
import { Segmentado } from "@/design-system/Segmentado";
import { MOLA_ICONE, transicao, useMovimentoReduzido } from "@/design-system/movimento";
import type { ItemDeNavegacao } from "@/design-system/navegacao";
import { useTelaLarga } from "@/design-system/useTelaLarga";
import { EXEMPLO } from "@/data/exemplo";
import { useStore } from "@/store";
import { ContaFlush } from "./ContaFlush";
import { ContaNuvem } from "./ContaNuvem";
import { DrendChat } from "./DrendChat";
import { useTema, type Tema } from "./tema";
import "@/design-system/tokens.css";
import "@/design-system/base.css";
import "./casca-v2.css";
import "./fundo-v2.css";
import "./inicio.css";
import "./inicio-blocos.css";
import "./grafico-de-vendas.css";
import "./drend.css";

const ITENS: ReadonlyArray<ItemDeNavegacao> = [
  { id: "hoje", rotulo: "Hoje", para: "/", Icone: Sun },
  { id: "negocios", rotulo: "Negócios", para: "/negocios", Icone: Briefcase },
  { id: "mural", rotulo: "Mural", para: "/mural", Icone: LayoutGrid },
  { id: "vida", rotulo: "Vida", para: "/vida", Icone: Heart },
];

const TEMAS = [
  { valor: "sistema", rotulo: "Automático" },
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
] as const;

function ativoDe(pathname: string): string | null {
  if (pathname === "/") return "hoje";
  return ITENS.find((i) => i.para !== "/" && pathname.startsWith(i.para))?.id ?? null;
}

/**
 * A casca do DREND é a do painel da Flush (Control OS): no PC, moldura arredondada com abas
 * no topo; no iPhone, tela cheia com a doca flutuante e o + no meio. O + abre o DREND.
 */
export function Casca() {
  const { tema, escolher } = useTema();
  const largo = useTelaLarga();
  const reduzido = useMovimentoReduzido();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { caixaDeEntrada } = useStore();
  const [menu, setMenu] = useState(false);
  const [conversa, setConversa] = useState(false);
  const [conta, setConta] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("cv2-ativo");
    return () => document.documentElement.classList.remove("cv2-ativo");
  }, []);

  // No iPhone a conversa é uma tela; no PC abre pela direita sem sair de onde se está.
  const abrirConversa = useCallback(() => {
    if (largo) setConversa(true);
    else navigate("/drend");
  }, [largo, navigate]);

  const itens = useMemo(
    () => ITENS.map((i) => (i.id === "mural" && caixaDeEntrada.length > 0 ? { ...i, pendentes: caixaDeEntrada.length } : i)),
    [caixaDeEntrada.length],
  );

  const secoes: SecaoDoMenu[] = [
    {
      id: "drend",
      titulo: "DREND",
      acoes: [
        { id: "falar", rotulo: "Falar com o DREND", Icone: MessageCircle, destaque: true, aoEscolher: abrirConversa },
        { id: "ideia", rotulo: "Tive uma ideia", Icone: Lightbulb, aoEscolher: abrirConversa },
        { id: "nota", rotulo: "Nota no Mural", Icone: StickyNote, aoEscolher: () => navigate("/mural?nova=1") },
      ],
    },
  ];

  return (
    <div className="cos-raiz cv2-raiz">
      <div className="cv2-moldura">
        <header className="cv2-topo">
          <Link to="/" className="cv2-marca" aria-label="DREND, ir para Hoje">
            <span className="dr-marca-d" aria-hidden="true">D</span>
            <span className="cv2-marca-nome" aria-hidden="true">DREND</span>
            <span className="cv2-marca-sub" title={EXEMPLO ? "Dados de exemplo: nenhuma integração ligada ainda" : undefined}>{EXEMPLO ? "Exemplo" : "Pessoal"}</span>
          </Link>
          {largo && <AbasTopo itens={itens} ativo={ativoDe(pathname)} />}
          <div className="cv2-topo-acoes">
            {largo && (
              <div className="cv2-mais-ancora">
                <BotaoCirculo rotulo="Ações do DREND" tom="acento" aria-expanded={menu} aria-haspopup="dialog" onClick={() => setMenu((m) => !m)}>
                  <motion.span className="cos-icone" animate={{ rotate: menu ? 45 : 0 }} transition={transicao(reduzido, MOLA_ICONE)}>
                    <Plus size={20} strokeWidth={2} />
                  </motion.span>
                </BotaoCirculo>
                <MenuMais aberto={menu} aoFechar={() => setMenu(false)} origem="topo" secoes={secoes} />
              </div>
            )}
            <button type="button" className="cv2-conta" onClick={() => setConta(true)} aria-label="Sua conta e aparência">
              <span aria-hidden="true">R</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="cv2-conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {!largo && (
        <>
          <MenuMais aberto={menu} aoFechar={() => setMenu(false)} origem="doca" secoes={secoes} />
          <Doca itens={itens} ativo={ativoDe(pathname)} mais={{ aberto: menu, aoAlternar: () => setMenu((m) => !m), rotulo: "Ações do DREND" }} />
        </>
      )}

      <Painel aberto={conversa} aoFechar={() => setConversa(false)} titulo="DREND" lado="direita">
        <DrendChat aoAbrirMural={(q) => { setConversa(false); navigate(q ? `/mural?quadro=${q}` : "/mural"); }} />
      </Painel>

      <Painel aberto={conta} aoFechar={() => setConta(false)} titulo="Sua conta">
        <div className="cv2-conta-corpo">
          <dl className="cv2-conta-dados">
            <div><dt>Nome</dt><dd>Raphael Khevenn</dd></div>
            <div><dt>Uso</dt><dd>Só você. Ninguém da equipe vê este painel.</dd></div>
          </dl>
          <ContaNuvem />
          <ContaFlush />
          <div className="cv2-conta-tema">
            <span className="cv2-conta-rotulo">Aparência</span>
            <Segmentado<Tema> opcoes={TEMAS} valor={tema} aoMudar={escolher} rotulo="Aparência" />
          </div>
        </div>
      </Painel>
    </div>
  );
}
