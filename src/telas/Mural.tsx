import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, History, Image, Link2, Megaphone, Mic, Plus, StickyNote, Undo2, type LucideIcon } from "lucide-react";
import { Aviso } from "@/design-system/Aviso";
import { Bloco } from "@/design-system/Bloco";
import { CampoDeBusca } from "@/design-system/CampoDeBusca";
import { useAviso } from "@/design-system/useAviso";
import { BotaoCirculo } from "@/design-system/BotaoCirculo";
import { Painel } from "@/design-system/Painel";
import { CabecalhoDeTela } from "@/design-system/CabecalhoDeTela";
import { FiltroDeLista } from "@/design-system/FiltroDeLista";
import { useTelaLarga } from "@/design-system/useTelaLarga";
import type { Card, CardKind } from "@/core/mural";
import { useStore } from "@/store";
import { EditarCartao } from "./EditarCartao";

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const TIPO: Record<CardKind, { rotulo: string; Icone: LucideIcon }> = {
  nota: { rotulo: "Nota", Icone: StickyNote },
  imagem: { rotulo: "Imagem", Icone: Image },
  link: { rotulo: "Link", Icone: Link2 },
  pdf: { rotulo: "PDF", Icone: FileText },
  audio: { rotulo: "Áudio", Icone: Mic },
  campanha: { rotulo: "Campanha", Icone: Megaphone },
};

const ALTURA = 120;
const QUEM = { rapha: "Você", drend: "DREND", claude: "Claude", chatgpt: "ChatGPT" } as const;

function Cartao({ c }: { c: Card }) {
  const { rotulo, Icone } = TIPO[c.kind];
  return (
    <>
      {c.kind === "imagem" && <span className="dr-cartao-capa cos-hachura" aria-hidden="true"><Image size={22} strokeWidth={1.5} /></span>}
      <span className="dr-cartao-tipo" data-tipo={c.kind}>
        <Icone size={13} strokeWidth={2} aria-hidden="true" />
        {rotulo}{c.source ? ` · ${c.source}` : ""}
      </span>
      <strong className="dr-cartao-titulo">{c.title}</strong>
      {c.body && <span className="dr-cartao-corpo">{c.body}</span>}
    </>
  );
}

