// Shapes used by the stock system. Weights are in kilograms, money in baht.

export interface Bag {
  no: number;
  grade: string;
  gross: number; // นน.ก่อน (ชั่งเข้า)
  tare: number; // นน. เต๋า/กระสอบ
  net: number; // นน.สุทธิ
}

export interface PriceLine {
  grade: string;
  net: number;
  price: number; // ราคา / กก.
  total: number;
}

export interface Receipt {
  id: string; // เลขที่รับ เช่น B06-01
  date: string; // ISO yyyy-mm-dd
  supplier: string;
  plates: string[];
  trip: string | null; // คันที่
  truckIn: number[];
  truckOut: number[];
  truckNet: number[];
  bags: Bag[];
  lines: PriceLine[];
  noVat: boolean;
  note?: string;
  source: 'sheet' | 'local';
}

export interface IssueLine {
  grade: string;
  net: number;
  price: number;
}

// จ่ายออก / ขาย
export interface Issue {
  id: string;
  date: string;
  customer: string;
  lines: IssueLine[];
  note?: string;
}

// คัดแยกเกรด: นำเกรดต้นทางมาคัดเป็นหลายเกรด ส่วนต่างคือ นน.สูญเสีย
export interface SortJob {
  id: string;
  date: string;
  fromGrade: string;
  input: number;
  outputs: { grade: string; net: number }[];
  note?: string;
}

// ปรับยอด (นับสต๊อกจริง / ของเสีย)
export interface Adjustment {
  id: string;
  date: string;
  grade: string;
  qty: number; // + เพิ่ม, - ลด
  reason: string;
}

export interface LocalData {
  receipts: Receipt[];
  priceOverrides: Record<string, PriceLine[]>; // กำหนดราคาให้ใบรับจากชีตที่ยังไม่มีราคา
  issues: Issue[];
  sorts: SortJob[];
  adjustments: Adjustment[];
}

export type MovementKind = 'receipt' | 'issue' | 'sort-in' | 'sort-out' | 'adjust';

export interface Movement {
  date: string;
  grade: string;
  kind: MovementKind;
  ref: string;
  party: string;
  qty: number; // + เข้า, - ออก
}

export interface GradeInfo {
  name: string;
  family: 'ทองแดง' | 'ทองเหลือง' | 'อลูมิเนียม' | 'อื่นๆ';
}

export type Page =
  | 'dashboard'
  | 'stock'
  | 'receipts'
  | 'issues'
  | 'sorting'
  | 'grades'
  | 'suppliers'
  | 'relations'
  | 'reports'
  | 'settings'
  | 'users'
  | 'employees';

// เป้าหมายการนำทางข้ามหน้า (ความสัมพันธ์ของข้อมูล)
export interface NavTarget {
  page: Page;
  receiptId?: string;
  supplier?: string;
  grade?: string;
  month?: string;
  newForm?: boolean;
}
