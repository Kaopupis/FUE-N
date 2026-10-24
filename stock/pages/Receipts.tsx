import React, { useEffect, useMemo, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, PageHead, ReceiptLink, StatusChip, SupplierLink, useApp } from '../components/ui';
import { DEFAULT_TARE, SHEET_URL, VAT_RATE } from '../lib/data';
import { ReceiptView, linesFromBags, nextReceiptId } from '../lib/calc';
import { baht, kg, monthKey, monthLabel, round2, thDate, thDateLong, todayISO } from '../lib/format';
import type { Bag, PriceLine, Receipt } from '../lib/types';

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
        actions={<button className="btn pri" onClick={() => setForm('new')}><Icon name="plus" size={16} />สร้างใบรับใหม่</button>}
      />
      <Card pad={false}>
        <div className="card-b filters">
          <input id="rc-search" className="input search" placeholder="ค้นหาเลขที่รับ ผู้ขาย หรือทะเบียนรถ" value={q} onChange={(e) => setQ(e.target.value)} />
          <select id="rc-month" className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">ทุกเดือน</option>
            <option value="pending">เฉพาะใบที่รอราคา</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
          </select>
          <select id="rc-sup" className="input" value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value="">ผู้ขายทั้งหมด</option>
            {model.suppliers.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
          <select id="rc-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">ทุกเกรด</option>
            {model.grades.filter((g) => g.receiptCount).map((g) => <option key={g.grade}>{g.grade}</option>)}
          </select>
          {(q || month || sup || grade) && <button className="btn ghost sm" onClick={() => { setQ(''); setMonth(''); setSup(''); setGrade(''); }}>ล้างตัวกรอง</button>}
        </div>
        <div className="card-b" style={{ paddingTop: 0 }}>
          <div className="row" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            พบ <b>{rows.length}</b> ใบ · น้ำหนัก{grade ? ` ${grade}` : 'สุทธิ'} <b className="num">{kg(totKg)}</b> กก. · ยอดรวม VAT <b className="num">{baht(totVal)}</b> บาท
          </div>
        </div>
        <div className="tbl-wrap scroll-y">
          <table className="tbl">
            <thead>
              <tr><th>เลขที่รับ</th><th>วันที่</th><th>ผู้ขาย</th><th>ทะเบียนรถ</th><th>เกรด</th><th className="r">กระสอบ</th><th className="r">นน.สุทธิ (กก.)</th><th className="r">รวม VAT (บาท)</th><th>สถานะราคา</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`click${open?.id === r.id ? ' sel' : ''}`} onClick={() => go({ page: 'receipts', receiptId: r.id, month: month || undefined, supplier: sup || undefined, grade: grade || undefined })}>
                  <td><ReceiptLink id={r.id} />{r.source === 'local' && <span className="chip info" style={{ marginLeft: 6 }}>บันทึกใหม่</span>}</td>
                  <td className="num">{thDate(r.date)}</td>
                  <td><SupplierLink name={r.supplier} /></td>
                  <td className="num muted">{r.plates.join(', ') || '–'}</td>
                  <td><div className="chips">{Object.keys(r.qty).slice(0, 4).map((g) => <GradeChip key={g} g={g} />)}{Object.keys(r.qty).length > 4 && <span className="chip plain">+{Object.keys(r.qty).length - 4}</span>}</div></td>
                  <td className="r num">{r.bags.length || '–'}</td>
                  <td className="r num">{kg(r.netKg)}</td>
                  <td className="r num">{r.total ? baht(r.total) : '–'}</td>
                  <td><StatusChip s={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
      right={r.source === 'local' ? <button className="btn sm" onClick={onEdit}>แก้ไข</button> : undefined}
    >
      <div className="card card-b stack">
        <div className="row"><StatusChip s={r.status} />{r.noVat && <span className="chip info">ไม่มี VAT</span>}{r.source === 'sheet' ? <span className="chip plain">จากชีต</span> : <span className="chip info">บันทึกในระบบ</span>}{r.overridden && <span className="chip info">ราคาใส่ในระบบ</span>}</div>
        <div className="kv">
          <div><span>วันที่รับ</span><b>{thDateLong(r.date)}</b></div>
          <div><span>ประเภท</span><b>รับซื้อ</b></div>
          <div><span>ผู้ขาย</span><b><SupplierLink name={r.supplier} /></b></div>
          <div><span>ทะเบียนรถ / คันที่</span><b className="num">{r.plates.join(', ') || '–'} {r.trip ? `(คันที่ ${r.trip})` : ''}</b></div>
        </div>
        {r.note && <div className="note">{r.note}</div>}
      </div>

      {r.truckNet.length > 0 && (
        <div className="card card-b stack">
          <h3>ตาชั่งรถ</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>คัน</th><th className="r">ชั่งเข้า</th><th className="r">ชั่งออก</th><th className="r">สุทธิ (กก.)</th></tr></thead>
              <tbody>{r.truckNet.map((n, i) => <tr key={i}><td>{i + 1}</td><td className="r num">{kg(r.truckIn[i] ?? 0)}</td><td className="r num">{kg(r.truckOut[i] ?? 0)}</td><td className="r num">{kg(n)}</td></tr>)}</tbody>
            </table>
          </div>
          {r.netKg > 0 && <div className={`note${Math.abs(diff) > r.truckKg * 0.01 ? ' warn' : ''}`}>ตาชั่งรถ {kg(r.truckKg)} กก. เทียบกับน้ำหนักกระสอบสุทธิ {kg(r.netKg)} กก. ต่างกัน <b className="num">{kg(diff)}</b> กก. ({r.truckKg ? ((diff / r.truckKg) * 100).toFixed(2) : 0}%)</div>}
        </div>
      )}

      <div className="card card-b stack">
        <div className="row"><h3>ราคารับซื้อ</h3><span className="spacer" /><button className="btn sm" onClick={() => setPricing(true)}>{r.status === 'priced' ? 'แก้ไขราคา' : 'ใส่ราคา'}</button></div>
        {r.lines.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>เกรด</th><th className="r">นน.สุทธิ (หักเต๋าแล้ว)</th><th className="r">ราคา/กก.</th><th className="r">ราคารวม</th></tr></thead>
              <tbody>{r.lines.map((l, i) => <tr key={i}><td><GradeChip g={l.grade} /></td><td className="r num">{kg(l.net)}</td><td className="r num">{l.price ? baht(l.price) : <span className="chip warn">รอราคา</span>}</td><td className="r num">{baht(l.total)}</td></tr>)}</tbody>
              <tfoot>
                <tr><td colSpan={3}>รวม</td><td className="r num">{baht(r.subtotal)}</td></tr>
                <tr><td colSpan={3}>VAT {r.noVat ? '(ไม่มี)' : `${VAT_RATE * 100}%`}</td><td className="r num">{baht(r.vat)}</td></tr>
                <tr><td colSpan={3}>รวม VAT</td><td className="r num" style={{ color: 'var(--leaf)' }}>{baht(r.total)}</td></tr>
              </tfoot>
            </table>
          </div>
        ) : <Empty>ยังไม่มีรายการราคา</Empty>}
      </div>

      {r.bags.length > 0 && (
        <div className="card card-b stack">
          <h3>รายการกระสอบ ({r.bags.length})</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>ลำดับ</th><th>เกรด</th><th className="r">นน.ก่อน (ชั่งเข้า)</th><th className="r">นน. เต๋า/กระสอบ</th><th className="r">นน.สุทธิ</th></tr></thead>
              <tbody>{r.bags.map((b) => <tr key={b.no}><td>{b.no}</td><td><GradeChip g={b.grade} /></td><td className="r num">{kg(b.gross)}</td><td className="r num">{kg(b.tare)}</td><td className="r num">{kg(b.net)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>รวม</td><td className="r num">{kg(gross)}</td><td className="r num">{kg(tare)}</td><td className="r num">{kg(r.netKg)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={() => go({ page: 'relations', supplier: r.supplier })}><Icon name="relations" size={16} />ดูความสัมพันธ์ผู้ขายนี้</button>
        {r.source === 'sheet' && <a className="btn" href={SHEET_URL} target="_blank" rel="noreferrer"><Icon name="ext" size={16} />เปิดชีตต้นฉบับ</a>}
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
    <div className="card card-b stack" style={{ borderColor: 'var(--leaf)' }}>
      <h3>กำหนดราคา {r.id}</h3>
      <p className="mt0 muted" style={{ fontSize: 13, margin: 0 }}>ช่องที่ว่างเติมราคาล่าสุดของเกรดนั้นให้ก่อน แก้ไขได้</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>เกรด</th><th className="r">นน.สุทธิ</th><th className="r">ราคา/กก.</th><th className="r">ราคารวม</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><GradeChip g={l.grade} /></td>
                <td className="r num">{kg(l.net)}</td>
                <td className="r"><input id={`price-${i}`} className="input num" style={{ width: 110 }} inputMode="decimal" value={l.price || ''} onChange={(e) => set(i, Number(e.target.value) || 0)} /></td>
                <td className="r num">{baht(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>รวมก่อน VAT</td><td className="r num">{baht(sub)}</td></tr></tfoot>
        </table>
      </div>
      <div className="row">
        {r.overridden && <button className="btn ghost sm" onClick={reset}>ใช้ราคาตามชีต</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn pri" onClick={save}>บันทึกราคา</button>
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
      <div className="card card-b stack">
        <h3>ข้อมูลใบรับ</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="f-id">เลขที่รับ</label><input id="f-id" className="input num" value={id} onChange={(e) => setId(e.target.value)} disabled={!!initial} /></div>
          <div className="field"><label htmlFor="f-date">วันที่</label><input id="f-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <label htmlFor="f-sup">ผู้ขาย</label>
            <input id="f-sup" className="input" list="sup-list" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อใหม่" />
            <datalist id="sup-list">{model.suppliers.map((s) => <option key={s.name} value={s.name} />)}</datalist>
          </div>
          <label className="row" style={{ fontSize: 14, alignSelf: 'end', paddingBottom: 8 }}><input id="f-novat" type="checkbox" checked={noVat} onChange={(e) => setNoVat(e.target.checked)} />ไม่มี VAT</label>
        </div>
      </div>

      <div className="card card-b stack">
        <div className="row"><h3>ตาชั่งรถ</h3><span className="spacer" /><button className="btn sm" onClick={() => setTrucks((t) => [...t, { plate: '', tin: '', tout: '' }])}><Icon name="plus" size={14} />เพิ่มคัน</button></div>
        {trucks.map((t, i) => (
          <div key={i} className="form-grid">
            <div className="field"><label htmlFor={`t-plate-${i}`}>ทะเบียนรถ คันที่ {i + 1}</label><input id={`t-plate-${i}`} className="input" value={t.plate} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, plate: e.target.value } : x)))} /></div>
            <div className="field"><label htmlFor={`t-in-${i}`}>นน. ชั่งเข้า</label><input id={`t-in-${i}`} className="input num" inputMode="decimal" value={t.tin} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, tin: e.target.value } : x)))} /></div>
            <div className="field"><label htmlFor={`t-out-${i}`}>นน. ชั่งออก</label><input id={`t-out-${i}`} className="input num" inputMode="decimal" value={t.tout} onChange={(e) => setTrucks((ts) => ts.map((x, j) => (j === i ? { ...x, tout: e.target.value } : x)))} /></div>
            <div className="field"><label>นน.สุทธิ</label><div className="input num" style={{ background: 'var(--mint)' }}>{kg((Number(t.tin) || 0) - (Number(t.tout) || 0))}</div></div>
          </div>
        ))}
      </div>

      <div className="card card-b stack">
        <div className="row"><h3>รายการกระสอบ</h3><span className="spacer" /><span className="muted" style={{ fontSize: 13 }}>นน.สุทธิ = นน.ก่อน − เต๋า/กระสอบ</span></div>
        <datalist id="grade-list">{gradeOptions.map((g) => <option key={g} value={g} />)}</datalist>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>ลำดับ</th><th>เกรด</th><th className="r">นน.ก่อน (ชั่งเข้า)</th><th className="r">เต๋า/กระสอบ</th><th className="r">นน.สุทธิ</th><th /></tr></thead>
            <tbody>
              {bags.map((b, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input id={`b-grade-${i}`} className="input" list="grade-list" style={{ minWidth: 110 }} value={b.grade} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} /></td>
                  <td className="r"><input id={`b-gross-${i}`} className="input num" style={{ width: 110 }} inputMode="decimal" value={b.gross} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, gross: e.target.value } : x)))} /></td>
                  <td className="r"><input id={`b-tare-${i}`} className="input num" style={{ width: 80 }} inputMode="decimal" value={b.tare} onChange={(e) => setBags((bs) => bs.map((x, j) => (j === i ? { ...x, tare: e.target.value } : x)))} /></td>
                  <td className="r num">{Number(b.gross) ? kg(Number(b.gross) - (Number(b.tare) || 0)) : '–'}</td>
                  <td><button className="iconbtn" aria-label="ลบแถว" onClick={() => setBags((bs) => bs.filter((_, j) => j !== i))}><Icon name="close" size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => setBags((bs) => [...bs, { grade: bs[bs.length - 1]?.grade ?? 'ปอก', gross: '', tare: String(DEFAULT_TARE) }])}><Icon name="plus" size={14} />เพิ่มกระสอบ</button>
          <span className="spacer" />
          <span className="muted" style={{ fontSize: 13 }}>รวม {parsedBags.length} กระสอบ · <b className="num">{kg(netKg)}</b> กก.{truckKg > 0 && <> · ต่างจากตาชั่งรถ <b className="num">{kg(truckKg - netKg)}</b> กก.</>}</span>
        </div>
      </div>

      <div className="card card-b stack">
        <h3>ราคาต่อเกรด</h3>
        {lines.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>เกรด</th><th className="r">นน.สุทธิ</th><th className="r">ราคา/กก.</th><th className="r">ราคารวม</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.grade}>
                    <td><GradeChip g={l.grade} /></td>
                    <td className="r num">{kg(l.net)}</td>
                    <td className="r"><input id={`p-${l.grade}`} className="input num" style={{ width: 110 }} inputMode="decimal" placeholder={model.gradeByName.get(l.grade)?.lastPrice ? `ล่าสุด ${model.gradeByName.get(l.grade)!.lastPrice}` : 'รอราคา'} value={prices[l.grade] || ''} onChange={(e) => setPrices((p) => ({ ...p, [l.grade]: Number(e.target.value) || 0 }))} /></td>
                    <td className="r num">{baht(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>รวม</td><td className="r num">{baht(sub)}</td></tr>
                <tr><td colSpan={3}>รวม VAT {noVat ? '(ไม่มี)' : '7%'}</td><td className="r num">{baht(noVat ? sub : sub * (1 + VAT_RATE))}</td></tr>
              </tfoot>
            </table>
          </div>
        ) : <Empty>ใส่น้ำหนักกระสอบก่อน ระบบจะรวมเป็นเกรดให้</Empty>}
        <div className="field"><label htmlFor="f-note">หมายเหตุ</label><textarea id="f-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {err && <div className="note warn">{err}</div>}
      <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" onClick={save}>บันทึกใบรับ</button></div>
    </Drawer>
  );
}
