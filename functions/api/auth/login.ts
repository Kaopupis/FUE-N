import { type Env, createSession, ensureBootstrapAdmin, error, json, login, readJson } from '../../../server/auth';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await readJson<{ username?: string; password?: string }>(request);
  if (!body?.username || !body.password) return error(400, 'กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน');
  await ensureBootstrapAdmin(env);
  const r = await login(env, body.username, body.password);
  if (!r.ok) return error(401, r.message);
  return json({ user: r.user }, { headers: { 'set-cookie': await createSession(env, request, r.user.id) } });
};
