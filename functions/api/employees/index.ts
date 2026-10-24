import { type AuthData, type Env, error, json, readJson } from '../../../server/auth';
import { type EmployeeInput, type EmployeeRow, cleanEmployee, publicEmployee } from '../../../server/employees';

// ทุกคนที่ login ดูรายชื่อได้
export const onRequestGet: PagesFunction<Env, string, AuthData> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT * FROM employees ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'leave' THEN 1 ELSE 2 END, first_name`,
  ).all<EmployeeRow>();
  return json({ employees: results.map(publicEmployee), photosEnabled: !!env.PHOTOS });
};

// เพิ่มพนักงาน (ผู้ดูแลระบบ)
export const onRequestPost: PagesFunction<Env, string, AuthData> = async ({ env, request, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const body = await readJson<EmployeeInput>(request);
  if (!body) return error(400, 'ข้อมูลไม่ถูกต้อง');
  const c = cleanEmployee(body);
  if ('error' in c) return error(400, c.error!);
  const v = c.value;
  if (v.code && (await env.DB.prepare('SELECT id FROM employees WHERE code = ?').bind(v.code).first()))
    return error(409, `มีรหัสพนักงาน ${v.code} อยู่แล้ว`);
  const row = await env.DB.prepare(
    `INSERT INTO employees (code, first_name, last_name, nickname, position, department, phone, email, start_date, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(v.code, v.first_name, v.last_name, v.nickname, v.position, v.department, v.phone, v.email, v.start_date, v.status, v.note)
    .first<EmployeeRow>();
  return json({ employee: publicEmployee(row!) }, { status: 201 });
};
