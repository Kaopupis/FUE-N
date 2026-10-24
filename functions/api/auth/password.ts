import { type AuthData, type Env, type UserRow, error, json, passwordProblem, readJson, setPassword, verifyPassword } from '../../../server/auth';

// ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง (ต้องใส่รหัสเดิม) แล้วออกจากระบบในเครื่องอื่นทั้งหมด
export const onRequestPost: PagesFunction<Env, string, AuthData> = async ({ env, request, data }) => {
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body?.currentPassword) return error(400, 'กรุณาใส่รหัสผ่านปัจจุบัน');
  const problem = passwordProblem(body.newPassword);
  if (problem) return error(400, problem);
  if (body.newPassword === body.currentPassword) return error(400, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(data.user.id).first<UserRow>();
  if (!u || !(await verifyPassword(body.currentPassword, u.password_hash, u.password_salt))) return error(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  await setPassword(env, u.id, body.newPassword!, false);
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(u.id, data.tokenHash).run();
  return json({ user: { ...data.user, mustChangePassword: false } });
};
