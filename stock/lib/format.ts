const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const kgFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const bahtFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

export const kg = (n: number) => kgFmt.format(n || 0);
export const baht = (n: number) => bahtFmt.format(n || 0);
export const int = (n: number) => intFmt.format(n || 0);

// ย่อจำนวนเงินก้อนใหญ่ เช่น 12.4 ล้าน
export function bahtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ล้าน`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString('th-TH', { maximumFractionDigits: 1 })} พัน`;
  return intFmt.format(n);
}

export function tonne(n: number) {
  return `${(n / 1000).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตัน`;
}

// วันที่แบบไทย พ.ศ. dd/mm/2569
export function thDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
}

export function thDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

// คีย์เดือน yyyy-mm
export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthLabel(key: string, full = false) {
  const [y, m] = key.split('-').map(Number);
  return `${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${full ? y + 543 : String(y + 543).slice(2)}`;
}

export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
