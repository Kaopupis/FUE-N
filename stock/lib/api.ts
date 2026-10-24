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

export type EmployeeStatus = 'active' | 'leave' | 'resigned';

export interface Employee {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  nickname: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  startDate: string | null;
  status: EmployeeStatus;
  note: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABEL: Record<EmployeeStatus, string> = { active: 'ทำงานอยู่', leave: 'ลาพัก', resigned: 'ลาออก' };

// ส่งไฟล์รูปเป็น body ตรงๆ
export async function uploadPhoto(employeeId: number, blob: Blob): Promise<Employee> {
  let res: Response;
  try {
    res = await fetch(`/api/employees/${employeeId}/photo`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': blob.type }, body: blob });
  } catch {
    throw new ApiError(0, 'อัปโหลดไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `อัปโหลดไม่สำเร็จ (${res.status})`);
  return (data as { employee: Employee }).employee;
}

// ย่อรูปให้ด้านยาวไม่เกิน max px ก่อนอัปโหลด (หมุนตาม EXIF ของกล้องมือถือ)
export async function shrinkImage(file: File, max = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/jpeg', 0.86));
}
