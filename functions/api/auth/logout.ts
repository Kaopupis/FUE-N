import { type AuthData, type Env, clearCookie, json } from '../../../server/auth';

export const onRequestPost: PagesFunction<Env, string, AuthData> = async ({ env, request, data }) => {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(data.tokenHash).run();
  return json({ ok: true }, { headers: { 'set-cookie': clearCookie(request) } });
};
