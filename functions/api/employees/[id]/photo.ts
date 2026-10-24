import { type AuthData, type Env, error, json } from '../../../../server/auth';
import { type EmployeeRow, MAX_PHOTO_BYTES, publicEmployee, sniffImage } from '../../../../server/employees';

const find = (env: Env, id: string) => env.DB.prepare('SELECT * FROM employees WHERE id = ?').bind(Number(id)).first<EmployeeRow>();

// แสดงรูป (เฉพาะผู้ที่ login แล้ว)
export const onRequestGet: PagesFunction<Env, 'id', AuthData> = async ({ env, params, request }) => {
  if (!env.PHOTOS) return error(503, 'ยังไม่ได้ผูก R2 bucket (binding ชื่อ PHOTOS)');
  const emp = await find(env, params.id as string);
  if (!emp?.photo_key) return error(404, 'ไม่มีรูป');
  const obj = await env.PHOTOS.get(emp.photo_key, { onlyIf: request.headers });
  if (!obj) return error(404, 'ไม่พบไฟล์รูป');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'private, max-age=86400');
  headers.set('x-content-type-options', 'nosniff');
  return 'body' in obj && obj.body ? new Response(obj.body, { headers }) : new Response(null, { status: 304, headers });
};

// อัปโหลดรูป: ส่งไฟล์รูปเป็น body ตรงๆ (jpeg/png/webp ไม่เกิน 5 MB)
export const onRequestPut: PagesFunction<Env, 'id', AuthData> = async ({ env, params, request, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  if (!env.PHOTOS) return error(503, 'ยังไม่ได้ผูก R2 bucket (binding ชื่อ PHOTOS)');
  const emp = await find(env, params.id as string);
  if (!emp) return error(404, 'ไม่พบพนักงาน');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_PHOTO_BYTES) return error(413, 'รูปใหญ่เกิน 5 MB');
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return error(400, 'ไม่พบไฟล์รูป');
  if (buf.length > MAX_PHOTO_BYTES) return error(413, 'รูปใหญ่เกิน 5 MB');
  const kind = sniffImage(buf);
  if (!kind) return error(415, 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP');
  const key = `employees/${emp.id}/${crypto.randomUUID()}.${kind.ext}`;
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: kind.type } });
  const row = await env.DB.prepare(
    `UPDATE employees SET photo_key = ?, photo_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(key, emp.id)
    .first<EmployeeRow>();
  if (emp.photo_key) await env.PHOTOS.delete(emp.photo_key);
  return json({ employee: publicEmployee(row!) });
};

export const onRequestDelete: PagesFunction<Env, 'id', AuthData> = async ({ env, params, data }) => {
  if (data.user.role !== 'admin') return error(403, 'เฉพาะผู้ดูแลระบบ');
  const emp = await find(env, params.id as string);
  if (!emp) return error(404, 'ไม่พบพนักงาน');
  if (emp.photo_key && env.PHOTOS) await env.PHOTOS.delete(emp.photo_key);
  const row = await env.DB.prepare(
    `UPDATE employees SET photo_key = NULL, photo_updated_at = NULL, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(emp.id)
    .first<EmployeeRow>();
  return json({ employee: publicEmployee(row!) });
};
