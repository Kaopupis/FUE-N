import { type AuthData, type Env, type Role, type UserRow, error, json, publicUser, readJson, usernameProblem } from '../../../../server/auth';

// แก้ไขผู้ใช้: ชื่อผู้ใช้ ชื่อที่แสดง สิทธิ์ เปิด/ปิดการใช้งาน
export const onRequestPatch: PagesFunction<Env, 'id', AuthData> = async ({ env, request, params, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const id = Number(params.id);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!u) return error(404, 'ไม่พบผู้ใช้');
  const body = await readJson<{ username?: string; displayName?: string; role?: Role; active?: boolean }>(request);
  if (!body) return error(400, 'ข้อมูลไม่ถูกต้อง');

  const username = body.username !== undefined ? body.username.trim() : u.username;
  if (body.username !== undefined) {
    const p = usernameProblem(username);
    if (p) return error(400, p);
    const dup = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username, id).first();
    if (dup) return error(409, `มีชื่อผู้ใช้ ${username} อยู่แล้ว`);
  }
  const role: Role = body.role === undefined ? u.role : body.role === 'admin' ? 'admin' : 'staff';
  const active = body.active === undefined ? !!u.active : !!body.active;

  // ต้องเหลือผู้ดูแลที่ใช้งานได้อย่างน้อย 1 คน
  if (u.role === 'admin' && u.active && (role !== 'admin' || !active)) {
    const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?`).bind(id).first<{ n: number }>();
    if (!n?.n) return error(400, 'ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน');
  }

  const row = await env.DB.prepare(
    `UPDATE users SET username = ?, display_name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(username, (body.displayName ?? u.display_name).trim().slice(0, 80), role, active ? 1 : 0, id)
    .first<UserRow>();
  if (!active) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  return json({ user: publicUser(row!) });
};
