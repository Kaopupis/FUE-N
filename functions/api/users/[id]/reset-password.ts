import { type AuthData, type Env, error, json, passwordProblem, readJson, setPassword } from '../../../../server/auth';

// ผู้ดูแลตั้งรหัสผ่านชั่วคราวให้ผู้ใช้ ผู้ใช้ต้องเปลี่ยนเองเมื่อเข้าครั้งถัดไป และถูกออกจากระบบทุกเครื่อง
export const onRequestPost: PagesFunction<Env, 'id', AuthData> = async ({ env, request, params, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const id = Number(params.id);
  const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!exists) return error(404, 'ไม่พบผู้ใช้');
  const body = await readJson<{ newPassword?: string }>(request);
  const problem = passwordProblem(body?.newPassword);
  if (problem) return error(400, problem);
  await setPassword(env, id, body!.newPassword!, true);
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  return json({ ok: true });
};
