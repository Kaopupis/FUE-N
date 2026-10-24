import React, { useState } from 'react';
import { Card, Drawer, GradeChip, Icon, Kpi, Note, PageHead, useApp } from '../components/ui';
import { FAMILY_ORDER } from '../lib/data';
import { nextDocId } from '../lib/calc';
import { baht, bahtShort, kg, round2, thDate, todayISO } from '../lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function Stock() {
  const { model, go } = useApp();
  const [fam, setFam] = useState<string>('ทั้งหมด');
  const [showZero, setShowZero] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const rows = model.grades.filter((g) => (fam === 'ทั้งหมด' || g.family === fam) && (showZero || g.balance !== 0 || g.received > 0));
  const sum = (k: 'received' | 'issued' | 'sortedIn' | 'sortedOut' | 'adjusted' | 'balance' | 'value') => rows.reduce((s, g) => s + g[k], 0);
  const families = FAMILY_ORDER.filter((f) => model.grades.some((g) => g.family === f && g.received > 0));
  const byFam = families.map((f) => ({ f, kg: model.grades.filter((g) => g.family === f).reduce((s, g) => s + g.balance, 0) }));

  return (
    <>
      <PageHead
        crumb="สต๊อก"
        title="สต๊อกคงเหลือ"
        desc="คงเหลือ = รับเข้า + ได้จากคัดแยก − นำไปคัด − จ่ายออก ± ปรับยอด"
        actions={<Button variant="outline" onClick={() => setAdjust(true)}><Icon name="scale" size={16} />ปรับยอดสต๊อก</Button>}
      />
      <div className="grid-kpi">
        <Kpi hero label="คงเหลือรวม" value={kg(model.totals.balance)} unit="กก." sub={`มูลค่าประมาณ ${bahtShort(model.totals.stockValue)} บาท`} />
        {byFam.map((x) => <Kpi key={x.f} label={x.f} value={kg(x.kg)} unit="กก." onClick={() => setFam(x.f)} sub="กดเพื่อกรอง" />)}
      </div>
      <Card
        title="ยอดคงเหลือแยกเกรด"
        sub="ต้นทุนเฉลี่ยคิดจากใบรับที่มีราคา · กดแถวเพื่อดูบัตรสต๊อก"
        pad={false}
        right={
          <div className="filters">
            <ToggleGroup type="single" variant="outline" size="sm" value={fam} onValueChange={(v) => v && setFam(v)}>
              {['ทั้งหมด', ...families].map((f) => <ToggleGroupItem key={f} value={f} className="px-3">{f}</ToggleGroupItem>)}
            </ToggleGroup>
            <Label htmlFor="show-zero" className="font-normal"><Checkbox id="show-zero" checked={showZero} onCheckedChange={(v) => setShowZero(v === true)} />แสดงเกรดที่ไม่มีของ</Label>
          </div>
        }
      >
        <div style={{ marginTop: 10 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เกรด</TableHead><TableHead>กลุ่ม</TableHead><TableHead className="text-right">รับเข้า</TableHead><TableHead className="text-right">ได้จากคัด</TableHead><TableHead className="text-right">นำไปคัด</TableHead>
                <TableHead className="text-right">จ่ายออก</TableHead><TableHead className="text-right">ปรับยอด</TableHead><TableHead className="text-right">คงเหลือ (กก.)</TableHead><TableHead className="text-right">ต้นทุนเฉลี่ย/กก.</TableHead><TableHead className="text-right">มูลค่า (บาท)</TableHead><TableHead>เคลื่อนไหวล่าสุด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.grade} className="click" onClick={() => go({ page: 'grades', grade: g.grade })}>
                  <TableCell><GradeChip g={g.grade} /></TableCell>
                  <TableCell className="muted">{g.family}</TableCell>
                  <TableCell className="text-right num">{kg(g.received)}</TableCell>
                  <TableCell className="text-right num muted">{g.sortedIn ? kg(g.sortedIn) : '–'}</TableCell>
                  <TableCell className="text-right num muted">{g.sortedOut ? kg(g.sortedOut) : '–'}</TableCell>
                  <TableCell className="text-right num muted">{g.issued ? kg(g.issued) : '–'}</TableCell>
                  <TableCell className="text-right num muted">{g.adjusted ? kg(g.adjusted) : '–'}</TableCell>
                  <TableCell className="text-right num" style={{ fontWeight: 600, color: g.balance < 0 ? 'var(--destructive)' : undefined }}>{kg(g.balance)}</TableCell>
                  <TableCell className="text-right num">{g.avgCost ? baht(g.avgCost) : <Badge variant="warning">ไม่มีราคา</Badge>}</TableCell>
                  <TableCell className="text-right num">{baht(g.value)}</TableCell>
                  <TableCell className="num muted">{g.lastDate ? thDate(g.lastDate) : '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>รวม {rows.length} เกรด</TableCell>
                <TableCell className="text-right num">{kg(sum('received'))}</TableCell><TableCell className="text-right num">{kg(sum('sortedIn'))}</TableCell><TableCell className="text-right num">{kg(sum('sortedOut'))}</TableCell>
                <TableCell className="text-right num">{kg(sum('issued'))}</TableCell><TableCell className="text-right num">{kg(sum('adjusted'))}</TableCell><TableCell className="text-right num">{kg(sum('balance'))}</TableCell>
                <TableCell /><TableCell className="text-right num">{baht(sum('value'))}</TableCell><TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
      {adjust && <AdjustDrawer onClose={() => setAdjust(false)} />}
    </>
  );
}

export function AdjustDrawer({ onClose, grade }: { onClose: () => void; grade?: string }) {
  const { model, update, toast, local } = useApp();
  const [date, setDate] = useState(todayISO());
  const [g, setG] = useState(grade ?? model.grades[0].grade);
  const [mode, setMode] = useState<'count' | 'delta'>('count');
  const [val, setVal] = useState('');
  const [reason, setReason] = useState('ตรวจนับสต๊อก');
  const cur = model.gradeByName.get(g)?.balance ?? 0;
  const n = Number(val);
  const delta = val === '' || isNaN(n) ? 0 : round2(mode === 'count' ? n - cur : n);
  const save = () => {
    if (!delta) return;
    update((d) => ({ ...d, adjustments: [...d.adjustments, { id: nextDocId('ADJ', local.adjustments, date), date, grade: g, qty: delta, reason }] }));
    toast(`ปรับยอด ${g} ${delta > 0 ? '+' : ''}${kg(delta)} กก. แล้ว`);
    onClose();
  };
  return (
    <Drawer title="ปรับยอดสต๊อก" onClose={onClose}>
      <div className="panel stack">
        <div className="form-grid">
          <div className="field"><Label htmlFor="adj-date">วันที่</Label><Input id="adj-date"  type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><Label htmlFor="adj-grade">เกรด</Label>
            <NativeSelect id="adj-grade" value={g} onChange={(e) => setG(e.target.value)}>{model.grades.map((x) => <option key={x.grade}>{x.grade}</option>)}</NativeSelect>
          </div>
        </div>
        <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as 'count' | 'delta')}>
          <ToggleGroupItem value="count" className="px-4">ใส่ยอดนับจริง</ToggleGroupItem>
          <ToggleGroupItem value="delta" className="px-4">เพิ่ม/ลด</ToggleGroupItem>
        </ToggleGroup>
        <div className="form-grid">
          <div className="field"><Label htmlFor="adj-val">{mode === 'count' ? 'น้ำหนักที่นับได้ (กก.)' : 'จำนวนที่ปรับ (กก. ใส่ลบเพื่อลด)'}</Label><Input id="adj-val" className="num text-right" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0.0" /></div>
          <div className="field"><Label htmlFor="adj-reason">เหตุผล</Label><Input id="adj-reason"  value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <Note>ยอดในระบบตอนนี้ <b className="num">{kg(cur)}</b> กก. → ปรับ <b className="num">{delta > 0 ? '+' : ''}{kg(delta)}</b> กก. → คงเหลือ <b className="num">{kg(cur + delta)}</b> กก.</Note>
        <div className="row"><span className="spacer" /><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button disabled={!delta} onClick={save}>บันทึกการปรับยอด</Button></div>
      </div>
    </Drawer>
  );
}
