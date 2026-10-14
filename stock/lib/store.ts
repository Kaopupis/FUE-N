import { useCallback, useEffect, useState } from 'react';
import type { LocalData } from './types';

const KEY = 'sahamit-stock-v1';

export const EMPTY: LocalData = { receipts: [], priceOverrides: {}, issues: [], sorts: [], adjustments: [] };

function load(): LocalData {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return EMPTY;
    return { ...EMPTY, ...JSON.parse(s) };
  } catch {
    return EMPTY;
  }
}

function save(d: LocalData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // บันทึกไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) — ข้อมูลยังอยู่ในหน้าจอจนกว่าจะปิด
  }
}

// ข้อมูลที่ผู้ใช้บันทึกเพิ่ม (ใบรับใหม่ จ่ายออก คัดแยก ปรับยอด) เก็บในเบราว์เซอร์เครื่องนี้
export function useLocalData() {
  const [data, setData] = useState<LocalData>(load);
  useEffect(() => save(data), [data]);
  const update = useCallback((fn: (d: LocalData) => LocalData) => setData((d) => fn(d)), []);
  return [data, update, setData] as const;
}

export function isLocalData(x: unknown): x is LocalData {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return ['receipts', 'issues', 'sorts', 'adjustments'].every((k) => Array.isArray(o[k] ?? []));
}
