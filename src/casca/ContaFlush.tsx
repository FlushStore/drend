import { useState, useSyncExternalStore } from "react";
import { Botao } from "@/design-system/Botao";
import { EMAIL_FLUSH, entrarNaFlush, iniciarFlush, lerEstado, ouvir, sairDaFlush } from "@/fontes/flush";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Liga a leitura da Flush com a conta de admin de lá. Só leitura; a sessão fica neste aparelho. */
export function ContaFlush() {
  iniciarFlush();
  const estado = useSyncExternalStore(ouvir, lerEstado, lerEstado);
  const [email, setEmail] = useState(EMAIL_FLUSH);
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (estado.fase === "carregando") return null;

  const doServidor = estado.fase !== "fora" && estado.resumo?.origem === "servidor" ? estado.resumo : null;
  if (estado.fase !== "fora" && !doServidor) {
    const erro = estado.fase === "erro";
    const quando = estado.resumo ? hora(estado.resumo.atualizadoEm) : null;
    return (
      <div className="dr-nuvem">
        <span className="cv2-conta-rotulo">FlushStore</span>
        <dl className="cv2-conta-dados">
          <div>
            <dt>Leitura</dt>
            <dd><i className="dr-ponto" data-tom={erro ? "alerta" : "ok"} aria-hidden="true" />{erro ? "Falhou na última tentativa" : "Ligada, só leitura"}</dd>
          </div>
          {quando && <div><dt>Atualizado</dt><dd>{quando}</dd></div>}
        </dl>
        <Botao variante="secundaria" largo onClick={() => void sairDaFlush()}>Desligar a Flush</Botao>
      </div>
    );
  }

  async function enviar() {
    setOcupado(true);
    setAviso(null);
    const erro = await entrarNaFlush(email, senha);
    setOcupado(false);
    if (erro) setAviso(erro);
    else setSenha("");
  }

  return (
    <form className="dr-nuvem" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <span className="cv2-conta-rotulo">Ligar a FlushStore · só leitura</span>
      {doServidor && <p className="dr-nuvem-aviso">Os números vêm do servidor, atualizados às {hora(doServidor.atualizadoEm)} (de hora em hora). Para ver ao vivo, ligue aqui.</p>}
      <label className="cos-entrada">
        <span className="cos-sr">E-mail de admin da Flush</span>
        <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="cos-entrada">
        <span className="cos-sr">Senha da Flush</span>
        <input type="password" autoComplete="off" placeholder="Senha do painel da Flush" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      {aviso && <p className="dr-nuvem-aviso" role="status">{aviso}</p>}
      <Botao type="submit" largo ocupado={ocupado} disabled={!senha}>Ligar</Botao>
    </form>
  );
}
