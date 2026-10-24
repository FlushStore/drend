import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Busca, type GrupoDaBusca } from "@/design-system/Busca";
import { BotaoCirculo } from "@/design-system/BotaoCirculo";
import { buscar, daAgenda, dasMissoes, dasTarefas, doMural, type Achado, type Destino, type Parte } from "@/core/busca";
import { eventosDa, useAgenda } from "@/fontes/agenda";
import { useMissoes } from "@/fontes/missoes";
import { useStore } from "@/store";

function Marcado({ partes }: { partes: Parte[] }) {
  return <>{partes.map((p, i) => (p.marca ? <mark key={i} className="dr-busca-marca">{p.t}</mark> : <span key={i}>{p.t}</span>))}</>;
}

const porTexto = (seletor: string, sub: string, texto: string, dentro: ParentNode = document) =>
  [...dentro.querySelectorAll<HTMLElement>(seletor)].find((el) => el.querySelector(sub)?.textContent?.trim() === texto) ?? null;

/** Espera o item aparecer na tela nova (até ~1,5 s), rola até ele, foca e acende por um instante. */
function realcar(achar: () => HTMLElement | null) {
  let tentativas = 0;
  const tentar = () => {
    const el = achar();
    if (!el) {
      if (++tentativas < 90) requestAnimationFrame(tentar);
      return;
    }
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduzido ? "auto" : "smooth" });
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.setAttribute("data-dr-achado", "");
    setTimeout(() => el.removeAttribute("data-dr-achado"), 2400);
  };
  // Depois que o diálogo fechou e devolveu o foco: o foco fica no item, não no botão da lupa.
  setTimeout(() => requestAnimationFrame(tentar), 60);
}

function irPara(d: Destino, navigate: ReturnType<typeof useNavigate>, titulo: string) {
  switch (d.tela) {
    case "hoje":
      navigate("/");
      return realcar(() => porTexto(".dr-tarefa", ".dr-tarefa-texto", titulo));
    case "mural":
      return navigate(`/mural?cartao=${encodeURIComponent(d.cartao)}`);
    case "missoes":
      navigate("/missoes");
      return realcar(() => {
        const bloco = porTexto(".dr-missao", ".dr-proj-nome", d.projeto);
        if (!bloco || !d.item) return bloco;
        return porTexto(".dr-mi", ".dr-mi-titulo", d.item, bloco) ?? bloco;
      });
    case "vida": {
      const c = d.compromisso;
      navigate("/vida");
      return realcar(() =>
        [...document.querySelectorAll<HTMLElement>(".dr-dia-lista li")].find(
          (li) => li.querySelector("time")?.getAttribute("dateTime") === c.inicio && li.textContent?.includes(c.titulo),
        ) ?? null,
      );
    }
  }
}

/**
 * Busca em tudo (⌘K / Ctrl+K, ou a lupa do topo): tarefas, cartões do Mural, missões e agenda.
 * Só procura no que já está carregado no app; escolher leva à tela do item e o acende.
 */
export function BuscaGeral() {
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const { tarefas, mural, versao } = useStore();
  const missoes = useMissoes();
  const agenda = useAgenda();
  const navigate = useNavigate();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((a) => !a);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const eventos = missoes.fase === "ok" ? missoes.eventos : null;
  const compromissos = eventosDa(agenda);
  const itens = useMemo(
    () => (aberto ? [...dasTarefas(tarefas), ...doMural(mural.state), ...(eventos ? dasMissoes(eventos) : []), ...(compromissos ? daAgenda(compromissos) : [])] : []),
    // `versao` muda a cada operação do Mural (o objeto `mural` é o mesmo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aberto, tarefas, mural, versao, eventos, compromissos],
  );
  const achados = useMemo(() => buscar(itens, consulta), [itens, consulta]);

  const grupos: GrupoDaBusca[] = achados.map((g) => ({
    id: g.tipo,
    titulo: g.titulo,
    resultados: g.achados.map((a: Achado) => ({
      id: a.id,
      titulo: a.titulo,
      tituloRico: <Marcado partes={a.tituloMarcado} />,
      subtitulo: a.trecho ? <>{a.apoio && <>{a.apoio} · </>}<Marcado partes={a.trecho} /></> : a.apoio,
      aoEscolher: () => irPara(a.destino, navigate, a.titulo),
    })),
  }));

  const termo = consulta.trim();
  const faltam = [!eventos && "as Missões", !compromissos && "a agenda"].filter(Boolean);
  const nota = faltam.length ? ` (${faltam.join(" e ")} ainda não ${faltam.length > 1 ? "estão lidas" : "está lida"}.)` : "";
  const textoVazio = termo ? `Nada com «${termo}».${nota}` : `Busque em tarefas, Mural, Missões e agenda.${nota}`;

  return (
    <>
      <BotaoCirculo rotulo="Buscar em tudo" title="Buscar em tudo (⌘K)" aria-keyshortcuts="Meta+K Control+K" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto(true)}>
        <Search size={18} strokeWidth={1.75} />
      </BotaoCirculo>
      <Busca
        aberto={aberto}
        aoFechar={() => { setAberto(false); setConsulta(""); }}
        grupos={grupos}
        consulta={consulta}
        aoMudarConsulta={setConsulta}
        filtrar={false}
        placeholder="Buscar tarefas, Mural, Missões, agenda"
        textoVazio={textoVazio}
        rotulo="Buscar em tudo"
      />
    </>
  );
}
