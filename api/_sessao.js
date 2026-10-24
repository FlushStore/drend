// O que as rotas do DREND usam em comum: quem é o dono, a sessão dele e o banco (servidor).
export const DONO = "raphaelkhevenn@gmail.com";

/** O e-mail da sessão, conferido no Supabase do DREND. null se o token não vale. */
export async function quemE(token) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !token) return null;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u.email === "string" ? u.email.toLowerCase() : null;
}

/** REST do Supabase do DREND com a chave de serviço (nunca vai para o navegador). */
export function banco() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && chave ? { url, cabecalhos: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" } } : null;
}
