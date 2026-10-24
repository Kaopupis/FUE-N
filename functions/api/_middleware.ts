import { type AuthData, type Env, error, sessionUser } from '../../server/auth';

const PUBLIC = new Set(['/api/auth/login', '/api/health']);

// ทุก /api ต้อง login ยกเว้นหน้า login; ผู้ใช้ที่ต้องเปลี่ยนรหัสผ่านใช้ได้เฉพาะ /api/auth/*
export const onRequest: PagesFunction<Env, string, Partial<AuthData>> = async (ctx) => {
  const path = new URL(ctx.request.url).pathname.replace(/\/$/, '');
  if (!ctx.env.DB) return error(500, 'ยังไม่ได้ผูกฐานข้อมูล D1 (binding ชื่อ DB)');
  if (PUBLIC.has(path)) return ctx.next();
  const auth = await sessionUser(ctx.env, ctx.request);
  if (!auth) return error(401, 'กรุณาเข้าสู่ระบบ');
  if (auth.user.mustChangePassword && !path.startsWith('/api/auth/')) return error(403, 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน');
  ctx.data.user = auth.user;
  ctx.data.tokenHash = auth.tokenHash;
  return ctx.next();
};
