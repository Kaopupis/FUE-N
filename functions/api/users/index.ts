import { type AuthData, type Env, type Role, type UserRow, error, hashPassword, json, passwordProblem, publicUser, readJson, usernameProblem } from '../../../server/auth';

export const onRequestGet: PagesFunction<Env, string, AuthData> = async ({ env, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY active DESC, role, username').all<UserRow>();
  return json({ users: results.map(publicUser) });
};

// เพิ่มผู้ใช้ใหม่ ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าครั้งแรก
export const onRequestPost: PagesFunction<Env, string, AuthData> = async ({ env, request, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const body = await readJson<{ username?: string; displayName?: string; role?: Role; password?: string }>(request);
  if (!body) return error(400, 'ข้อมูลไม่ถูกต้อง');
  const username = (body.username ?? '').trim();
  const problem = usernameProblem(username) ?? passwordProblem(body.password);
  if (problem) return error(400, problem);
  const role: Role = body.role === 'admin' ? 'admin' : 'staff';
  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return error(409, `มีชื่อผู้ใช้ ${username} อยู่แล้ว`);
  const { hash, salt } = await hashPassword(body.password!);
  const row = await env.DB.prepare(
    `INSERT INTO users (username, display_name, role, password_hash, password_salt, must_change_password)
     VALUES (?, ?, ?, ?, ?, 1) RETURNING *`,
  )
    .bind(username, (body.displayName ?? '').trim().slice(0, 80), role, hash, salt)
    .first<UserRow>();
  return json({ user: publicUser(row!) }, { status: 201 });
};
