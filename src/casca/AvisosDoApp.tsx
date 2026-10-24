import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

const MEIA_HORA = 30 * 60 * 1000;

/** Há uma publicação mais nova que a aberta? Pergunta ao voltar para o app e a cada meia hora. */
function useVersaoNova() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let ultima = 0;
    async function conferir() {
      if (Date.now() - ultima < 60_000) return;
      ultima = Date.now();
      try {
        const r = await fetch("/versao.json", { cache: "no-store" });
        if (!r.ok) return;
        const { versao } = (await r.json()) as { versao?: string };
        if (versao && versao !== __VERSAO__) setNova(true);
      } catch { /* sem internet: confere na próxima */ }
    }
    const aoVoltar = () => document.visibilityState === "visible" && void conferir();
    document.addEventListener("visibilitychange", aoVoltar);
    const relogio = window.setInterval(conferir, MEIA_HORA);
    void conferir();
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(relogio);
    };
  }, []);
  return nova;
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const sim = () => setOnline(true);
    const nao = () => setOnline(false);
    window.addEventListener("online", sim);
    window.addEventListener("offline", nao);
    return () => {
      window.removeEventListener("online", sim);
      window.removeEventListener("offline", nao);
    };
  }, []);
  return online;
}

/** Duas faixas discretas no topo: sem internet, e versão nova para atualizar. */
export function AvisosDoApp() {
  const nova = useVersaoNova();
  const online = useOnline();
  if (online && !nova) return null;
  return (
    <div className="dr-faixas" role="status">
      {!online && (
        <span className="dr-faixa"><WifiOff size={14} strokeWidth={2} aria-hidden="true" />Sem internet. Mostrando o que está salvo.</span>
      )}
      {online && nova && (
        <button type="button" className="dr-faixa dr-faixa-acao" onClick={() => window.location.reload()}>
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />Versão nova do DREND. <strong>Atualizar</strong>
        </button>
      )}
    </div>
  );
}
