import React, { useEffect, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, Note, PageHead, useApp } from '../components/ui';
import { nextDocId } from '../lib/calc';
import { baht, kg, round2, thDate, todayISO } from '../lib/format';
import type { Issue } from '../lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Issues() {
  const { local, nav, update, toast } = useApp();
  const [form, setForm] = useState(!!nav.newForm);
  useEffect(() => { if (nav.newForm) setForm(true); }, [nav]);
  const rows = [...local.issues].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const del = (id: string) => { update((d) => ({ ...d, issues: d.issues.filter((x) => x.id !== id) })); toast(`ลบ ${id} แล้ว · คืนยอดเข้าสต๊อก`); };
  return (
    <>
      <PageHead
        crumb="จ่ายสินค้า"
        title="จ่ายออก / ขาย"
        desc="บันทึกสินค้าที่ขายหรือส่งออกจากโกดัง ระบบจะตัดยอดสต๊อกของเกรดนั้นทันที"
        actions={<Button onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกจ่ายออก</Button>}
      />
      <Card pad={false}>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>เลขที่</TableHead><TableHead>วันที่</TableHead><TableHead>ลูกค้า / ปลายทาง</TableHead><TableHead>เกรด</TableHead><TableHead className="text-right">น้ำหนัก (กก.)</TableHead><TableHead className="text-right">มูลค่าขาย (บาท)</TableHead><TableHead>หมายเหตุ</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="num">{i.id}</TableCell>
                  <TableCell className="num">{thDate(i.date)}</TableCell>
                  <TableCell>{i.customer}</TableCell>
                  <TableCell><div className="chips">{i.lines.map((l) => <GradeChip key={l.grade} g={l.grade} kg={kg(l.net)} />)}</div></TableCell>
                  <TableCell className="text-right num">{kg(i.lines.reduce((s, l) => s + l.net, 0))}</TableCell>
                  <TableCell className="text-right num">{baht(i.lines.reduce((s, l) => s + l.net * l.price, 0))}</TableCell>
                  <TableCell className="muted">{i.note}</TableCell>
                  <TableCell className="text-right"><ConfirmButton small onConfirm={() => del(i.id)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && (
            <Empty>
              <p>ยังไม่มีรายการจ่ายออก ชีตต้นฉบับบันทึกเฉพาะฝั่งรับเข้า</p>
              <Button onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการขายครั้งแรก</Button>
            </Empty>
          )}
        </div>
      </Card>
      {form && <IssueForm onClose={() => setForm(false)} />}
    </>
  );
}

function IssueForm({ onClose }: { onClose: () => void }) {
  const { model, local, update, toast } = useApp();
  const [date, setDate] = useState(todayISO());
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const avail = model.grades.filter((g) => g.balance > 0);
  const [lines, setLines] = useState([{ grade: avail[0]?.grade ?? 'ปอก', net: '', price: '' }]);
  const [err, setErr] = useState('');
  const customers = [...new Set(local.issues.map((i) => i.customer))];

  const save = () => {
    const ls = lines.map((l) => ({ grade: l.grade, net: round2(Number(l.net) || 0), price: Number(l.price) || 0 })).filter((l) => l.net > 0);
    if (!customer.trim()) return setErr('กรุณาระบุลูกค้าหรือปลายทาง');
    if (!ls.length) return setErr('กรุณาใส่น้ำหนักอย่างน้อย 1 รายการ');
    const over = ls.find((l) => l.net > (model.gradeByName.get(l.grade)?.balance ?? 0));
    if (over && !err.startsWith('ยืนยัน')) return setErr(`ยืนยัน: ${over.grade} คงเหลือไม่พอ (${kg(model.gradeByName.get(over.grade)?.balance ?? 0)} กก.) กดบันทึกอีกครั้งเพื่อบันทึกต่อ`);
    const rec: Issue = { id: nextDocId('S', local.issues, date), date, customer: customer.trim(), lines: ls, note: note.trim() || undefined };
    update((d) => ({ ...d, issues: [...d.issues, rec] }));
    toast(`บันทึก ${rec.id} แล้ว · ตัดสต๊อก ${kg(ls.reduce((s, l) => s + l.net, 0))} กก.`);
    onClose();
  };

  return (
    <Drawer title="บันทึกจ่ายออก / ขาย" onClose={onClose}>
      <div className="panel stack">
        <div className="form-grid">
          <div className="field"><Label htmlFor="i-date">วันที่</Label><Input id="i-date"  type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><Label htmlFor="i-cus">ลูกค้า / ปลายทาง</Label><Input id="i-cus"  list="cus-list" value={customer} onChange={(e) => setCustomer(e.target.value)} /><datalist id="cus-list">{customers.map((c) => <option key={c} value={c} />)}</datalist></div>
        </div>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>เกรด</TableHead><TableHead className="text-right">คงเหลือ</TableHead><TableHead className="text-right">น้ำหนักจ่าย (กก.)</TableHead><TableHead className="text-right">ราคาขาย/กก.</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><NativeSelect id={`il-g-${i}`} value={l.grade} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, grade: e.target.value } : y)))}>{model.grades.filter((g) => g.balance > 0 || g.grade === l.grade).map((g) => <option key={g.grade}>{g.grade}</option>)}</NativeSelect></TableCell>
                  <TableCell className="text-right num muted">{kg(model.gradeByName.get(l.grade)?.balance ?? 0)}</TableCell>
                  <TableCell className="text-right"><Input id={`il-n-${i}`} className="num text-right" style={{ width: 120 }} inputMode="decimal" value={l.net} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, net: e.target.value } : y)))} /></TableCell>
                  <TableCell className="text-right"><Input id={`il-p-${i}`} className="num text-right" style={{ width: 110 }} inputMode="decimal" value={l.price} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" aria-label="ลบแถว" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={15} /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLines((x) => [...x, { grade: avail[0]?.grade ?? 'ปอก', net: '', price: '' }])}><Icon name="plus" size={14} />เพิ่มเกรด</Button>
        <div className="field"><Label htmlFor="i-note">หมายเหตุ</Label><Input id="i-note"  value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ทะเบียนรถ เลขที่ใบส่งของ" /></div>
      </div>
      {err && <Note tone="warn">{err}</Note>}
      <div className="row"><span className="spacer" /><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึกจ่ายออก</Button></div>
    </Drawer>
  );
}
