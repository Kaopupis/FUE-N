import React, { useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, Note, PageHead, Pill, useApp } from '../components/ui';
import { nextDocId } from '../lib/calc';
import { kg, round2, thDate, todayISO } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// คัดแยกเกรด: ตามชีต "คัดแยกเกรด & Stock คงเหลือ" — น้ำหนักก่อนคัดแยก → น้ำหนักหลังคัดแยก
export default function Sorting() {
  const { local, update, toast } = useApp();
  const [form, setForm] = useState(false);
  const rows = [...local.sorts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return (
    <>
      <PageHead
        crumb="คัดแยก"
        title="คัดแยกเกรด"
        desc="ย้ายน้ำหนักจากเกรดต้นทางไปยังเกรดที่คัดได้ ส่วนต่างบันทึกเป็นน้ำหนักสูญเสีย"
        actions={<Button onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการคัด</Button>}
      />
      <Card pad={false}>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>เลขที่</TableHead><TableHead>วันที่คัด</TableHead><TableHead>เกรดต้นทาง</TableHead><TableHead className="text-right">นน.ก่อนคัด</TableHead><TableHead>ผลการคัด</TableHead><TableHead className="text-right">นน.หลังคัด</TableHead><TableHead className="text-right">สูญเสีย</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((s) => {
                const out = s.outputs.reduce((a, o) => a + o.net, 0);
                const loss = s.input - out;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="num">{s.id}</TableCell>
                    <TableCell className="num">{thDate(s.date)}</TableCell>
                    <TableCell><GradeChip g={s.fromGrade} /></TableCell>
                    <TableCell className="text-right num">{kg(s.input)}</TableCell>
                    <TableCell><div className="chips">{s.outputs.map((o) => <GradeChip key={o.grade} g={o.grade} kg={kg(o.net)} />)}</div></TableCell>
                    <TableCell className="text-right num">{kg(out)}</TableCell>
                    <TableCell className="text-right num"><Pill tone={loss / s.input > 0.02 ? 'bad' : 'plain'}>{kg(loss)} ({((loss / s.input) * 100).toFixed(1)}%)</Pill></TableCell>
                    <TableCell className="text-right"><ConfirmButton small onConfirm={() => { update((d) => ({ ...d, sorts: d.sorts.filter((x) => x.id !== s.id) })); toast(`ลบ ${s.id} แล้ว`); }} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length && (
            <Empty>
              <p>ยังไม่มีการคัดแยก เช่น นำ “ปอก” 1,000 กก. มาคัดเป็น ปอก/ช็อต/ใหญ่</p>
              <Button onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการคัดครั้งแรก</Button>
            </Empty>
          )}
        </div>
      </Card>
      {form && <SortForm onClose={() => setForm(false)} />}
    </>
  );
}

function SortForm({ onClose }: { onClose: () => void }) {
  const { model, local, update, toast } = useApp();
  const avail = model.grades.filter((g) => g.balance > 0);
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState(avail[0]?.grade ?? 'ปอก');
  const [input, setInput] = useState('');
  const [outs, setOuts] = useState([{ grade: 'ปอก', net: '' }, { grade: 'ช็อต', net: '' }]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const inN = Number(input) || 0;
  const outN = outs.reduce((s, o) => s + (Number(o.net) || 0), 0);
  const save = () => {
    const outputs = outs.map((o) => ({ grade: o.grade, net: round2(Number(o.net) || 0) })).filter((o) => o.net > 0);
    if (!inN) return setErr('กรุณาใส่น้ำหนักก่อนคัด');
    if (!outputs.length) return setErr('กรุณาใส่ผลการคัดอย่างน้อย 1 เกรด');
    if (outN > inN) return setErr('น้ำหนักหลังคัดมากกว่าก่อนคัด กรุณาตรวจสอบ');
    const id = nextDocId('C', local.sorts, date);
    update((d) => ({ ...d, sorts: [...d.sorts, { id, date, fromGrade: from, input: round2(inN), outputs, note: note.trim() || undefined }] }));
    toast(`บันทึกการคัด ${id} แล้ว`);
    onClose();
  };
  return (
    <Drawer title="บันทึกการคัดแยกเกรด" onClose={onClose}>
      <div className="panel stack">
        <div className="form-grid">
          <div className="field"><Label htmlFor="s-date">วันที่คัด</Label><Input id="s-date"  type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><Label htmlFor="s-from">เกรดต้นทาง</Label><NativeSelect id="s-from" value={from} onChange={(e) => setFrom(e.target.value)}>{avail.map((g) => <option key={g.grade}>{g.grade}</option>)}</NativeSelect></div>
          <div className="field"><Label htmlFor="s-in">น้ำหนักก่อนคัด (กก.)</Label><Input id="s-in" className="num text-right" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} /></div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>คงเหลือ {from}: <b className="num">{kg(model.gradeByName.get(from)?.balance ?? 0)}</b> กก.</p>
      </div>
      <div className="panel stack">
        <h3>น้ำหนักหลังคัดแยก</h3>
        <datalist id="sort-grade-list">{model.grades.map((g) => <option key={g.grade} value={g.grade} />)}</datalist>
        {outs.map((o, i) => (
          <div key={i} className="row">
            <Input id={`so-g-${i}`}  list="sort-grade-list" style={{ flex: '1 1 140px', width: 'auto' }} value={o.grade} onChange={(e) => setOuts((x) => x.map((y, j) => (j === i ? { ...y, grade: e.target.value } : y)))} />
            <Input id={`so-n-${i}`} className="num text-right" style={{ flex: '1 1 120px', width: 'auto' }} inputMode="decimal" placeholder="กก." value={o.net} onChange={(e) => setOuts((x) => x.map((y, j) => (j === i ? { ...y, net: e.target.value } : y)))} />
            <Button variant="ghost" size="icon" aria-label="ลบแถว" onClick={() => setOuts((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={15} /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOuts((x) => [...x, { grade: 'ใหญ่', net: '' }])}><Icon name="plus" size={14} />เพิ่มเกรด</Button>
        <Note>ก่อนคัด <b className="num">{kg(inN)}</b> · หลังคัด <b className="num">{kg(outN)}</b> · สูญเสีย <b className="num">{kg(inN - outN)}</b> กก. {inN ? `(${(((inN - outN) / inN) * 100).toFixed(2)}%)` : ''}</Note>
        <div className="field"><Label htmlFor="s-note">หมายเหตุ</Label><Input id="s-note"  value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {err && <Note tone="warn">{err}</Note>}
      <div className="row"><span className="spacer" /><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึกการคัด</Button></div>
    </Drawer>
  );
}
