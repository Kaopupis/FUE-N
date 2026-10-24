import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bar, Card, Icon, Kpi, PageHead, ReceiptLink, SupplierLink, gradeColor, useApp } from '../components/ui';
import { FAMILY_ORDER } from '../lib/data';
import { baht, kg, thDate } from '../lib/format';
import { AdjustDrawer } from './Stock';

const KIND: Record<string, string> = { receipt: 'รับเข้า', issue: 'จ่ายออก', 'sort-in': 'ได้จากคัด', 'sort-out': 'นำไปคัด', adjust: 'ปรับยอด' };

export default function Grades() {
  const { model, nav, go } = useApp();
  const selected = nav.grade && model.gradeByName.has(nav.grade) ? nav.grade : model.grades[0].grade;
  const g = model.gradeByName.get(selected)!;
  const [adjust, setAdjust] = useState(false);

  const ledger = useMemo(() => {
    let bal = 0;
    return model.movements.filter((m) => m.grade === selected).map((m) => ({ ...m, bal: (bal += m.qty) })).reverse();
  }, [model, selected]);

  const prices = useMemo(
    () =>
      [...model.receipts].reverse().flatMap((r) => r.lines.filter((l) => l.grade === selected && l.price > 0).map((l) => ({ d: thDate(r.date).slice(0, 5), id: r.id, price: l.price }))),
    [model, selected],
  );

  const sup = Object.entries(
    model.receipts.reduce<Record<string, number>>((o, r) => { if (r.qty[selected]) o[r.supplier] = (o[r.supplier] || 0) + r.qty[selected]; return o; }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const supMax = sup[0]?.[1] ?? 1;

  return (
    <>
      <PageHead crumb="สินค้า" title="เกรดสินค้า" desc="เลือกเกรดเพื่อดูบัตรสต๊อก ราคา และผู้ขายที่ส่งเกรดนี้" />
      <Card pad={false}>
        <div className="card-b stack" style={{ gap: 10 }}>
          {FAMILY_ORDER.map((f) => {
            const list = model.grades.filter((x) => x.family === f && (x.received > 0 || x.balance !== 0 || x.sortedIn > 0));
            if (!list.length) return null;
            return (
              <div key={f} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="muted" style={{ width: 90, fontSize: 13, paddingTop: 2 }}>{f}</span>
                <div className="chips" style={{ flex: 1 }}>
                  {list.map((x) => (
                    <button key={x.grade} className="chip plain" style={x.grade === selected ? { background: 'var(--leaf)', color: '#fff', borderColor: 'var(--leaf)' } : undefined} onClick={() => go({ page: 'grades', grade: x.grade })}>
                      <i className="dot" style={{ background: gradeColor(x.grade) }} />{x.grade}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="row">
        <h2 style={{ fontSize: '1.35rem' }}><i className="dot" style={{ background: gradeColor(selected), width: 14, height: 14, marginRight: 8 }} />{selected}</h2>
        <span className="chip plain">{g.family}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={() => go({ page: 'receipts', grade: selected })}>ใบรับที่มีเกรดนี้</button>
        <button className="btn sm" onClick={() => setAdjust(true)}><Icon name="scale" size={14} />ปรับยอด</button>
      </div>
      <div className="grid g-kpi">
        <Kpi hero label="คงเหลือ" value={kg(g.balance)} unit="กก." sub={`มูลค่า ≈ ${baht(g.value)} บาท`} />
        <Kpi label="รับเข้าสะสม" value={kg(g.received)} unit="กก." sub={`${g.receiptCount} ใบรับ · ${g.suppliers.length} ผู้ขาย`} />
        <Kpi label="ต้นทุนเฉลี่ย" value={g.avgCost ? baht(g.avgCost) : '–'} unit="บาท/กก." sub="ถัวเฉลี่ยถ่วงน้ำหนัก" />
        <Kpi label="ราคารับซื้อล่าสุด" value={g.lastPrice ? baht(g.lastPrice) : '–'} unit="บาท/กก." />
      </div>

      <div className="grid g-2">
        <Card title="ราคารับซื้อต่อกิโลกรัม" sub="ทุกบรรทัดราคาในใบรับ เรียงตามวันที่">
          {prices.length > 1 ? (
            <div style={{ height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={prices} margin={{ top: 8, right: 24, left: -6, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="d" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v: number) => [`${baht(v)} บาท/กก.`, 'ราคา']} labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.id} · ${p[0].payload.d}` : '')} />
                  <Line type="monotone" dataKey="price" stroke={gradeColor(selected)} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="muted">ยังมีข้อมูลราคาไม่พอสำหรับกราฟ</p>}
        </Card>
        <Card title="ผู้ขายที่ส่งเกรดนี้" sub="น้ำหนักสะสม (กก.)">
          <div className="stack" style={{ gap: 10 }}>
            {sup.map(([s, q]) => (
              <div key={s} className="stack" style={{ gap: 4 }}>
                <div className="row"><SupplierLink name={s} /><span className="spacer" /><span className="num">{kg(q)}</span></div>
                <Bar v={q} max={supMax} color={gradeColor(selected)} />
              </div>
            ))}
            {!sup.length && <p className="muted">ยังไม่มีการรับเข้า</p>}
          </div>
        </Card>
      </div>

      <Card title="บัตรสต๊อก (ความเคลื่อนไหว)" sub={`${ledger.length} รายการ ล่าสุดอยู่บน`} pad={false}>
        <div className="tbl-wrap scroll-y" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead><tr><th>วันที่</th><th>ประเภท</th><th>เอกสาร</th><th>คู่ค้า / รายละเอียด</th><th className="r">เข้า</th><th className="r">ออก</th><th className="r">คงเหลือ</th></tr></thead>
            <tbody>
              {ledger.map((m, i) => (
                <tr key={i}>
                  <td className="num">{thDate(m.date)}</td>
                  <td><span className={`chip ${m.qty >= 0 ? 'ok' : 'info'}`}>{KIND[m.kind]}</span></td>
                  <td>{m.kind === 'receipt' ? <ReceiptLink id={m.ref} /> : <span className="num">{m.ref}</span>}</td>
                  <td>{m.kind === 'receipt' ? <SupplierLink name={m.party} /> : m.party}</td>
                  <td className="r num">{m.qty > 0 ? kg(m.qty) : ''}</td>
                  <td className="r num">{m.qty < 0 ? kg(-m.qty) : ''}</td>
                  <td className="r num" style={{ fontWeight: 600 }}>{kg(m.bal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {adjust && <AdjustDrawer grade={selected} onClose={() => setAdjust(false)} />}
    </>
  );
}
