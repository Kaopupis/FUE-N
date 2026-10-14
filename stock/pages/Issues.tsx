import React, { useEffect, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, PageHead, useApp } from '../components/ui';
import { nextDocId } from '../lib/calc';
import { baht, kg, round2, thDate, todayISO } from '../lib/format';
import type { Issue } from '../lib/types';

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
        actions={<button className="btn pri" onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกจ่ายออก</button>}
      />
      <Card pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า / ปลายทาง</th><th>เกรด</th><th className="r">น้ำหนัก (กก.)</th><th className="r">มูลค่าขาย (บาท)</th><th>หมายเหตุ</th><th /></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="num">{i.id}</td>
                  <td className="num">{thDate(i.date)}</td>
                  <td>{i.customer}</td>
                  <td><div className="chips">{i.lines.map((l) => <GradeChip key={l.grade} g={l.grade} kg={kg(l.net)} />)}</div></td>
                  <td className="r num">{kg(i.lines.reduce((s, l) => s + l.net, 0))}</td>
                  <td className="r num">{baht(i.lines.reduce((s, l) => s + l.net * l.price, 0))}</td>
                  <td className="muted">{i.note}</td>
                  <td className="r"><ConfirmButton small onConfirm={() => del(i.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty>
              <p>ยังไม่มีรายการจ่ายออก ชีตต้นฉบับบันทึกเฉพาะฝั่งรับเข้า</p>
              <button className="btn pri" onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการขายครั้งแรก</button>
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
      <div className="card card-b stack">
        <div className="form-grid">
          <div className="field"><label htmlFor="i-date">วันที่</label><input id="i-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="i-cus">ลูกค้า / ปลายทาง</label><input id="i-cus" className="input" list="cus-list" value={customer} onChange={(e) => setCustomer(e.target.value)} /><datalist id="cus-list">{customers.map((c) => <option key={c} value={c} />)}</datalist></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>เกรด</th><th className="r">คงเหลือ</th><th className="r">น้ำหนักจ่าย (กก.)</th><th className="r">ราคาขาย/กก.</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><select id={`il-g-${i}`} className="input" value={l.grade} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, grade: e.target.value } : y)))}>{model.grades.filter((g) => g.balance > 0 || g.grade === l.grade).map((g) => <option key={g.grade}>{g.grade}</option>)}</select></td>
                  <td className="r num muted">{kg(model.gradeByName.get(l.grade)?.balance ?? 0)}</td>
                  <td className="r"><input id={`il-n-${i}`} className="input num" style={{ width: 120 }} inputMode="decimal" value={l.net} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, net: e.target.value } : y)))} /></td>
                  <td className="r"><input id={`il-p-${i}`} className="input num" style={{ width: 110 }} inputMode="decimal" value={l.price} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} /></td>
                  <td><button className="iconbtn" aria-label="ลบแถว" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLines((x) => [...x, { grade: avail[0]?.grade ?? 'ปอก', net: '', price: '' }])}><Icon name="plus" size={14} />เพิ่มเกรด</button>
        <div className="field"><label htmlFor="i-note">หมายเหตุ</label><input id="i-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ทะเบียนรถ เลขที่ใบส่งของ" /></div>
      </div>
      {err && <div className="note warn">{err}</div>}
      <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" onClick={save}>บันทึกจ่ายออก</button></div>
    </Drawer>
  );
}
