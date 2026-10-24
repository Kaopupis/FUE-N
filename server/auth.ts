// ฟังก์ชันฝั่งเซิร์ฟเวอร์ (Cloudflare Pages Functions) สำหรับ login และ session บน D1

export interface Env {
  DB: D1Database;
  PHOTOS?: R2Bucket; // รูปพนักงาน (R2)
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string; // ตั้งเป็น secret ใช้สร้างผู้ดูแลคนแรกเมื่อยังไม่มีผู้ใช้
  SESSION_TTL_HOURS?: string;
}

export type Role = 'admin' | 'staff';

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  password_hash: string;
  password_salt: string;
  must_change_password: number;
  active: number;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AuthData = {
  user: PublicUser;
  tokenHash: string;
};

export const COOKIE = 'sid';
const PBKDF2_ITERATIONS = 100_000; // สูงสุดที่ Workers รองรับ
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
export const MIN_PASSWORD = 8;

const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    mustChangePassword: !!u.must_change_password,
    active: !!u.active,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export const error = (status: number, message: string) => json({ error: message }, { status });

// อ่าน body แบบ JSON เท่านั้น (กันการส่งฟอร์มข้ามเว็บ)
export async function readJson<T>(req: Request): Promise<T | null> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return { hash: `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toB64(bits)}`, salt: toB64(salt) };
}

export async function verifyPassword(password: string, stored: string, salt: string) {
  const [, , expected] = stored.split('$');
  if (!expected) return false;
  const got = new Uint8Array(await derive(password, fromB64(salt)));
  const want = fromB64(expected);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  if (pw.length > 200) return 'รหัสผ่านยาวเกินไป';
  return null;
}

export function usernameProblem(name: unknown): string | null {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9._-]{3,32}$/.test(name)) return 'ชื่อผู้ใช้ต้องเป็น a-z, 0-9, จุด, ขีด ยาว 3–32 ตัว';
  return null;
}

const sha256 = async (s: string) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

const ttlHours = (env: Env) => Math.max(1, Number(env.SESSION_TTL_HOURS) || 12);

function cookieHeader(req: Request, value: string, maxAge: number) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function createSession(env: Env, req: Request, userId: number) {
  const token = toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
  const hours = ttlHours(env);
  await env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
    .bind(await sha256(token), userId, `+${hours} hours`)
    .run();
  // เก็บกวาด session ที่หมดอายุ
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  return cookieHeader(req, token, hours * 3600);
}

export const clearCookie = (req: Request) => cookieHeader(req, '', 0);

export async function sessionUser(env: Env, req: Request): Promise<AuthData | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`,
  )
    .bind(tokenHash)
    .first<UserRow>();
  return row ? { user: publicUser(row), tokenHash } : null;
}

// สร้างผู้ดูแลระบบคนแรกจาก ADMIN_USERNAME / ADMIN_PASSWORD เมื่อยังไม่มีผู้ใช้ในฐานข้อมูล
export async function ensureBootstrapAdmin(env: Env) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  if ((count?.n ?? 0) > 0) return;
  const username = (env.ADMIN_USERNAME || 'admin').trim();
  const password = env.ADMIN_PASSWORD;
  if (!password || passwordProblem(password) || usernameProblem(username)) return;
  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (username, display_name, role, password_hash, password_salt, must_change_password)
     VALUES (?, ?, 'admin', ?, ?, 1)`,
  )
    .bind(username, 'ผู้ดูแลระบบ', hash, salt)
    .run();
}

export async function login(env: Env, username: string, password: string) {
  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username.trim()).first<UserRow>();
  if (!u || !u.active) {
    // ใช้เวลาเท่ากันเพื่อไม่บอกใบ้ว่ามีชื่อผู้ใช้นี้หรือไม่
    await derive(password, new Uint8Array(16));
    return { ok: false as const, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  if (u.locked_until && u.locked_until > new Date().toISOString().replace('T', ' ').slice(0, 19)) {
    return { ok: false as const, message: `บัญชีถูกล็อกชั่วคราวจากการใส่รหัสผิดหลายครั้ง ลองใหม่อีกครั้งใน ${LOCK_MINUTES} นาที` };
  }
  if (!(await verifyPassword(password, u.password_hash, u.password_salt))) {
    const failed = u.failed_attempts + 1;
    await env.DB.prepare(
      `UPDATE users SET failed_attempts = ?, locked_until = CASE WHEN ? >= ? THEN datetime('now', ?) ELSE locked_until END WHERE id = ?`,
    )
      .bind(failed >= MAX_FAILED ? 0 : failed, failed, MAX_FAILED, `+${LOCK_MINUTES} minutes`, u.id)
      .run();
    return { ok: false as const, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  await env.DB.prepare(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`)
    .bind(u.id)
    .run();
  return { ok: true as const, user: publicUser(u) };
}

export async function setPassword(env: Env, userId: number, password: string, mustChange: boolean) {
  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = ?, failed_attempts = 0, locked_until = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(hash, salt, mustChange ? 1 : 0, userId)
    .run();
}
