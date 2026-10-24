import raw from '../../../stock/data/sheet-receipts.json';
import { type Env, json } from '../../../server/auth';

// ข้อมูลใบรับจากชีต ส่งให้เฉพาะผู้ที่ login แล้ว (middleware ตรวจก่อน)
export const onRequestGet: PagesFunction<Env> = async () => json(raw);
