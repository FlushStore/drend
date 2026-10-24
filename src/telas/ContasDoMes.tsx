import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Valor } from "@/design-system/Valor";
import { Botao } from "@/design-system/Botao";
import { CampoDeDinheiro } from "@/design-system/CampoDeDinheiro";
import type { useAviso } from "@/design-system/useAviso";
import { lerValorBR } from "@/lib/valor-br";
import { contasDoMes, pagamentoDoMes, textoDoEstado, totaisDoMes, type Conta, type ContaLida, type ContaNoMes } from "@/core/contas";
import { meioDiaEmBrasilia } from "@/core/brasilia";
import { useStore } from "@/store";

type Avisar = ReturnType<typeof useAviso>["avisar"];

const paraCampo = (v: number | null) => (v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const nomeDoMes = (hoje: string) => {
  const m = new Date(`${hoje.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long" });
  return m.charAt(0).toUpperCase() + m.slice(1);
};

/**
 * Contas do mês: as contas fixas que o Rapha cadastrou e se já foram pagas neste mês.
 * Um toque no círculo marca paga (e lança o gasto no Dinheiro); tocar no nome edita.
 * Sem conta cadastrada, o bloco ensina a cadastrar: nada de exemplo.
 */
export function ContasDoMes({ hoje, avisar }: { hoje: string; avisar: Avisar }) {
  const { contas, criarConta, editarConta, apagarConta, restaurarConta, pagarConta, desfazerPagamento, restaurarPagamento } = useStore();
  const [editando, setEditando] = useState<string | null>(null);
  const agora = meioDiaEmBrasilia(hoje);
  const mes = hoje.slice(0, 7);
  const itens = contasDoMes(contas, agora);
  const pausadas = contas.filter((c) => !c.ativa && !pagamentoDoMes(c, mes));
  const t = totaisDoMes(itens);

  function alternar(i: ContaNoMes) {
    const c = i.conta;
    if (i.pagamento) {
      const tirado = desfazerPagamento(c.id, mes);
      if (tirado) avisar(`${c.nome} voltou para a pagar`, "sucesso", { rotulo: "Desfazer", aoTocar: () => restaurarPagamento(c.id, tirado.pagamento, tirado.lancamento) });
      return;
    }
    const p = pagarConta(c.id);
    if (p) avisar(p.lancamento ? `${c.nome} paga · gasto lançado` : `${c.nome} paga`, "sucesso", { rotulo: "Desfazer", aoTocar: () => desfazerPagamento(c.id, p.mes) });
  }

  function apagar(c: Conta) {
    apagarConta(c.id);
    setEditando(null);
    avisar(`Conta “${c.nome}” apagada`, "sucesso", { rotulo: "Desfazer", aoTocar: () => restaurarConta(c) });
  }

  function linha(c: Conta, i: ContaNoMes | null) {
    if (editando === c.id) {
      return (
        <li key={c.id} className="dr-contas-editar">
          <FormDeConta
            inicial={c}
            rotulo="Salvar"
            aoSalvar={(lida, ativa) => {
              editarConta(c.id, { ...lida, ativa });
              setEditando(null);
              avisar(`Conta “${lida.nome}” atualizada`, "sucesso", { rotulo: "Desfazer", aoTocar: () => restaurarConta(c) });
              return true;
            }}
            aoCancelar={() => setEditando(null)}
            aoApagar={() => apagar(c)}
          />
        </li>
      );
    }
    const paga = i?.estado === "paga";
    const dia = i ? Number(i.vence.slice(8, 10)) : c.dia;
    return (
      <li key={c.id} className="dr-lista-item dr-contas-item" data-estado={i?.estado ?? "pausada"}>
        <button
          type="button"
          className="dr-tarefa-check"
          data-feito={paga || undefined}
          aria-pressed={paga}
          disabled={!i}
          aria-label={paga ? `Desmarcar: ${c.nome} paga` : `Marcar paga: ${c.nome}`}
          onClick={() => i && alternar(i)}
        >
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span className="dr-tarefa-texto dr-contas-nome">
          {c.nome}
          <small className="dr-contas-estado" data-estado={i?.estado ?? "pausada"}>{i ? textoDoEstado(i) : "Pausada"} · dia {dia}</small>
        </span>
        <span className="dr-vida-valor">
          {(i?.valor ?? c.valor) !== null ? <Valor valor={(i?.valor ?? c.valor) as number} tamanho="p" /> : <small className="dr-vida-n">sem valor</small>}
          <button type="button" className="dr-vida-apagar dr-contas-editar-botao" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c.id)}>
            <Pencil size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </span>
      </li>
    );
  }

  return (
    <section className="cos-bloco dr-vida-bloco" aria-labelledby="dr-vida-contas">
      <h2 id="dr-vida-contas" className="dr-rotulo">Contas · {nomeDoMes(hoje)} {t.abertas > 0 && <span className="dr-conta" aria-label={`${t.abertas} a pagar`}>{t.abertas}</span>}</h2>
      {contas.length === 0 ? (
        <p className="dr-vazio">Nenhuma conta fixa ainda. Cadastre aqui embaixo ou diga no chat: “conta de luz todo dia 10, 200 reais”.</p>
      ) : (
        <>
          {itens.length > 0 && (
            <div className="dr-vida-saldo">
              <span className="dr-contas-falta-rotulo">{t.abertas ? "Falta pagar" : "Tudo pago"}</span>
              <Valor valor={t.abertas ? t.falta : t.pago} tamanho="g" animar />
              <p className="dr-vida-saldo-partes">
                <span>No mês <Valor valor={t.total} tamanho="p" /></span>
                <span>Pago <Valor valor={t.pago} tamanho="p" /></span>
                {t.semValor > 0 && <span>{t.semValor === 1 ? "1 sem valor" : `${t.semValor} sem valor`}</span>}
              </p>
            </div>
          )}
          <ul className="dr-lista">
            {itens.map((i) => linha(i.conta, i))}
            {pausadas.map((c) => linha(c, null))}
          </ul>
        </>
      )}
      <FormDeConta
        rotulo="Adicionar"
        aoSalvar={(lida) => {
          const nova = criarConta(lida);
          if (!nova) {
            avisar(`Já existe a conta “${lida.nome}”`, "erro");
            return false;
          }
          avisar(`Conta “${nova.nome}” cadastrada`, "sucesso", { rotulo: "Desfazer", aoTocar: () => apagarConta(nova.id) });
          return true;
        }}
      />
      {contas.length > 0 && <p className="dr-vida-dica">No chat: “paguei a luz” marca paga; “quais contas vencem?” mostra o mês.</p>}
    </section>
  );
}

/** Nome, dia e valor. Serve para cadastrar (embaixo da lista) e para editar (no lugar da linha). */
function FormDeConta({ inicial, rotulo, aoSalvar, aoCancelar, aoApagar }: {
  inicial?: Conta;
  rotulo: string;
  /** Devolve `false` quando não salvou (o formulário fica como está). */
  aoSalvar: (c: ContaLida, ativa: boolean) => boolean;
  aoCancelar?: () => void;
  aoApagar?: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : "");
  const [valor, setValor] = useState(paraCampo(inicial?.valor ?? null));
  const [ativa, setAtiva] = useState(inicial?.ativa ?? true);
  const [erro, setErro] = useState("");
  const novo = !inicial;

  function enviar(e: FormEvent) {
    e.preventDefault();
    const n = Number(dia);
    if (!nome.trim()) return setErro("Diga o nome da conta.");
    if (!Number.isInteger(n) || n < 1 || n > 31) return setErro("O dia vai de 1 a 31.");
    const v = lerValorBR(valor);
    if (aoSalvar({ nome: nome.trim(), dia: n, valor: v && v > 0 ? v : null }, ativa) && novo) {
      setNome("");
      setDia("");
      setValor("");
    }
    setErro("");
  }

  return (
    <form className={novo ? "dr-contas-form dr-contas-nova" : "dr-contas-form"} onSubmit={enviar} noValidate>
      <div className="dr-contas-campos">
        <label className="cos-entrada dr-contas-campo-nome">
          <span className="cos-sr">Nome da conta</span>
          {novo && <Plus size={16} strokeWidth={2} aria-hidden="true" />}
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={novo ? "Nova conta" : "Nome"} autoFocus={!novo} enterKeyHint="next" />
        </label>
        <label className="cos-entrada dr-contas-campo-dia">
          <span>Dia</span>
          <input value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="10" aria-label="Dia do vencimento" />
        </label>
        <label className="cos-entrada dr-contas-campo-valor">
          <span>R$</span>
          <CampoDeDinheiro valor={valor} aoMudar={setValor} aria-label="Valor (opcional)" />
        </label>
      </div>
      {erro && <p className="dr-contas-erro" role="alert">{erro}</p>}
      <div className="dr-contas-acoes">
        {!novo && (
          <label className="dr-contas-ativa">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa
          </label>
        )}
        {aoApagar && (
          <button type="button" className="dr-vida-apagar" aria-label="Apagar conta" onClick={aoApagar}>
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        {aoCancelar && <Botao variante="fantasma" compacto onClick={aoCancelar}>Cancelar</Botao>}
        <Botao type="submit" variante={novo ? "secundaria" : "primaria"} compacto>{rotulo}</Botao>
      </div>
    </form>
  );
}
