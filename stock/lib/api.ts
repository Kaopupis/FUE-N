// เรียก API ฝั่ง Cloudflare Pages Functions (ส่ง cookie session ไปด้วย)

export type Role = 'admin' | 'staff';

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `เกิดข้อผิดพลาด (${res.status})`);
  return data as T;
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'ผู้ดูแลระบบ', staff: 'พนักงาน' };

// รหัสผ่านชั่วคราวแบบสุ่ม อ่านง่าย (ไม่มี 0/O/1/l)
export function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(a, (n) => chars[n % chars.length]).join('');
}
