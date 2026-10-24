import { type AuthData, type Env, error, json, readJson } from '../../../../server/auth';
import { type EmployeeInput, type EmployeeRow, cleanEmployee, publicEmployee } from '../../../../server/employees';

export const onRequestPatch: PagesFunction<Env, 'id', AuthData> = async ({ env, request, params, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const id = Number(params.id);
  const body = await readJson<EmployeeInput>(request);
  if (!body) return error(400, 'ข้อมูลไม่ถูกต้อง');
  const c = cleanEmployee(body);
  if ('error' in c) return error(400, c.error!);
  const v = c.value;
  if (v.code && (await env.DB.prepare('SELECT id FROM employees WHERE code = ? AND id != ?').bind(v.code, id).first()))
    return error(409, `มีรหัสพนักงาน ${v.code} อยู่แล้ว`);
  const row = await env.DB.prepare(
    `UPDATE employees SET code = ?, first_name = ?, last_name = ?, nickname = ?, position = ?, department = ?, phone = ?, email = ?,
     start_date = ?, status = ?, note = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(v.code, v.first_name, v.last_name, v.nickname, v.position, v.department, v.phone, v.email, v.start_date, v.status, v.note, id)
    .first<EmployeeRow>();
  if (!row) return error(404, 'ไม่พบพนักงาน');
  return json({ employee: publicEmployee(row) });
};

// ลบพนักงานพร้อมรูปใน R2
export const onRequestDelete: PagesFunction<Env, 'id', AuthData> = async ({ env, params, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const row = await env.DB.prepare('DELETE FROM employees WHERE id = ? RETURNING *').bind(Number(params.id)).first<EmployeeRow>();
  if (!row) return error(404, 'ไม่พบพนักงาน');
  if (row.photo_key && env.PHOTOS) await env.PHOTOS.delete(row.photo_key);
  return json({ ok: true });
};
