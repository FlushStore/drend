/**
 * Uma loja que o DREND lê (hoje, a Flush). Cada uma tem o próprio projeto Supabase,
 * entra com a conta de admin de lá e guarda a sessão só neste aparelho. O DREND SÓ LÊ:
 * nenhum insert, update, delete ou RPC que grava. Aqui fica o que é igual para todas:
 * estado, cache do último resumo, login e a atualização ao voltar para o app.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DiaLoja {
  dia: string;
  valor: number;
  lucro: number;
  pedidos: number;
}

export interface ResumoLoja {
  dias: DiaLoja[];
  atualizadoEm: string;
  /** Vendas registradas desde sempre (só quando a loja informa). 0 = ainda não abriu. */
  totalVendas?: number;
}

export type EstadoLoja =
  | { fase: "carregando" }
  | { fase: "fora" }
  | { fase: "erro"; mensagem: string; resumo: ResumoLoja | null }
  | { fase: "ok"; resumo: ResumoLoja; atualizando: boolean };

export interface ConfigLoja {
  /** Nome que aparece nas mensagens: "Flush". */
  nome: string;
  url: string;
  chave: string;
  /** Onde a sessão fica no aparelho. */
  sessao: string;
  /** Onde o último resumo fica no aparelho (abre com número mesmo sem internet). */
  cache: string;
  buscar: (db: SupabaseClient, agora: Date) => Promise<ResumoLoja>;
}

export interface FonteLoja {
  lerEstado: () => EstadoLoja;
  ouvir: (f: () => void) => () => void;
  atualizar: () => Promise<void>;
  iniciar: () => void;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  /** Para a leitura: cria o cliente na primeira vez. */
  db: () => SupabaseClient;
}

export function criarFonte(cfg: ConfigLoja): FonteLoja {
  let cliente: SupabaseClient | null = null;
  const db = () => (cliente ??= createClient(cfg.url, cfg.chave, { auth: { persistSession: true, storageKey: cfg.sessao } }));

  let estado: EstadoLoja = { fase: "carregando" };
  // Sobe a cada desligar: uma leitura que termina depois disso é descartada.
  let geracao = 0;
  const ouvintes = new Set<() => void>();
  function mudar(novo: EstadoLoja) {
    estado = novo;
    ouvintes.forEach((f) => f());
  }

  function guardado(): ResumoLoja | null {
    try {
      const r = JSON.parse(localStorage.getItem(cfg.cache) || "null") as ResumoLoja | null;
      return r && Array.isArray(r.dias) ? r : null;
    } catch {
      return null;
    }
  }
  function guardar(r: ResumoLoja | null) {
    try {
      if (r) localStorage.setItem(cfg.cache, JSON.stringify(r));
      else localStorage.removeItem(cfg.cache);
    } catch { /* sem armazenamento: segue sem cache */ }
  }

  async function atualizar() {
    const minha = geracao;
    const anterior = estado.fase === "ok" || estado.fase === "erro" ? estado.resumo : guardado();
    if (anterior) mudar({ fase: "ok", resumo: anterior, atualizando: true });
    try {
      const resumo = await cfg.buscar(db(), new Date());
      if (minha !== geracao) return;
      guardar(resumo);
      mudar({ fase: "ok", resumo, atualizando: false });
    } catch (e) {
      if (minha !== geracao) return;
      mudar({ fase: "erro", mensagem: e instanceof Error ? e.message : `Falha ao ler a ${cfg.nome}`, resumo: anterior });
    }
  }

  let iniciado = false;
  /** Liga a leitura uma vez: se já há sessão desta loja no aparelho, busca os números. */
  function iniciar() {
    if (iniciado || typeof window === "undefined") return;
    iniciado = true;
    const salvo = guardado();
    void db().auth.getSession().then(({ data }) => {
      if (!data.session) {
        guardar(null);
        mudar({ fase: "fora" });
        return;
      }
      if (salvo) mudar({ fase: "ok", resumo: salvo, atualizando: true });
      void atualizar();
    });
    // Volta para o app (iPhone): números frescos, no máximo a cada 2 minutos.
    let ultima = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || estado.fase === "fora" || Date.now() - ultima < 120_000) return;
      ultima = Date.now();
      void atualizar();
    });
  }

  /** Entra com a conta de admin da loja. Devolve a mensagem de erro, ou null. */
  async function entrar(email: string, senha: string): Promise<string | null> {
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) return error.message === "Invalid login credentials" ? `E-mail ou senha da ${cfg.nome} errados.` : error.message;
    const { data: admin, error: erroAdmin } = await db().rpc("is_admin");
    if (erroAdmin || admin !== true) {
      await db().auth.signOut();
      return `Essa conta não é admin da ${cfg.nome}.`;
    }
    await atualizar();
    return null;
  }

  async function sair() {
    geracao++;
    await db().auth.signOut();
    guardar(null);
    mudar({ fase: "fora" });
  }

  return {
    lerEstado: () => estado,
    ouvir(f) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    atualizar,
    iniciar,
    entrar,
    sair,
    db,
  };
}
