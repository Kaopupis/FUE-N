import { BASE_GRADES, VAT_RATE, gradeFamily, supplierGroup } from './data';
import { monthKey, round2 } from './format';
import type { GradeInfo, LocalData, Movement, PriceLine, Receipt } from './types';

export type PriceStatus = 'priced' | 'partial' | 'pending';

export interface ReceiptView extends Receipt {
  qty: Record<string, number>; // น้ำหนักสุทธิแยกเกรด (เข้าสต๊อก)
  netKg: number;
  truckKg: number; // น้ำหนักรถสุทธิรวมทุกคัน
  subtotal: number;
  vat: number;
  total: number;
  status: PriceStatus;
  overridden: boolean;
}

export interface GradeStock {
  grade: string;
  family: GradeInfo['family'];
  received: number;
  issued: number;
  sortedIn: number; // ได้จากการคัด
  sortedOut: number; // นำไปคัด
  adjusted: number;
  balance: number;
  avgCost: number; // บาท/กก. ถัวเฉลี่ยจากใบรับที่มีราคา
  lastPrice: number;
  value: number;
  receiptCount: number;
  suppliers: string[];
  lastDate: string | null;
}

export interface SupplierStat {
  name: string;
  group: string;
  receipts: string[];
  kg: number;
  value: number;
  grades: Record<string, number>;
  first: string;
  last: string;
  noVat: boolean;
  pending: number;
}

export interface MonthStat {
  month: string;
  receipts: number;
  kg: number;
  value: number;
  byGrade: Record<string, number>;
}

export interface Model {
  receipts: ReceiptView[];
  receiptById: Map<string, ReceiptView>;
  grades: GradeStock[];
  gradeByName: Map<string, GradeStock>;
  suppliers: SupplierStat[];
  supplierByName: Map<string, SupplierStat>;
  months: MonthStat[];
  movements: Movement[];
  totals: { kg: number; value: number; balance: number; stockValue: number; pending: number; trucks: number };
}

const add = (o: Record<string, number>, k: string, v: number) => {
  o[k] = round2((o[k] || 0) + v);
};

function priceStatus(lines: PriceLine[]): PriceStatus {
  const priced = lines.filter((l) => l.price > 0).length;
  if (!lines.length || priced === 0) return 'pending';
  return priced === lines.length ? 'priced' : 'partial';
}

export function viewReceipt(r: Receipt, override?: PriceLine[]): ReceiptView {
  const lines = override ?? r.lines;
  const qty: Record<string, number> = {};
  if (r.bags.length) r.bags.forEach((b) => add(qty, b.grade, b.net));
  else lines.forEach((l) => add(qty, l.grade, l.net));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const vat = r.noVat ? 0 : round2(subtotal * VAT_RATE);
  return {
    ...r,
    lines,
    qty,
    netKg: round2(Object.values(qty).reduce((a, b) => a + b, 0)),
    truckKg: r.truckNet.reduce((a, b) => a + b, 0),
    subtotal,
    vat,
    total: round2(subtotal + vat),
    status: priceStatus(lines),
    overridden: !!override,
  };
}

// สร้างบรรทัดราคาตั้งต้นจากกระสอบ (รวม นน.สุทธิแยกเกรด)
export function linesFromBags(r: Pick<Receipt, 'bags'>, prices: Record<string, number> = {}): PriceLine[] {
  const q: Record<string, number> = {};
  r.bags.forEach((b) => add(q, b.grade, b.net));
  return Object.entries(q).map(([grade, net]) => {
    const price = prices[grade] || 0;
    return { grade, net, price, total: round2(net * price) };
  });
}

