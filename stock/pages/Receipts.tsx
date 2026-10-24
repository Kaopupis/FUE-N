import React, { useEffect, useMemo, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, Note, PageHead, ReceiptLink, StatusChip, SupplierLink, useApp } from '../components/ui';
import { DEFAULT_TARE, SHEET_URL, VAT_RATE } from '../lib/data';
import { ReceiptView, linesFromBags, nextReceiptId } from '../lib/calc';
import { baht, kg, monthKey, monthLabel, round2, thDate, thDateLong, todayISO } from '../lib/format';
import type { Bag, PriceLine, Receipt } from '../lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export default function Receipts() {
  const { model, nav, go } = useApp();
  const [q, setQ] = useState('');
  const [month, setMonth] = useState(nav.month ?? '');
  const [sup, setSup] = useState(nav.supplier ?? '');
  const [grade, setGrade] = useState(nav.grade ?? '');
  const [form, setForm] = useState<Receipt | 'new' | null>(nav.newForm ? 'new' : null);
  const open = nav.receiptId ? model.receiptById.get(nav.receiptId) : undefined;

  useEffect(() => {
    setMonth(nav.month ?? '');
    setSup(nav.supplier ?? '');
    setGrade(nav.grade ?? '');
    if (nav.newForm) setForm('new');
  }, [nav]);

  const months = model.months.map((m) => m.month).reverse();
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return model.receipts.filter(
      (r) =>
        (!month || (month === 'pending' ? r.status !== 'priced' : monthKey(r.date) === month)) &&
        (!sup || r.supplier === sup) &&
        (!grade || r.qty[grade]) &&
        (!s || r.id.toLowerCase().includes(s) || r.supplier.toLowerCase().includes(s) || r.plates.some((p) => p.includes(s))),
    );
  }, [model, q, month, sup, grade]);
  const totKg = rows.reduce((s, r) => s + (grade ? r.qty[grade] ?? 0 : r.netKg), 0);
  const totVal = rows.reduce((s, r) => s + r.total, 0);
  const closeDetail = () => go({ page: 'receipts', month: month || undefined, supplier: sup || undefined, grade: grade || undefined });

  return (
    <>
      <PageHead
        crumb="รับสินค้า"
        title="ใบรับสินค้า (เข้า)"
        desc="ทุกใบรับมาจากชีตบัญชีรับส่งสินค้า และใบที่บันทึกเพิ่มในระบบนี้"
        actions={<Button onClick={() => setForm('new')}><Icon name="plus" size={16} />สร้างใบรับใหม่</Button>}
      />
      <Card pad={false}>
        <div className="filters px-4">
          <Input id="rc-search" className="search" placeholder="ค้นหาเลขที่รับ ผู้ขาย หรือทะเบียนรถ" value={q} onChange={(e) => setQ(e.target.value)} />
          <NativeSelect id="rc-month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">ทุกเดือน</option>
            <option value="pending">เฉพาะใบที่รอราคา</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
          </NativeSelect>
          <NativeSelect id="rc-sup" value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value="">ผู้ขายทั้งหมด</option>
            {model.suppliers.map((s) => <option key={s.name}>{s.name}</option>)}
          </NativeSelect>
          <NativeSelect id="rc-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">ทุกเกรด</option>
            {model.grades.filter((g) => g.receiptCount).map((g) => <option key={g.grade}>{g.grade}</option>)}
          </NativeSelect>
          {(q || month || sup || grade) && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setMonth(''); setSup(''); setGrade(''); }}>ล้างตัวกรอง</Button>}
        </div>
        <div className="px-4" style={{ paddingTop: 0 }}>
          <div className="row" style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            พบ <b>{rows.length}</b> ใบ · น้ำหนัก{grade ? ` ${grade}` : 'สุทธิ'} <b className="num">{kg(totKg)}</b> กก. · ยอดรวม VAT <b className="num">{baht(totVal)}</b> บาท
          </div>
        </div>
        <div className="scroll-y">
          <Table>
            <TableHeader>
              <TableRow><TableHead>เลขที่รับ</TableHead><TableHead>วันที่</TableHead><TableHead>ผู้ขาย</TableHead><TableHead>ทะเบียนรถ</TableHead><TableHead>เกรด</TableHead><TableHead className="text-right">กระสอบ</TableHead><TableHead className="text-right">นน.สุทธิ (กก.)</TableHead><TableHead className="text-right">รวม VAT (บาท)</TableHead><TableHead>สถานะราคา</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={`click${open?.id === r.id ? ' sel' : ''}`} onClick={() => go({ page: 'receipts', receiptId: r.id, month: month || undefined, supplier: sup || undefined, grade: grade || undefined })}>
                  <TableCell><ReceiptLink id={r.id} />{r.source === 'local' && <Badge variant="info" style={{ marginLeft: 6 }}>บันทึกใหม่</Badge>}</TableCell>
                  <TableCell className="num">{thDate(r.date)}</TableCell>
                  <TableCell><SupplierLink name={r.supplier} /></TableCell>
                  <TableCell className="num muted">{r.plates.join(', ') || '–'}</TableCell>
                  <TableCell><div className="chips">{Object.keys(r.qty).slice(0, 4).map((g) => <GradeChip key={g} g={g} />)}{Object.keys(r.qty).length > 4 && <Badge variant="outline">+{Object.keys(r.qty).length - 4}</Badge>}</div></TableCell>
                  <TableCell className="text-right num">{r.bags.length || '–'}</TableCell>
                  <TableCell className="text-right num">{kg(r.netKg)}</TableCell>
                  <TableCell className="text-right num">{r.total ? baht(r.total) : '–'}</TableCell>
                  <TableCell><StatusChip s={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <Empty>ไม่พบใบรับที่ตรงกับตัวกรอง</Empty>}
        </div>
      </Card>
      {open && <ReceiptDetail r={open} onClose={closeDetail} onEdit={() => setForm(open)} />}
      {form && <ReceiptForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}

