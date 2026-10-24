import { type Env, json } from '../../server/auth';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'users'`).first<{ n: number }>();
  return json({ ok: true, database: r?.n ? 'ready' : 'migrations-missing' });
};
