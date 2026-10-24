import React, { useState } from 'react';
import { Card, Drawer, GradeChip, Icon, Kpi, PageHead, useApp } from '../components/ui';
import { FAMILY_ORDER } from '../lib/data';
import { nextDocId } from '../lib/calc';
import { baht, bahtShort, kg, round2, thDate, todayISO } from '../lib/format';

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
        actions={<button className="btn" onClick={() => setAdjust(true)}><Icon name="scale" size={16} />ปรับยอดสต๊อก</button>}
      />
      <div className="grid g-kpi">
        <Kpi hero label="คงเหลือรวม" value={kg(model.totals.balance)} unit="กก." sub={`มูลค่าประมาณ ${bahtShort(model.totals.stockValue)} บาท`} />
        {byFam.map((x) => <Kpi key={x.f} label={x.f} value={kg(x.kg)} unit="กก." onClick={() => setFam(x.f)} sub="กดเพื่อกรอง" />)}
      </div>
      <Card
        title="ยอดคงเหลือแยกเกรด"
        sub="ต้นทุนเฉลี่ยคิดจากใบรับที่มีราคา · กดแถวเพื่อดูบัตรสต๊อก"
        pad={false}
        right={
          <div className="filters">
            <div className="seg">
              {['ทั้งหมด', ...families].map((f) => <button key={f} className={fam === f ? 'on' : ''} onClick={() => setFam(f)}>{f}</button>)}
            </div>
            <label className="row" style={{ fontSize: 13, gap: 6 }}><input id="show-zero" type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />แสดงเกรดที่ไม่มีของ</label>
          </div>
        }
      >
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>เกรด</th><th>กลุ่ม</th><th className="r">รับเข้า</th><th className="r">ได้จากคัด</th><th className="r">นำไปคัด</th>
                <th className="r">จ่ายออก</th><th className="r">ปรับยอด</th><th className="r">คงเหลือ (กก.)</th><th className="r">ต้นทุนเฉลี่ย/กก.</th><th className="r">มูลค่า (บาท)</th><th>เคลื่อนไหวล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.grade} className="click" onClick={() => go({ page: 'grades', grade: g.grade })}>
                  <td><GradeChip g={g.grade} /></td>
                  <td className="muted">{g.family}</td>
                  <td className="r num">{kg(g.received)}</td>
                  <td className="r num muted">{g.sortedIn ? kg(g.sortedIn) : '–'}</td>
                  <td className="r num muted">{g.sortedOut ? kg(g.sortedOut) : '–'}</td>
                  <td className="r num muted">{g.issued ? kg(g.issued) : '–'}</td>
                  <td className="r num muted">{g.adjusted ? kg(g.adjusted) : '–'}</td>
                  <td className="r num" style={{ fontWeight: 600, color: g.balance < 0 ? 'var(--red)' : undefined }}>{kg(g.balance)}</td>
                  <td className="r num">{g.avgCost ? baht(g.avgCost) : <span className="chip warn">ไม่มีราคา</span>}</td>
                  <td className="r num">{baht(g.value)}</td>
                  <td className="num muted">{g.lastDate ? thDate(g.lastDate) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>รวม {rows.length} เกรด</td>
                <td className="r num">{kg(sum('received'))}</td><td className="r num">{kg(sum('sortedIn'))}</td><td className="r num">{kg(sum('sortedOut'))}</td>
                <td className="r num">{kg(sum('issued'))}</td><td className="r num">{kg(sum('adjusted'))}</td><td className="r num">{kg(sum('balance'))}</td>
                <td /><td className="r num">{baht(sum('value'))}</td><td />
              </tr>
            </tfoot>
          </table>
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
      <div className="card card-b stack">
        <div className="form-grid">
          <div className="field"><label htmlFor="adj-date">วันที่</label><input id="adj-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="adj-grade">เกรด</label>
            <select id="adj-grade" className="input" value={g} onChange={(e) => setG(e.target.value)}>{model.grades.map((x) => <option key={x.grade}>{x.grade}</option>)}</select>
          </div>
        </div>
        <div className="seg">
          <button className={mode === 'count' ? 'on' : ''} onClick={() => setMode('count')}>ใส่ยอดนับจริง</button>
          <button className={mode === 'delta' ? 'on' : ''} onClick={() => setMode('delta')}>เพิ่ม/ลด</button>
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="adj-val">{mode === 'count' ? 'น้ำหนักที่นับได้ (กก.)' : 'จำนวนที่ปรับ (กก. ใส่ลบเพื่อลด)'}</label><input id="adj-val" className="input num" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0.0" /></div>
          <div className="field"><label htmlFor="adj-reason">เหตุผล</label><input id="adj-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="note">ยอดในระบบตอนนี้ <b className="num">{kg(cur)}</b> กก. → ปรับ <b className="num">{delta > 0 ? '+' : ''}{kg(delta)}</b> กก. → คงเหลือ <b className="num">{kg(cur + delta)}</b> กก.</div>
        <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" disabled={!delta} onClick={save}>บันทึกการปรับยอด</button></div>
      </div>
    </Drawer>
  );
}
