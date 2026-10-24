/**
 * Avisos no iPhone (Web Push). No iPhone só funciona no app aberto pelo ícone da Tela de Início
 * (iOS 16.4+). A inscrição vai para o servidor do DREND com o login do Rapha.
 */
import { supabase } from "@/core/nuvem";

export type EstadoAvisos = "sem-suporte" | "fora-do-app" | "negado" | "desligado" | "ligado";

const noApp = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function estadoDosAvisos(): Promise<EstadoAvisos> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return noApp() ? "sem-suporte" : "fora-do-app";
  if (Notification.permission === "denied") return "negado";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "ligado" : "desligado";
}

function chaveEmBytes(base64: string): Uint8Array {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function token(): Promise<string> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const t = data.session?.access_token;
  if (!t) throw new Error("Entre na sua conta do DREND primeiro.");
  return t;
}

/** Pede a permissão, inscreve este aparelho e manda um aviso de teste. Devolve o erro, ou null. */
export async function ligarAvisos(): Promise<string | null> {
  try {
    const t = await token();
    if ((await Notification.requestPermission()) !== "granted") return "Os avisos foram recusados. Dá para liberar em Ajustes → Notificações → DREND.";
    const r = await fetch("/api/avisos?chave=1");
    if (!r.ok) return "Os avisos ainda não estão configurados no servidor.";
    const { chave } = (await r.json()) as { chave: string };
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) }));
    const ok = await fetch("/api/avisos", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ inscricao: sub.toJSON(), teste: true }) });
    return ok.ok ? null : "Não consegui guardar a inscrição. Tente de novo.";
  } catch (e) {
    return e instanceof Error ? e.message : "Não consegui ligar os avisos.";
  }
}

export async function desligarAvisos(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try {
    const t = await token();
    await fetch("/api/avisos", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  } finally {
    await sub.unsubscribe();
  }
}
