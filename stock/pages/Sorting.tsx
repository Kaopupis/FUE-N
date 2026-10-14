import React, { useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, GradeChip, Icon, PageHead, useApp } from '../components/ui';
import { nextDocId } from '../lib/calc';
import { kg, round2, thDate, todayISO } from '../lib/format';

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
        actions={<button className="btn pri" onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการคัด</button>}
      />
      <Card pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>เลขที่</th><th>วันที่คัด</th><th>เกรดต้นทาง</th><th className="r">นน.ก่อนคัด</th><th>ผลการคัด</th><th className="r">นน.หลังคัด</th><th className="r">สูญเสีย</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => {
                const out = s.outputs.reduce((a, o) => a + o.net, 0);
                const loss = s.input - out;
                return (
                  <tr key={s.id}>
                    <td className="num">{s.id}</td>
                    <td className="num">{thDate(s.date)}</td>
                    <td><GradeChip g={s.fromGrade} /></td>
                    <td className="r num">{kg(s.input)}</td>
                    <td><div className="chips">{s.outputs.map((o) => <GradeChip key={o.grade} g={o.grade} kg={kg(o.net)} />)}</div></td>
                    <td className="r num">{kg(out)}</td>
                    <td className="r num"><span className={`chip ${loss / s.input > 0.02 ? 'bad' : 'plain'}`}>{kg(loss)} ({((loss / s.input) * 100).toFixed(1)}%)</span></td>
                    <td className="r"><ConfirmButton small onConfirm={() => { update((d) => ({ ...d, sorts: d.sorts.filter((x) => x.id !== s.id) })); toast(`ลบ ${s.id} แล้ว`); }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <Empty>
              <p>ยังไม่มีการคัดแยก เช่น นำ “ปอก” 1,000 กก. มาคัดเป็น ปอก/ช็อต/ใหญ่</p>
              <button className="btn pri" onClick={() => setForm(true)}><Icon name="plus" size={16} />บันทึกการคัดครั้งแรก</button>
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
      <div className="card card-b stack">
        <div className="form-grid">
          <div className="field"><label htmlFor="s-date">วันที่คัด</label><input id="s-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="s-from">เกรดต้นทาง</label><select id="s-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>{avail.map((g) => <option key={g.grade}>{g.grade}</option>)}</select></div>
          <div className="field"><label htmlFor="s-in">น้ำหนักก่อนคัด (กก.)</label><input id="s-in" className="input num" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} /></div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>คงเหลือ {from}: <b className="num">{kg(model.gradeByName.get(from)?.balance ?? 0)}</b> กก.</p>
      </div>
      <div className="card card-b stack">
        <h3>น้ำหนักหลังคัดแยก</h3>
        <datalist id="sort-grade-list">{model.grades.map((g) => <option key={g.grade} value={g.grade} />)}</datalist>
        {outs.map((o, i) => (
          <div key={i} className="row">
            <input id={`so-g-${i}`} className="input" list="sort-grade-list" style={{ flex: '1 1 140px', width: 'auto' }} value={o.grade} onChange={(e) => setOuts((x) => x.map((y, j) => (j === i ? { ...y, grade: e.target.value } : y)))} />
            <input id={`so-n-${i}`} className="input num" style={{ flex: '1 1 120px', width: 'auto' }} inputMode="decimal" placeholder="กก." value={o.net} onChange={(e) => setOuts((x) => x.map((y, j) => (j === i ? { ...y, net: e.target.value } : y)))} />
            <button className="iconbtn" aria-label="ลบแถว" onClick={() => setOuts((x) => x.filter((_, j) => j !== i))}><Icon name="close" size={15} /></button>
          </div>
        ))}
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOuts((x) => [...x, { grade: 'ใหญ่', net: '' }])}><Icon name="plus" size={14} />เพิ่มเกรด</button>
        <div className="note">ก่อนคัด <b className="num">{kg(inN)}</b> · หลังคัด <b className="num">{kg(outN)}</b> · สูญเสีย <b className="num">{kg(inN - outN)}</b> กก. {inN ? `(${(((inN - outN) / inN) * 100).toFixed(2)}%)` : ''}</div>
        <div className="field"><label htmlFor="s-note">หมายเหตุ</label><input id="s-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {err && <div className="note warn">{err}</div>}
      <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" onClick={save}>บันทึกการคัด</button></div>
    </Drawer>
  );
}
