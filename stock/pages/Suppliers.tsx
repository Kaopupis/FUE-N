import React from 'react';
import { Bar, Card, GradeChip, Icon, Kpi, PageHead, ReceiptLink, StatusChip, gradeColor, useApp } from '../components/ui';
import { baht, bahtShort, kg, thDate, tonne } from '../lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Suppliers() {
  const { model, nav, go } = useApp();
  const s = nav.supplier ? model.supplierByName.get(nav.supplier) : undefined;
  const max = Math.max(...model.suppliers.map((x) => x.kg), 1);

  return (
    <>
      <PageHead crumb="คู่ค้า" title="ผู้ขาย / คู่ค้า" desc="สรุปผู้ขายจากใบรับ กดชื่อเพื่อดูใบรับ เกรดที่ส่ง และยอดซื้อ" />
      <Card pad={false}>
        <div style={{ marginTop: 4 }}>
          <Table>
            <TableHeader><TableRow><TableHead>ผู้ขาย</TableHead><TableHead>กลุ่ม</TableHead><TableHead className="text-right">ใบรับ</TableHead><TableHead style={{ minWidth: 160 }}>น้ำหนักรับเข้า</TableHead><TableHead className="text-right">ยอดซื้อก่อน VAT</TableHead><TableHead className="text-right">ราคาเฉลี่ย/กก.</TableHead><TableHead>เกรดหลัก</TableHead><TableHead>รับล่าสุด</TableHead></TableRow></TableHeader>
            <TableBody>
              {model.suppliers.map((x) => {
                const pricedKg = model.receipts.filter((r) => r.supplier === x.name).reduce((a, r) => a + r.lines.filter((l) => l.price > 0).reduce((b, l) => b + l.net, 0), 0);
                const topG = Object.entries(x.grades).sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <TableRow key={x.name} className={`click${s?.name === x.name ? ' sel' : ''}`} onClick={() => go({ page: 'suppliers', supplier: x.name })}>
                    <TableCell><b>{x.name}</b>{x.noVat && <Badge variant="info" style={{ marginLeft: 6 }}>No VAT</Badge>}</TableCell>
                    <TableCell className="muted">{x.group !== x.name ? `เครือ ${x.group}` : '–'}</TableCell>
                    <TableCell className="text-right num">{x.receipts.length}</TableCell>
                    <TableCell><div className="stack" style={{ gap: 3 }}><span className="num" style={{ fontSize: 13 }}>{kg(x.kg)} กก.</span><Bar v={x.kg} max={max} /></div></TableCell>
                    <TableCell className="text-right num">{baht(x.value)}</TableCell>
                    <TableCell className="text-right num">{pricedKg ? baht(x.value / pricedKg) : '–'}</TableCell>
                    <TableCell><div className="chips">{topG.map(([g]) => <GradeChip key={g} g={g} />)}</div></TableCell>
                    <TableCell className="num muted">{thDate(x.last)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {s && (
        <>
          <div className="row">
            <h2 style={{ fontSize: '1.35rem' }}>{s.name}</h2>
            {s.pending > 0 && <Badge variant="warning">รอราคา {s.pending} ใบ</Badge>}
            <span className="spacer" />
            <Button variant="outline" size="sm" onClick={() => go({ page: 'relations', supplier: s.name })}><Icon name="relations" size={14} />ผังความสัมพันธ์</Button>
            <Button variant="outline" size="sm" onClick={() => go({ page: 'receipts', supplier: s.name })}>กรองใบรับ</Button>
          </div>
          <div className="grid-kpi">
            <Kpi hero label="น้ำหนักรับเข้า" value={kg(s.kg)} unit="กก." sub={tonne(s.kg)} />
            <Kpi label="ยอดซื้อก่อน VAT" value={bahtShort(s.value)} unit="บาท" />
            <Kpi label="จำนวนใบรับ" value={String(s.receipts.length)} unit="ใบ" sub={`${thDate(s.first)} – ${thDate(s.last)}`} />
            <Kpi label="สัดส่วนของทั้งหมด" value={((s.kg / model.totals.kg) * 100).toFixed(1)} unit="%" sub="ตามน้ำหนัก" />
          </div>
          <div className="grid-2">
            <Card title="ใบรับของผู้ขายนี้" pad={false}>
              <div className="scroll-y" style={{ maxHeight: 420, marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead>เลขที่รับ</TableHead><TableHead>วันที่</TableHead><TableHead className="text-right">นน.สุทธิ</TableHead><TableHead className="text-right">รวม VAT</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[...s.receipts].reverse().map((id) => {
                      const r = model.receiptById.get(id)!;
                      return (
                        <TableRow key={id} className="click" onClick={() => go({ page: 'receipts', receiptId: id, supplier: s.name })}>
                          <TableCell><ReceiptLink id={id} /></TableCell><TableCell className="num">{thDate(r.date)}</TableCell><TableCell className="text-right num">{kg(r.netKg)}</TableCell><TableCell className="text-right num">{r.total ? baht(r.total) : '–'}</TableCell><TableCell><StatusChip s={r.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <Card title="เกรดที่ส่ง" sub="น้ำหนักสะสม (กก.)">
              <div className="stack" style={{ gap: 10 }}>
                {Object.entries(s.grades).sort((a, b) => b[1] - a[1]).map(([g, q]) => (
                  <div key={g} className="stack" style={{ gap: 4 }}>
                    <div className="row"><GradeChip g={g} /><span className="spacer" /><span className="num">{kg(q)}</span><span className="muted" style={{ fontSize: 12, width: 46, textAlign: 'right' }}>{((q / s.kg) * 100).toFixed(1)}%</span></div>
                    <Bar v={q} max={s.kg} color={gradeColor(g)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
