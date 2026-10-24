import raw from '../data/sheet-receipts.json';
import type { GradeInfo, Receipt } from './types';

type RawReceipt = {
  id: string;
  date: string;
  supplier: string;
  plates: string[];
  trip: string | null;
  truckIn: number[];
  truckOut: number[];
  truckNet: number[];
  bags: [number, string, number, number, number][];
  lines: [string, number, number, number][];
  noVat: boolean;
  draft?: boolean;
};

// ข้อมูลจากชีต "ใบรับสินค้า(เข้า)" — บัญชีรับส่งสินค้า สหมิตร (มิ.ย. 2569 เป็นต้นไป)
export const SHEET_RECEIPTS: Receipt[] = (raw as RawReceipt[]).map(({ draft, ...r }) => ({
  ...r,
  note: draft ? 'ใบนี้ในชีตยังเป็นแบบร่าง ยังไม่กรอกกระสอบ (ราคาที่ค้างอยู่ซ้ำกับใบก่อนหน้า จึงยังไม่นับ)' : undefined,
  bags: r.bags.map(([no, grade, gross, tare, net]) => ({ no, grade, gross, tare, net })),
  lines: r.lines.map(([grade, net, price, total]) => ({ grade, net, price, total })),
  source: 'sheet' as const,
}));

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1LG4EwAsb3N8Z_KCecDgZwyrWBk9gm-m3v-U7NgzppEo/edit';

// เกรดสินค้า: รวมเกรดที่พบในใบรับ และหัวคอลัมน์ในชีต "คัดแยกเกรด & Stock คงเหลือ"
const COPPER = [
  'ปอก', 'ช็อต', 'ใหญ่', 'เล็ก', 'ชุบขาว', 'ท่อใหม่', 'แดงปั๊ม', 'สะพานไฟ', 'สะพานไฟติดสี',
  'สายโทร', 'บดผสม', 'บดสวย', 'บดสวย/ใหญ่', 'บดเล็ก', 'บดน้ำ/ธนัชชัย', 'บดลมsm', 'ปอกติดนำมัน',
  'หม้อน้ำไส้ทองแดง',
];
const BRASS = ['ทองเหลือง'];

export function gradeFamily(name: string): GradeInfo['family'] {
  if (COPPER.includes(name)) return 'ทองแดง';
  if (BRASS.includes(name)) return 'ทองเหลือง';
  if (name.startsWith('อลูมิเนียม') || name === 'ล้อแม็กซ์') return 'อลูมิเนียม';
  return 'อื่นๆ';
}

export const BASE_GRADES: string[] = [...COPPER, ...BRASS];

export const FAMILY_ORDER: GradeInfo['family'][] = ['ทองแดง', 'ทองเหลือง', 'อลูมิเนียม', 'อื่นๆ'];

// กลุ่มผู้ขาย: JT, JT-SG, JT-SS เป็นเครือเดียวกัน
export function supplierGroup(name: string): string {
  if (/^JT\b/.test(name)) return 'JT';
  return name;
}

export const DEFAULT_TARE = 3;
export const VAT_RATE = 0.07;
