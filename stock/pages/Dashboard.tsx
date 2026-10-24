import React, { useMemo } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bar, Card, GradeChip, gradeColor, Icon, Kpi, LINK, Note, PageHead, ReceiptLink, StatusChip, SupplierLink, useApp } from '../components/ui';
import { bahtShort, kg, monthLabel, thDate, tonne } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Dashboard() {
  const { model, go } = useApp();
  const { totals, months, grades, suppliers, receipts } = model;
  const top = grades.filter((g) => g.received > 0).slice(0, 6);
  const topNames = top.map((g) => g.grade);
  const chart = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, number | string> = { m: monthLabel(m.month) };
        let other = 0;
        for (const [g, q] of Object.entries(m.byGrade)) topNames.includes(g) ? (row[g] = q / 1000) : (other += q);
        row['อื่นๆ'] = other / 1000;
        return row;
      }),
    [months, topNames.join()],
  );
  const pending = receipts.filter((r) => r.status !== 'priced');
  const stockMax = Math.max(...grades.map((g) => g.balance), 1);
  const latest = receipts[0];
  const supMax = Math.max(...suppliers.map((s) => s.kg), 1);

  return (
    <>
      <PageHead
        crumb="ภาพรวม"
        title="แดชบอร์ดสต๊อก"
        desc={<>ข้อมูลใบรับสินค้าสหมิตร {receipts.length} ใบ ตั้งแต่ {thDate(receipts[receipts.length - 1].date)} ถึง {thDate(latest.date)}</>}
        actions={
          <>
            <Button variant="outline" onClick={() => go({ page: 'issues', newForm: true })}><Icon name="issues" size={16} />จ่ายออก</Button>
            <Button onClick={() => go({ page: 'receipts', newForm: true })}><Icon name="plus" size={16} />รับสินค้าเข้า</Button>
          </>
        }
      />
      <div className="grid-kpi">
        <Kpi hero icon="stock" label="สต๊อกคงเหลือ" value={kg(totals.balance)} unit="กก." sub={`≈ ${tonne(totals.balance)} · มูลค่า ${bahtShort(totals.stockValue)} บาท`} onClick={() => go({ page: 'stock' })} />
        <Kpi icon="receipts" label="รับเข้าทั้งหมด" value={kg(totals.kg)} unit="กก." sub={`${receipts.length} ใบรับ · ${totals.trucks} เที่ยวรถ`} onClick={() => go({ page: 'receipts' })} />
        <Kpi icon="coin" label="มูลค่ารับซื้อ (ก่อน VAT)" value={bahtShort(totals.value)} unit="บาท" sub="เฉพาะใบที่กำหนดราคาแล้ว" onClick={() => go({ page: 'reports' })} />
        <Kpi icon="clock" label="ใบรับรอกำหนดราคา" value={String(totals.pending)} unit="ใบ" sub="กดเพื่อดูและใส่ราคา" onClick={() => go({ page: 'receipts', month: 'pending' })} />
      </div>

      <div className="grid-2">
        <Card title="น้ำหนักรับเข้ารายเดือน" sub="หน่วย: ตัน แยกตามเกรดหลัก">
          <div style={{ height: 290 }}>
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="m" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตัน`} cursor={{ fill: 'var(--accent)' }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                {topNames.map((g) => <RBar key={g} dataKey={g} stackId="a" fill={gradeColor(g)} />)}
                <RBar dataKey="อื่นๆ" stackId="a" fill="#9fb5a7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="คงเหลือตามเกรด" sub="กดชื่อเกรดเพื่อดูความเคลื่อนไหว" right={<Button variant="outline" size="sm" onClick={() => go({ page: 'stock' })}>ดูทั้งหมด</Button>}>
          <div className="stack" style={{ gap: 10 }}>
            {grades.filter((g) => g.balance > 0).slice(0, 8).map((g) => (
              <div key={g.grade} className="stack" style={{ gap: 4 }}>
                <div className="row"><GradeChip g={g.grade} /><span className="spacer" /><b className="num">{kg(g.balance)}</b><span className="muted" style={{ fontSize: 12 }}>กก.</span></div>
                <Bar v={g.balance} max={stockMax} color={gradeColor(g.grade)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="ใบรับล่าสุด" pad={false} right={<Button variant="outline" size="sm" onClick={() => go({ page: 'receipts' })}>ทั้งหมด</Button>}>
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>เลขที่รับ</TableHead><TableHead>วันที่</TableHead><TableHead>ผู้ขาย</TableHead><TableHead className="text-right">นน.สุทธิ (กก.)</TableHead><TableHead>สถานะราคา</TableHead></TableRow></TableHeader>
              <TableBody>
                {receipts.slice(0, 8).map((r) => (
                  <TableRow key={r.id} className="click" onClick={() => go({ page: 'receipts', receiptId: r.id })}>
                    <TableCell><ReceiptLink id={r.id} /></TableCell>
                    <TableCell className="num">{thDate(r.date)}</TableCell>
                    <TableCell><SupplierLink name={r.supplier} /></TableCell>
                    <TableCell className="text-right num">{kg(r.netKg)}</TableCell>
                    <TableCell><StatusChip s={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
        <div className="stack">
          <Card title="ผู้ขายหลัก" sub="ตามน้ำหนักรับเข้าสะสม">
            <div className="stack" style={{ gap: 10 }}>
              {suppliers.slice(0, 6).map((s) => (
                <div key={s.name} className="stack" style={{ gap: 4 }}>
                  <div className="row"><SupplierLink name={s.name} /><span className="spacer" /><span className="num">{tonne(s.kg)}</span></div>
                  <Bar v={s.kg} max={supMax} />
                </div>
              ))}
            </div>
          </Card>
          {pending.length > 0 && (
            <Note tone="warn">
              มี {pending.length} ใบรับที่ยังไม่มีราคา มูลค่าสต๊อกจึงคิดจากต้นทุนถัวเฉลี่ยของใบที่มีราคาแล้ว{' '}
              <button className={LINK} onClick={() => go({ page: 'receipts', month: 'pending' })}>ไปใส่ราคา</button>
            </Note>
          )}
        </div>
      </div>
    </>
  );
}
