// Aplica as migrações de supabase/migrations no banco do DREND no deploy de PRODUÇÃO da Vercel.
// Decisão do Rapha (24/10/2026): o merge na main é o ok dele para mudar o banco.
// As prévias de PR usam o mesmo banco e nunca o alteram. Cada arquivo roda uma vez
// (tabela drend_migracoes), numa transação: se falhar, nada muda e o deploy para.
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (process.env.VERCEL_ENV !== "production" || !url) {
  console.log(`[migrar] pulado (ambiente: ${process.env.VERCEL_ENV ?? "local"}${url ? "" : ", sem banco"})`);
  process.exit(0);
}

const semSslmode = url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
const db = new pg.Client({ connectionString: semSslmode, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query("create table if not exists public.drend_migracoes (nome text primary key, aplicada_em timestamptz not null default now())");
  await db.query("alter table public.drend_migracoes enable row level security");
  const feitas = new Set((await db.query("select nome from public.drend_migracoes")).rows.map((r) => r.nome));
  const pasta = new URL("../supabase/migrations/", import.meta.url);
  const arquivos = (await readdir(pasta)).filter((a) => a.endsWith(".sql")).sort();
  for (const nome of arquivos) {
    if (feitas.has(nome)) continue;
    const sql = await readFile(new URL(nome, pasta), "utf8");
    await db.query("begin");
    try {
      await db.query(sql);
      await db.query("insert into public.drend_migracoes (nome) values ($1)", [nome]);
      await db.query("commit");
      console.log(`[migrar] aplicada ${nome}`);
    } catch (erro) {
      await db.query("rollback");
      console.error(`[migrar] falhou ${nome}: ${erro.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log("[migrar] banco em dia");
} finally {
  await db.end();
}
