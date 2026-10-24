// Envio dos avisos (Web Push) para os aparelhos inscritos. As chaves VAPID ficam só no servidor.
import webpush from "web-push";

export function pushPronto() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:raphaelkhevenn@gmail.com", pub, priv);
  return true;
}

/** Já avisado? Marca de uma vez: só quem conseguiu gravar a chave avisa (sem aviso em dobro). */
export async function marcar(db, chave) {
  const r = await fetch(`${db.url}/rest/v1/drend_avisado`, {
    method: "POST",
    headers: { ...db.cabecalhos, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ chave }),
  });
  if (!r.ok) return false;
  const linhas = await r.json();
  return Array.isArray(linhas) && linhas.length > 0;
}

/** Manda para todos os aparelhos; tira os que o navegador já descartou (404/410). */
export async function enviar(db, aviso) {
  if (!pushPronto()) return 0;
  const r = await fetch(`${db.url}/rest/v1/drend_push?select=endpoint,inscricao`, { headers: db.cabecalhos });
  if (!r.ok) return 0;
  const aparelhos = await r.json();
  let enviados = 0;
  await Promise.all(aparelhos.map(async (a) => {
    try {
      await webpush.sendNotification(a.inscricao, JSON.stringify(aviso), { TTL: 3600 });
      enviados++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        await fetch(`${db.url}/rest/v1/drend_push?endpoint=eq.${encodeURIComponent(a.endpoint)}`, { method: "DELETE", headers: db.cabecalhos });
      }
    }
  }));
  return enviados;
}