export function buildModel(local: LocalData, sheet: Receipt[]): Model {
  const receipts = [...sheet, ...local.receipts]
    .map((r) => viewReceipt(r, local.priceOverrides[r.id]))
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  const receiptById = new Map(receipts.map((r) => [r.id, r]));

  // การเคลื่อนไหวของสต๊อก
  const movements: Movement[] = [];
  for (const r of receipts)
    for (const [grade, q] of Object.entries(r.qty))
      movements.push({ date: r.date, grade, kind: 'receipt', ref: r.id, party: r.supplier, qty: q });
  for (const i of local.issues)
    for (const l of i.lines)
      movements.push({ date: i.date, grade: l.grade, kind: 'issue', ref: i.id, party: i.customer, qty: -l.net });
  for (const s of local.sorts) {
    movements.push({ date: s.date, grade: s.fromGrade, kind: 'sort-out', ref: s.id, party: 'คัดแยก', qty: -s.input });
    for (const o of s.outputs)
      movements.push({ date: s.date, grade: o.grade, kind: 'sort-in', ref: s.id, party: `คัดจาก ${s.fromGrade}`, qty: o.net });
  }
  for (const a of local.adjustments)
    movements.push({ date: a.date, grade: a.grade, kind: 'adjust', ref: a.id, party: a.reason, qty: a.qty });
  movements.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));

  // ต้นทุนถัวเฉลี่ยต่อเกรด
  const cost: Record<string, { kg: number; amt: number; last: number; lastDate: string }> = {};
  for (const r of [...receipts].reverse())
    for (const l of r.lines)
      if (l.price > 0) {
        const c = (cost[l.grade] ||= { kg: 0, amt: 0, last: 0, lastDate: '' });
        c.kg += l.net;
        c.amt += l.total;
        if (r.date >= c.lastDate) {
          c.last = l.price;
          c.lastDate = r.date;
        }
      }

  const gradeNames = new Set<string>(BASE_GRADES);
  movements.forEach((m) => gradeNames.add(m.grade));
  const gmap = new Map<string, GradeStock>();
  for (const g of gradeNames)
    gmap.set(g, {
      grade: g, family: gradeFamily(g), received: 0, issued: 0, sortedIn: 0, sortedOut: 0, adjusted: 0,
      balance: 0, avgCost: 0, lastPrice: 0, value: 0, receiptCount: 0, suppliers: [], lastDate: null,
    });
  const supSets = new Map<string, Set<string>>();
  for (const m of movements) {
    const g = gmap.get(m.grade)!;
    if (m.kind === 'receipt') {
      g.received += m.qty;
      g.receiptCount++;
      (supSets.get(m.grade) ?? supSets.set(m.grade, new Set()).get(m.grade)!).add(m.party);
    } else if (m.kind === 'issue') g.issued -= m.qty;
    else if (m.kind === 'sort-in') g.sortedIn += m.qty;
    else if (m.kind === 'sort-out') g.sortedOut -= m.qty;
    else g.adjusted += m.qty;
    g.balance += m.qty;
    if (!g.lastDate || m.date > g.lastDate) g.lastDate = m.date;
  }
  for (const g of gmap.values()) {
    const c = cost[g.grade];
    g.avgCost = c && c.kg ? round2(c.amt / c.kg) : 0;
    g.lastPrice = c?.last ?? 0;
    g.balance = round2(g.balance);
    g.value = round2(Math.max(g.balance, 0) * g.avgCost);
    g.suppliers = [...(supSets.get(g.grade) ?? [])];
    for (const k of ['received', 'issued', 'sortedIn', 'sortedOut', 'adjusted'] as const) g[k] = round2(g[k]);
  }
  const grades = [...gmap.values()].sort(
    (a, b) => b.received + b.sortedIn - (a.received + a.sortedIn) || a.grade.localeCompare(b.grade, 'th'),
  );

  // ผู้ขาย
  const smap = new Map<string, SupplierStat>();
  for (const r of [...receipts].reverse()) {
    const s =
      smap.get(r.supplier) ??
      smap
        .set(r.supplier, {
          name: r.supplier, group: supplierGroup(r.supplier), receipts: [], kg: 0, value: 0, grades: {},
          first: r.date, last: r.date, noVat: r.noVat, pending: 0,
        })
        .get(r.supplier)!;
    s.receipts.push(r.id);
    s.kg = round2(s.kg + r.netKg);
    s.value = round2(s.value + r.subtotal);
    Object.entries(r.qty).forEach(([g, q]) => add(s.grades, g, q));
    s.last = r.date;
    if (r.status === 'pending') s.pending++;
  }
  const suppliers = [...smap.values()].sort((a, b) => b.kg - a.kg);

  // รายเดือน
  const mmap = new Map<string, MonthStat>();
  for (const r of receipts) {
    const k = monthKey(r.date);
    const m = mmap.get(k) ?? mmap.set(k, { month: k, receipts: 0, kg: 0, value: 0, byGrade: {} }).get(k)!;
    m.receipts++;
    m.kg = round2(m.kg + r.netKg);
    m.value = round2(m.value + r.subtotal);
    Object.entries(r.qty).forEach(([g, q]) => add(m.byGrade, g, q));
  }
  const months = [...mmap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const totals = {
    kg: round2(receipts.reduce((s, r) => s + r.netKg, 0)),
    value: round2(receipts.reduce((s, r) => s + r.subtotal, 0)),
    balance: round2(grades.reduce((s, g) => s + g.balance, 0)),
    stockValue: round2(grades.reduce((s, g) => s + g.value, 0)),
    pending: receipts.filter((r) => r.status !== 'priced').length,
    trucks: receipts.reduce((s, r) => s + Math.max(r.truckNet.length, r.plates.length ? 1 : 0), 0),
  };

  return {
    receipts, receiptById, grades, gradeByName: gmap, suppliers,
    supplierByName: smap, months, movements, totals,
  };
}

// เลขที่รับถัดไปของเดือน เช่น B10-07
export function nextReceiptId(model: Model, iso: string) {
  const mm = iso.slice(5, 7);
  const nums = model.receipts.filter((r) => r.id.startsWith(`B${mm}-`)).map((r) => Number(r.id.split('-')[1]) || 0);
  return `B${mm}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
}

export function nextDocId(prefix: string, existing: { id: string }[], iso: string) {
  const mm = iso.slice(5, 7);
  const p = `${prefix}${mm}-`;
  const nums = existing.filter((x) => x.id.startsWith(p)).map((x) => Number(x.id.slice(p.length)) || 0);
  return `${p}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
}