function ReceiptDetail({ r, onClose, onEdit }: { r: ReceiptView; onClose: () => void; onEdit: () => void }) {
  const { update, toast, go } = useApp();
  const [pricing, setPricing] = useState(false);
  const gross = r.bags.reduce((s, b) => s + b.gross, 0);
  const tare = r.bags.reduce((s, b) => s + b.tare, 0);
  const diff = r.truckKg ? r.truckKg - r.netKg : 0;
  const del = () => {
    update((d) => ({ ...d, receipts: d.receipts.filter((x) => x.id !== r.id) }));
    toast(`ลบใบรับ ${r.id} แล้ว`);
    onClose();
  };
  return (
    <Drawer
      title={<>ใบรับ <span className="num">{r.id}</span></>}
      onClose={onClose}
      right={r.source === 'local' ? <Button variant="outline" size="sm" onClick={onEdit}>แก้ไข</Button> : undefined}
    >
      <div className="panel stack">
        <div className="row"><StatusChip s={r.status} />{r.noVat && <Badge variant="info">ไม่มี VAT</Badge>}{r.source === 'sheet' ? <Badge variant="outline">จากชีต</Badge> : <Badge variant="info">บันทึกในระบบ</Badge>}{r.overridden && <Badge variant="info">ราคาใส่ในระบบ</Badge>}</div>
        <div className="kv">
          <div><span>วันที่รับ</span><b>{thDateLong(r.date)}</b></div>
          <div><span>ประเภท</span><b>รับซื้อ</b></div>
          <div><span>ผู้ขาย</span><b><SupplierLink name={r.supplier} /></b></div>
          <div><span>ทะเบียนรถ / คันที่</span><b className="num">{r.plates.join(', ') || '–'} {r.trip ? `(คันที่ ${r.trip})` : ''}</b></div>
        </div>
        {r.note && <Note>{r.note}</Note>}
      </div>

      {r.truckNet.length > 0 && (
        <div className="panel stack">
          <h3>ตาชั่งรถ</h3>
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>คัน</TableHead><TableHead className="text-right">ชั่งเข้า</TableHead><TableHead className="text-right">ชั่งออก</TableHead><TableHead className="text-right">สุทธิ (กก.)</TableHead></TableRow></TableHeader>
              <TableBody>{r.truckNet.map((n, i) => <TableRow key={i}><TableCell>{i + 1}</TableCell><TableCell className="text-right num">{kg(r.truckIn[i] ?? 0)}</TableCell><TableCell className="text-right num">{kg(r.truckOut[i] ?? 0)}</TableCell><TableCell className="text-right num">{kg(n)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          {r.netKg > 0 && <Note tone={Math.abs(diff) > r.truckKg * 0.01 ? 'warn' : 'info'}>ตาชั่งรถ {kg(r.truckKg)} กก. เทียบกับน้ำหนักกระสอบสุทธิ {kg(r.netKg)} กก. ต่างกัน <b className="num">{kg(diff)}</b> กก. ({r.truckKg ? ((diff / r.truckKg) * 100).toFixed(2) : 0}%)</Note>}
        </div>
      )}

      <div className="panel stack">
        <div className="row"><h3>ราคารับซื้อ</h3><span className="spacer" /><Button variant="outline" size="sm" onClick={() => setPricing(true)}>{r.status === 'priced' ? 'แก้ไขราคา' : 'ใส่ราคา'}</Button></div>
        {r.lines.length ? (
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>เกรด</TableHead><TableHead className="text-right">นน.สุทธิ (หักเต๋าแล้ว)</TableHead><TableHead className="text-right">ราคา/กก.</TableHead><TableHead className="text-right">ราคารวม</TableHead></TableRow></TableHeader>
              <TableBody>{r.lines.map((l, i) => <TableRow key={i}><TableCell><GradeChip g={l.grade} /></TableCell><TableCell className="text-right num">{kg(l.net)}</TableCell><TableCell className="text-right num">{l.price ? baht(l.price) : <Badge variant="warning">รอราคา</Badge>}</TableCell><TableCell className="text-right num">{baht(l.total)}</TableCell></TableRow>)}</TableBody>
              <TableFooter>
                <TableRow><TableCell colSpan={3}>รวม</TableCell><TableCell className="text-right num">{baht(r.subtotal)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={3}>VAT {r.noVat ? '(ไม่มี)' : `${VAT_RATE * 100}%`}</TableCell><TableCell className="text-right num">{baht(r.vat)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={3}>รวม VAT</TableCell><TableCell className="text-right num" style={{ color: 'var(--primary)' }}>{baht(r.total)}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : <Empty>ยังไม่มีรายการราคา</Empty>}
      </div>

      {r.bags.length > 0 && (
        <div className="panel stack">
          <h3>รายการกระสอบ ({r.bags.length})</h3>
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>ลำดับ</TableHead><TableHead>เกรด</TableHead><TableHead className="text-right">นน.ก่อน (ชั่งเข้า)</TableHead><TableHead className="text-right">นน. เต๋า/กระสอบ</TableHead><TableHead className="text-right">นน.สุทธิ</TableHead></TableRow></TableHeader>
              <TableBody>{r.bags.map((b) => <TableRow key={b.no}><TableCell>{b.no}</TableCell><TableCell><GradeChip g={b.grade} /></TableCell><TableCell className="text-right num">{kg(b.gross)}</TableCell><TableCell className="text-right num">{kg(b.tare)}</TableCell><TableCell className="text-right num">{kg(b.net)}</TableCell></TableRow>)}</TableBody>
              <TableFooter><TableRow><TableCell colSpan={2}>รวม</TableCell><TableCell className="text-right num">{kg(gross)}</TableCell><TableCell className="text-right num">{kg(tare)}</TableCell><TableCell className="text-right num">{kg(r.netKg)}</TableCell></TableRow></TableFooter>
            </Table>
          </div>
        </div>
      )}

      <div className="row">
        <Button variant="outline" onClick={() => go({ page: 'relations', supplier: r.supplier })}><Icon name="relations" size={16} />ดูความสัมพันธ์ผู้ขายนี้</Button>
        {r.source === 'sheet' && <Button variant="outline" asChild><a href={SHEET_URL} target="_blank" rel="noreferrer"><Icon name="ext" size={16} />เปิดชีตต้นฉบับ</a></Button>}
        <span className="spacer" />
        {r.source === 'local' && <ConfirmButton onConfirm={del} label="ลบใบรับนี้" />}
      </div>
      {pricing && <PriceEditor r={r} onClose={() => setPricing(false)} />}
    </Drawer>
  );
}

// ใส่หรือแก้ราคาต่อเกรด (ใช้ได้ทั้งใบจากชีตและใบที่บันทึกใหม่)
function PriceEditor({ r, onClose }: { r: ReceiptView; onClose: () => void }) {
  const { update, toast, model } = useApp();
  const base = r.lines.length ? r.lines : linesFromBags(r);
  const [lines, setLines] = useState<PriceLine[]>(base.map((l) => ({ ...l, price: l.price || model.gradeByName.get(l.grade)?.lastPrice || 0 })));
  const set = (i: number, price: number) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, price, total: round2(l.net * price) } : l)));
  const sub = lines.reduce((s, l) => s + l.total, 0);
  const save = () => {
    update((d) =>
      r.source === 'local'
        ? { ...d, receipts: d.receipts.map((x) => (x.id === r.id ? { ...x, lines } : x)) }
        : { ...d, priceOverrides: { ...d.priceOverrides, [r.id]: lines } },
    );
    toast(`บันทึกราคาใบรับ ${r.id} แล้ว`);
    onClose();
  };
  const reset = () => {
    update((d) => {
      const po = { ...d.priceOverrides };
      delete po[r.id];
      return { ...d, priceOverrides: po };
    });
    toast('กลับไปใช้ราคาตามชีต');
    onClose();
  };
  return (
    <div className="panel stack" style={{ borderColor: 'var(--primary)' }}>
      <h3>กำหนดราคา {r.id}</h3>
      <p className="mt0 muted" style={{ fontSize: 13, margin: 0 }}>ช่องที่ว่างเติมราคาล่าสุดของเกรดนั้นให้ก่อน แก้ไขได้</p>
      <div>
        <Table>
          <TableHeader><TableRow><TableHead>เกรด</TableHead><TableHead className="text-right">นน.สุทธิ</TableHead><TableHead className="text-right">ราคา/กก.</TableHead><TableHead className="text-right">ราคารวม</TableHead></TableRow></TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell><GradeChip g={l.grade} /></TableCell>
                <TableCell className="text-right num">{kg(l.net)}</TableCell>
                <TableCell className="text-right"><Input id={`price-${i}`} className="num text-right" style={{ width: 110 }} inputMode="decimal" value={l.price || ''} onChange={(e) => set(i, Number(e.target.value) || 0)} /></TableCell>
                <TableCell className="text-right num">{baht(l.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter><TableRow><TableCell colSpan={3}>รวมก่อน VAT</TableCell><TableCell className="text-right num">{baht(sub)}</TableCell></TableRow></TableFooter>
        </Table>
      </div>
      <div className="row">
        {r.overridden && <Button variant="ghost" size="sm" onClick={reset}>ใช้ราคาตามชีต</Button>}
        <span className="spacer" />
        <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={save}>บันทึกราคา</Button>
      </div>
    </div>
  );
}

interface Truck { plate: string; tin: string; tout: string }

function ReceiptForm({ initial, onClose }: { initial?: Receipt; onClose: () => void }) {
  const { model, update, toast, go } = useApp();
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [id, setId] = useState(initial?.id ?? nextReceiptId(model, todayISO()));
  const [supplier, setSupplier] = useState(initial?.supplier ?? model.suppliers[0]?.name ?? '');
  const [noVat, setNoVat] = useState(initial?.noVat ?? false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [trucks, setTrucks] = useState<Truck[]>(
    initial?.truckNet.length
      ? initial.truckNet.map((_, i) => ({ plate: initial.plates[i] ?? '', tin: String(initial.truckIn[i] ?? ''), tout: String(initial.truckOut[i] ?? '') }))
      : [{ plate: '', tin: '', tout: '' }],
  );
  const [bags, setBags] = useState<{ grade: string; gross: string; tare: string }[]>(
    initial?.bags.map((b) => ({ grade: b.grade, gross: String(b.gross), tare: String(b.tare) })) ?? [{ grade: 'ปอก', gross: '', tare: String(DEFAULT_TARE) }],
  );
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries((initial?.lines ?? []).map((l) => [l.grade, l.price])));
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!initial) setId(nextReceiptId(model, date));
  }, [date]);

  const parsedBags: Bag[] = bags
    .map((b, i) => {
      const gross = Number(b.gross) || 0;
      const tare = Number(b.tare) || 0;
      return { no: i + 1, grade: b.grade.trim(), gross, tare, net: round2(gross - tare) };
    })
    .filter((b) => b.gross > 0 && b.grade);
  const lines = linesFromBags({ bags: parsedBags }, prices);
  const sub = lines.reduce((s, l) => s + l.total, 0);
  const netKg = parsedBags.reduce((s, b) => s + b.net, 0);
  const truckKg = trucks.reduce((s, t) => s + ((Number(t.tin) || 0) - (Number(t.tout) || 0)), 0);
  const gradeOptions = model.grades.map((g) => g.grade);

  const save = () => {
    if (!supplier.trim()) return setErr('กรุณาระบุผู้ขาย');
    if (!parsedBags.length) return setErr('กรุณาใส่น้ำหนักอย่างน้อย 1 กระสอบ');
    if (!initial && model.receiptById.has(id)) return setErr(`เลขที่รับ ${id} มีอยู่แล้ว`);
    const t = trucks.filter((x) => x.plate || x.tin);
    const rec: Receipt = {
      id, date, supplier: supplier.trim(), noVat, note: note.trim() || undefined, source: 'local',
      plates: t.map((x) => x.plate).filter(Boolean), trip: t.length > 1 ? t.map((_, i) => i + 1).join('+') : t.length ? '1' : null,
      truckIn: t.map((x) => Number(x.tin) || 0), truckOut: t.map((x) => Number(x.tout) || 0),
      truckNet: t.map((x) => (Number(x.tin) || 0) - (Number(x.tout) || 0)),
      bags: parsedBags, lines,
    };
    update((d) => ({ ...d, receipts: initial ? d.receipts.map((x) => (x.id === initial.id ? rec : x)) : [...d.receipts, rec] }));
    toast(`บันทึกใบรับ ${id} แล้ว · เพิ่มเข้าสต๊อก ${kg(netKg)} กก.`);
    onClose();
    go({ page: 'receipts', receiptId: id });
  };

  return (
    <Drawer title={initial ? `แก้ไขใบรับ ${initial.id}` : 'สร้างใบรับสินค้าใหม่'} onClose={onClose}>
      <div className="panel stack">
        <h3>ข้อมูลใบรับ</h3>
        <div className="form-grid">
          <div className="field"><Label htmlFor="f-id">เลขที่รับ</Label><Input id="f-id" className="num text-right" value={id} onChange={(e) => setId(e.target.value)} disabled={!!initial} /></div>
          <div className="field"><Label htmlFor="f-date">วันที่</Label><Input id="f-date"  type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <Label htmlFor="f-sup">ผู้ขาย</Label>
            <Input id="f-sup"  list="sup-list" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อใหม่" />
            <datalist id="sup-list">{model.suppliers.map((s) => <option key={s.name} value={s.name} />)}</datalist>
          </div>
          <Label htmlFor="f-novat" className="self-end pb-2.5 font-normal"><Checkbox id="f-novat" checked={noVat} onCheckedChange={(v) => setNoVat(v === true)} />ไม่มี VAT</Label>
        </div>
      </div>

      <div className="panel stack">
        <div className="row"><h3>ตาชั่งรถ</h3><span className="spacer" /><Button variant="outline" size="sm" onClick={() => setTrucks((t) => [...t, { plate: '', tin: '', tout: '' }])}><Icon name="plus" size={14} />เพิ่มคัน</Button></div>
        {trucks.map((t, i) => (
          <div key={i} className="form-grid">
            <div className="field"><Label htmlFor={`t-plate-${i}`}>ทะเบียนรถ คันที่ {i + 1}</Label><Input id={`t-plate-${i}`}  value={t.plate} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, plate: e.target.value } : x)))} /></div>
            <div className="field"><Label htmlFor={`t-in-${i}`}>นน. ชั่งเข้า</Label><Input id={`t-in-${i}`} className="num text-right" inputMode="decimal" value={t.tin} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, tin: e.target.value } : x)))} /></div>
            <div className="field"><Label htmlFor={`t-out-${i}`}>นน. ชั่งออก</Label><Input id={`t-out-${i}`} className="num text-right" inputMode="decimal" value={t.tout} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, tout: e.target.value } : x)))} /></div>
            <div className="field"><Label>นน.สุทธิ</Label><Input readOnly tabIndex={-1} className="num bg-muted text-right" value={kg((Number(t.tin) || 0) - (Number(t.tout) || 0))} /></div>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <div className="row"><h3>รายการกระสอบ</h3><span className="spacer" /><span className="muted" style={{ fontSize: 13 }}>นน.สุทธิ = นน.ก่อน − เต๋า/กระสอบ</span></div>
        <datalist id="grade-list">{gradeOptions.map((g) => <option key={g} value={g} />)}</datalist>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>ลำดับ</TableHead><TableHead>เกรด</TableHead><TableHead className="text-right">นน.ก่อน (ชั่งเข้า)</TableHead><TableHead className="text-right">เต๋า/กระสอบ</TableHead><TableHead className="text-right">นน.สุทธิ</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {bags.map((b, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Input id={`b-grade-${i}`}  list="grade-list" style={{ minWidth: 110 }} value={b.grade} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} /></TableCell>
                  <TableCell className="text-right"><Input id={`b-gross-${i}`} className="num text-right" style={{ width: 110 }} inputMode="decimal" value={b.gross} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, gross: e.target.value } : x)))} /></TableCell>
                  <TableCell className="text-right"><Input id={`b-tare-${i}`} className="num text-right" style={{ width: 80 }} inputMode="decimal" value={b.tare} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, tare: e.target.value } : x)))} /></TableCell>
                  <TableCell className="text-right num">{Number(b.gross) ? kg(Number(b.gross) - (Number(b.tare) || 0)) : '–'}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" aria-label="ลบแถว" onClick={() => setBags((bs) => bs.filter((_, j) => j !== i))}><Icon name="close" size={15} /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="row">
          <Button variant="outline" size="sm" onClick={() => setBags((bs) => [...bs, { grade: bs[bs.length - 1]?.grade ?? 'ปอก', gross: '', tare: String(DEFAULT_TARE) }])}><Icon name="plus" size={14} />เพิ่มกระสอบ</Button>
          <span className="spacer" />
          <span className="muted" style={{ fontSize: 13 }}>รวม {parsedBags.length} กระสอบ · <b className="num">{kg(netKg)}</b> กก.{truckKg > 0 && <> · ต่างจากตาชั่งรถ <b className="num">{kg(truckKg - netKg)}</b> กก.</>}</span>
        </div>
      </div>

      <div className="panel stack">
        <h3>ราคาต่อเกรด</h3>
        {lines.length ? (
          <div>
            <Table>
              <TableHeader><TableRow><TableHead>เกรด</TableHead><TableHead className="text-right">นน.สุทธิ</TableHead><TableHead className="text-right">ราคา/กก.</TableHead><TableHead className="text-right">ราคารวม</TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.grade}>
                    <TableCell><GradeChip g={l.grade} /></TableCell>
                    <TableCell className="text-right num">{kg(l.net)}</TableCell>
                    <TableCell className="text-right"><Input id={`p-${l.grade}`} className="num text-right" style={{ width: 110 }} inputMode="decimal" placeholder={model.gradeByName.get(l.grade)?.lastPrice ? `ล่าสุด ${model.gradeByName.get(l.grade)!.lastPrice}` : 'รอราคา'} value={prices[l.grade] || ''} onChange={(e) => setPrices((p) => ({ ...p, [l.grade]: Number(e.target.value) || 0 }))} /></TableCell>
                    <TableCell className="text-right num">{baht(l.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell colSpan={3}>รวม</TableCell><TableCell className="text-right num">{baht(sub)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={3}>รวม VAT {noVat ? '(ไม่มี)' : '7%'}</TableCell><TableCell className="text-right num">{baht(noVat ? sub : sub * (1 + VAT_RATE))}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : <Empty>ใส่น้ำหนักกระสอบก่อน ระบบจะรวมเป็นเกรดให้</Empty>}
        <div className="field"><Label htmlFor="f-note">หมายเหตุ</Label><Textarea id="f-note"  rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {err && <Note tone="warn">{err}</Note>}
      <div className="row"><span className="spacer" /><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึกใบรับ</Button></div>
    </Drawer>
  );
}