export function Mural() {
  const { mural, executar, desfazer } = useStore();
  const largo = useTelaLarga();
  const [busca, setBusca] = useSearchParams();
  const quadros = Object.values(mural.state.boards);
  const [ativo, setAtivo] = useState(busca.get("quadro") ?? quadros[0]?.id ?? "");
  const quadro = mural.state.boards[ativo] ?? quadros[0];
  const cards = quadro ? mural.cardsOf(quadro.id) : [];
  const links = quadro ? mural.linksOf(quadro.id) : [];
  const historico = [...mural.log].reverse().slice(0, 12);
  const [verHistorico, setVerHistorico] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const { aviso, avisar, limpar } = useAviso();

  // Busca em todos os quadros: título, texto e origem.
  const achados = useMemo(() => {
    const t = normalizar(termo.trim());
    if (!t) return null;
    return Object.values(mural.state.cards).filter((c) => normalizar(`${c.title} ${c.body ?? ""} ${c.source ?? ""}`).includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, mural, mural.state]);

  function salvar(c: Card, titulo: string, texto: string) {
    executar({ type: "editCard", cardId: c.id, title: titulo, body: texto }, "rapha", `Editou “${titulo}”`);
    avisar("Cartão salvo", "sucesso", { rotulo: "Desfazer", aoTocar: () => desfazer() });
  }
  function apagar(c: Card) {
    executar({ type: "removeCard", cardId: c.id }, "rapha", `Apagou “${c.title}”`);
    avisar("Cartão apagado", "sucesso", { rotulo: "Desfazer", aoTocar: () => desfazer() });
  }

  // Arrastar: a posição muda só na tela; ao soltar vira um moveCard no log (dá para desfazer).
  const arrasto = useRef<{ id: string; dx: number; dy: number; x0: number; y0: number } | null>(null);
  const [fantasma, setFantasma] = useState<{ id: string; x: number; y: number } | null>(null);
  const pos = (c: Card) => (fantasma?.id === c.id ? fantasma : c);

  function inicio(e: PointerEvent<HTMLDivElement>, c: Card) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { id: c.id, dx: e.clientX - c.x, dy: e.clientY - c.y, x0: e.clientX, y0: e.clientY };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (a) setFantasma({ id: a.id, x: Math.max(0, e.clientX - a.dx), y: Math.max(0, e.clientY - a.dy) });
  }
  function soltar(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    arrasto.current = null;
    // Toque sem arrastar abre o cartão.
    if (a && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) {
      setFantasma(null);
      setAberto(a.id);
      return;
    }
    if (a && fantasma?.id === a.id) {
      const c = mural.state.cards[a.id];
      if (c && (c.x !== fantasma.x || c.y !== fantasma.y)) {
        executar({ type: "moveCard", cardId: a.id, x: Math.round(fantasma.x), y: Math.round(fantasma.y) }, "rapha", `Moveu “${c.title}”`);
      }
    }
    setFantasma(null);
  }

  function novaNota() {
    if (!quadro) return;
    const n = cards.length;
    executar(
      { type: "addCard", card: { id: `nota-${Date.now()}`, boardId: quadro.id, kind: "nota", title: "Nova nota", x: 40 + (n % 4) * 240, y: 40 + Math.floor(n / 4) * 170, w: 220 } },
      "rapha",
      `Criou uma nota em ${quadro.title}`,
    );
  }

  // Vindo do DREND com ?quadro=: abre o quadro recém-criado.
  useEffect(() => {
    const q = busca.get("quadro");
    if (!q) return;
    if (mural.state.boards[q]) setAtivo(q);
    setBusca({}, { replace: true });
  }, [busca, mural, setBusca]);

  // No iPhone a fileira de quadros rola de lado: o quadro aberto fica à vista.
  useEffect(() => {
    document.querySelector(".dr-mural-filtros [aria-checked='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [quadro?.id]);

  // "Nota no Mural" do +: chega com ?nova=1, cria a nota e limpa o endereço.
  useEffect(() => {
    if (busca.get("nova") !== "1") return;
    novaNota();
    setBusca({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const largura = Math.max(960, ...cards.map((c) => c.x + c.w + 40));
  const altura = Math.max(620, ...cards.map((c) => c.y + ALTURA + 160));
  const centro = (c: Card) => ({ x: pos(c).x + c.w / 2, y: pos(c).y + ALTURA / 2 });

  return (
    <>
      <CabecalhoDeTela titulo="Mural">
        <div className="dr-mural-acoes">
          <BotaoCirculo rotulo="Histórico" onClick={() => setVerHistorico(true)}><History size={18} strokeWidth={1.75} /></BotaoCirculo>
          <BotaoCirculo rotulo="Desfazer a última ação" onClick={() => desfazer()}><Undo2 size={18} strokeWidth={1.75} /></BotaoCirculo>
          <BotaoCirculo rotulo="Nova nota" tom="acento" onClick={novaNota} disabled={!quadro}><Plus size={18} strokeWidth={2} /></BotaoCirculo>
        </div>
      </CabecalhoDeTela>

      <CampoDeBusca className="dr-mural-busca" valor={termo} aoMudar={setTermo} rotulo="Buscar no Mural" />

      {!achados && <FiltroDeLista
        className="dr-mural-filtros"
        rotulo="Quadros"
        valor={quadro?.id ?? ""}
        aoMudar={setAtivo}
        opcoes={quadros.map((b) => ({ valor: b.id, rotulo: b.title }))}
      />}

      {achados ? (
        achados.length === 0 ? (
          <p className="dr-vazio dr-mural-nada">Nada no Mural com “{termo.trim()}”.</p>
        ) : (
          <ul className="dr-mural-lista" aria-label="Resultados da busca">
            {achados.map((c, i) => (
              <li key={c.id} style={{ "--i": i } as CSSProperties}>
                <button type="button" className="dr-cartao cos-bloco dr-cartao-botao" onClick={() => setAberto(c.id)}>
                  <small className="dr-lista-tipo">{mural.state.boards[c.boardId]?.title}</small>
                  <Cartao c={c} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : largo ? (
        <Bloco className="dr-canvas" aria-label="Canvas do quadro">
          <div className="dr-canvas-area" style={{ width: largura, height: altura }}>
            <svg className="dr-canvas-ligacoes" width={largura} height={altura} aria-hidden="true">
              {links.map((l) => {
                const a = mural.state.cards[l.from];
                const b = mural.state.cards[l.to];
                if (!a || !b) return null;
                const p = centro(a);
                const q = centro(b);
                return <line key={l.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
              })}
            </svg>
            {cards.map((c) => (
              <div
                key={c.id}
                className="dr-cartao cos-bloco"
                data-arrastando={fantasma?.id === c.id || undefined}
                style={{ left: pos(c).x, top: pos(c).y, width: c.w }}
                onPointerDown={(e) => inicio(e, c)}
                onPointerMove={mover}
                onPointerUp={soltar}
              >
                <Cartao c={c} />
              </div>
            ))}
          </div>
        </Bloco>
      ) : (
        <ul className="dr-mural-lista" aria-label="Cartões">
          {[...cards].sort((a, b) => a.y - b.y || a.x - b.x).map((c, i) => (
            <li key={c.id} style={{ "--i": i } as CSSProperties}>
              <button type="button" className="dr-cartao cos-bloco dr-cartao-botao" onClick={() => setAberto(c.id)}><Cartao c={c} /></button>
            </li>
          ))}
        </ul>
      )}

      <EditarCartao cartao={aberto ? mural.state.cards[aberto] ?? null : null} aoFechar={() => setAberto(null)} aoSalvar={salvar} aoApagar={apagar} />
      <Aviso aviso={aviso} aoSumir={limpar} />

      <Painel aberto={verHistorico} aoFechar={() => setVerHistorico(false)} titulo="Histórico">
        {historico.length === 0 ? (
          <p className="ini-vazio-bloco cos-hachura">Nada mudou ainda.</p>
        ) : (
          <ol className="dr-historico">
            {historico.map((e) => (
              <li key={e.id} data-desfeito={e.undone || undefined}>
                <span>{e.summary}</span>
                <small>{QUEM[e.actor]} · {new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
              </li>
            ))}
          </ol>
        )}
      </Painel>
    </>
  );
}
