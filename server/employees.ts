// ข้อมูลพนักงานบน D1 และรูปบน R2

export type EmployeeStatus = 'active' | 'leave' | 'resigned';

export interface EmployeeRow {
  id: number;
  code: string | null;
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  start_date: string | null;
  status: EmployeeStatus;
  note: string;
  photo_key: string | null;
  photo_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function publicEmployee(e: EmployeeRow) {
  return {
    id: e.id,
    code: e.code ?? '',
    firstName: e.first_name,
    lastName: e.last_name,
    nickname: e.nickname,
    position: e.position,
    department: e.department,
    phone: e.phone,
    email: e.email,
    startDate: e.start_date,
    status: e.status,
    note: e.note,
    // ใส่เวลาแก้ไขต่อท้าย เพื่อให้เบราว์เซอร์โหลดรูปใหม่เมื่อเปลี่ยนรูป
    photoUrl: e.photo_key ? `/api/employees/${e.id}/photo?v=${encodeURIComponent(e.photo_updated_at ?? '')}` : null,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

export interface EmployeeInput {
  code?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  position?: string;
  department?: string;
  phone?: string;
  email?: string;
  startDate?: string | null;
  status?: EmployeeStatus;
  note?: string;
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// ตรวจและทำความสะอาดข้อมูลจากฟอร์ม คืนข้อความผิดพลาดหรือค่าที่พร้อมบันทึก
export function cleanEmployee(b: EmployeeInput) {
  const firstName = clip(b.firstName, 80);
  if (!firstName) return { error: 'กรุณาใส่ชื่อพนักงาน' } as const;
  const email = clip(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'อีเมลไม่ถูกต้อง' } as const;
  const startDate = b.startDate ? clip(b.startDate, 10) : null;
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: 'วันที่เริ่มงานไม่ถูกต้อง' } as const;
  const status: EmployeeStatus = b.status === 'leave' || b.status === 'resigned' ? b.status : 'active';
  return {
    value: {
      code: clip(b.code, 30) || null,
      first_name: firstName,
      last_name: clip(b.lastName, 80),
      nickname: clip(b.nickname, 40),
      position: clip(b.position, 80),
      department: clip(b.department, 80),
      phone: clip(b.phone, 30),
      email,
      start_date: startDate,
      status,
      note: clip(b.note, 1000),
    },
  } as const;
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// ดูชนิดไฟล์จาก byte แรก ไม่เชื่อ content-type ที่ส่งมา
export function sniffImage(buf: Uint8Array): { type: string; ext: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (String.fromCharCode(...buf.slice(0, 4)) === 'RIFF' && String.fromCharCode(...buf.slice(8, 12)) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}
