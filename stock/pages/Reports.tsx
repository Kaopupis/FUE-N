import React, { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Icon, PageHead, ReceiptLink, SupplierLink, gradeColor, useApp } from '../components/ui';
import { baht, kg, monthKey, monthLabel, thDate } from '../lib/format';

export function copyText(text: string, done: (ok: boolean) => void) {
  try {
    navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
  } catch {
    done(false);
  }
}

function download(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');

export default function Reports() {
  const { model, toast } = useApp();
  const [view, setView] = useState<'month' | 'scale'>('month');
  const topGrades = model.grades.filter((g) => g.avgCost > 0).slice(0, 5).map((g) => g.grade);

  const monthly = model.months.map((m) => {
    const rs = model.receipts.filter((r) => monthKey(r.date) === m.month);
    const pricedKg = rs.reduce((s, r) => s + r.lines.filter((l) => l.price > 0).reduce((a, l) => a + l.net, 0), 0);
    return { ...m, pending: rs.filter((r) => r.status !== 'priced').length, avg: pricedKg ? m.value / pricedKg : 0, vat: rs.reduce((s, r) => s + r.vat, 0) };
  });

  const priceTrend = useMemo(
    () =>
      model.months.map((m) => {
        const row: Record<string, number | string> = { m: monthLabel(m.month) };
        for (const g of topGrades) {
          let kgs = 0, amt = 0;
          for (const r of model.receipts) if (monthKey(r.date) === m.month) for (const l of r.lines) if (l.grade === g && l.price > 0) { kgs += l.net; amt += l.total; }
          if (kgs) row[g] = Math.round((amt / kgs) * 100) / 100;
        }
        return row;
      }),
    [model],
  );

  const scale = model.receipts
    .filter((r) => r.truckKg > 0 && r.netKg > 0)
    .map((r) => ({ r, diff: r.truckKg - r.netKg, pct: ((r.truckKg - r.netKg) / r.truckKg) * 100 }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const avgPct = scale.reduce((s, x) => s + x.pct, 0) / (scale.length || 1);

  const exportReceipts = () =>
    csv([
      ['เลขที่รับ', 'วันที่', 'ผู้ขาย', 'ทะเบียนรถ', 'เกรด', 'นน.สุทธิ', 'ราคา/กก.', 'ราคารวม'],
      ...model.receipts.flatMap((r) => (r.lines.length ? r.lines : Object.entries(r.qty).map(([grade, net]) => ({ grade, net, price: 0, total: 0 }))).map((l) => [r.id, thDate(r.date), r.supplier, r.plates.join(' '), l.grade, l.net, l.price, l.total])),
    ]);
  const exportStock = () =>
    csv([
      ['เกรด', 'กลุ่ม', 'รับเข้า', 'ได้จากคัด', 'นำไปคัด', 'จ่ายออก', 'ปรับยอด', 'คงเหลือ', 'ต้นทุนเฉลี่ย', 'มูลค่า'],
      ...model.grades.filter((g) => g.received || g.balance).map((g) => [g.grade, g.family, g.received, g.sortedIn, g.sortedOut, g.issued, g.adjusted, g.balance, g.avgCost, g.value]),
    ]);

  const ExportBtns = ({ name, make }: { name: string; make: () => string }) => (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn sm" onClick={() => copyText(make(), (ok) => toast(ok ? 'คัดลอก CSV แล้ว วางใน Google Sheets ได้เลย' : 'คัดลอกไม่ได้ ลองใช้ปุ่มดาวน์โหลด'))}><Icon name="copy" size={14} />คัดลอก CSV</button>
      <button className="btn sm" onClick={() => download(name, make())}>ดาวน์โหลด</button>
    </div>
  );

  return (
    <>
      <PageHead crumb="รายงาน" title="รายงาน" desc="สรุปรายเดือน แนวโน้มราคา และผลต่างตาชั่ง" />
      <div className="grid g-2e">
        <Card title="ส่งออกข้อมูลใบรับ" sub="ทุกบรรทัดราคา แยกเกรด" right={<ExportBtns name="ใบรับสินค้า.csv" make={exportReceipts} />}><span className="muted">{model.receipts.length} ใบรับ</span></Card>
        <Card title="ส่งออกสต๊อกคงเหลือ" sub="ยอดคงเหลือและมูลค่าแยกเกรด" right={<ExportBtns name="สต๊อกคงเหลือ.csv" make={exportStock} />}><span className="muted">{model.grades.filter((g) => g.received || g.balance).length} เกรด</span></Card>
      </div>

      <Card title="ราคารับซื้อเฉลี่ยรายเดือน" sub="บาท/กก. ถ่วงน้ำหนัก 5 เกรดหลัก">
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={priceTrend} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="m" tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(v: number, n: string) => [`${baht(v)} บาท/กก.`, n]} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              {topGrades.map((g) => <Line key={g} type="monotone" dataKey={g} stroke={gradeColor(g)} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>สรุปรายเดือน</button>
        <button className={view === 'scale' ? 'on' : ''} onClick={() => setView('scale')}>ผลต่างตาชั่งรถกับกระสอบ</button>
      </div>

      {view === 'month' ? (
        <Card pad={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>เดือน</th><th className="r">ใบรับ</th><th className="r">น้ำหนักสุทธิ (กก.)</th><th className="r">ยอดซื้อก่อน VAT</th><th className="r">VAT</th><th className="r">ราคาเฉลี่ย/กก.</th><th className="r">รอราคา</th></tr></thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month, true)}</td><td className="r num">{m.receipts}</td><td className="r num">{kg(m.kg)}</td><td className="r num">{baht(m.value)}</td><td className="r num">{baht(m.vat)}</td><td className="r num">{m.avg ? baht(m.avg) : '–'}</td>
                    <td className="r">{m.pending ? <span className="chip warn">{m.pending}</span> : <span className="chip ok">ครบ</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>รวม</td><td className="r num">{model.receipts.length}</td><td className="r num">{kg(model.totals.kg)}</td><td className="r num">{baht(model.totals.value)}</td><td className="r num">{baht(monthly.reduce((s, m) => s + m.vat, 0))}</td><td /><td className="r num">{model.totals.pending}</td></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <Card title="ผลต่างตาชั่งรถกับน้ำหนักกระสอบ" sub={`เฉลี่ย ${avgPct.toFixed(2)}% · ผลต่างบวกคือรถหนักกว่ากระสอบรวม (เต๋า พาเลท เศษ) · เรียงจากต่างมากสุด`} pad={false}>
          <div className="tbl-wrap scroll-y" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead><tr><th>เลขที่รับ</th><th>วันที่</th><th>ผู้ขาย</th><th className="r">ตาชั่งรถ</th><th className="r">กระสอบสุทธิ</th><th className="r">ผลต่าง (กก.)</th><th className="r">%</th></tr></thead>
              <tbody>
                {scale.map(({ r, diff, pct }) => (
                  <tr key={r.id}>
                    <td><ReceiptLink id={r.id} /></td><td className="num">{thDate(r.date)}</td><td><SupplierLink name={r.supplier} /></td>
                    <td className="r num">{kg(r.truckKg)}</td><td className="r num">{kg(r.netKg)}</td><td className="r num">{kg(diff)}</td>
                    <td className="r"><span className={`chip ${Math.abs(pct) > 2 ? 'bad' : Math.abs(pct) > 0.5 ? 'warn' : 'ok'}`}>{pct.toFixed(2)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
