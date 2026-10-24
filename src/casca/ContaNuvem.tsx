import { useState } from "react";
import { Botao } from "@/design-system/Botao";
import { useStore, type Sincronia } from "@/store";

const ROTULO: Record<Sincronia, string> = {
  "sem-banco": "Só neste aparelho",
  fora: "Só neste aparelho",
  sincronizando: "Sincronizando…",
  ok: "Sincronizado",
  erro: "Sem conexão com o banco",
};

/** Entrar no banco do DREND: com login, o mural e as ideias aparecem iguais no iPhone e no PC. */
export function ContaNuvem() {
  const { sincronia, email, entrar, criarAcesso, sair } = useStore();
  const [campoEmail, setCampoEmail] = useState("raphaelkhevenn@gmail.com");
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (sincronia === "sem-banco") return null;

  if (email) {
    return (
      <div className="dr-nuvem">
        <dl className="cv2-conta-dados">
          <div><dt>Banco</dt><dd><i className="dr-ponto" data-tom={sincronia === "erro" ? "alerta" : "ok"} aria-hidden="true" />{ROTULO[sincronia]}</dd></div>
          <div><dt>Conta</dt><dd>{email}</dd></div>
        </dl>
        <Botao variante="secundaria" largo onClick={sair}>Sair</Botao>
      </div>
    );
  }

  async function enviar(acao: typeof entrar) {
    setOcupado(true);
    setAviso(null);
    const erro = await acao(campoEmail, senha);
    setOcupado(false);
    if (erro) setAviso(erro);
    else if (acao === criarAcesso) setAviso("Mandei um e-mail de confirmação. Confirme e depois toque em Entrar.");
  }

  return (
    <form className="dr-nuvem" onSubmit={(e) => { e.preventDefault(); void enviar(entrar); }}>
      <span className="cv2-conta-rotulo">Entre para ver o mesmo DREND no iPhone e no PC</span>
      <label className="cos-entrada">
        <span className="cos-sr">E-mail</span>
        <input type="email" autoComplete="username" value={campoEmail} onChange={(e) => setCampoEmail(e.target.value)} />
      </label>
      <label className="cos-entrada">
        <span className="cos-sr">Senha</span>
        <input type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      {aviso && <p className="dr-nuvem-aviso" role="status">{aviso}</p>}
      <Botao type="submit" largo ocupado={ocupado} disabled={!senha}>Entrar</Botao>
      <Botao variante="fantasma" largo disabled={ocupado || senha.length < 8} onClick={() => void enviar(criarAcesso)}>Primeira vez? Criar acesso</Botao>
    </form>
  );
}
