import React from 'react';
import { Bar, Card, GradeChip, Icon, Kpi, PageHead, ReceiptLink, StatusChip, gradeColor, useApp } from '../components/ui';
import { baht, bahtShort, kg, thDate, tonne } from '../lib/format';

export default function Suppliers() {
  const { model, nav, go } = useApp();
  const s = nav.supplier ? model.supplierByName.get(nav.supplier) : undefined;
  const max = Math.max(...model.suppliers.map((x) => x.kg), 1);

  return (
    <>
      <PageHead crumb="คู่ค้า" title="ผู้ขาย / คู่ค้า" desc="สรุปผู้ขายจากใบรับ กดชื่อเพื่อดูใบรับ เกรดที่ส่ง และยอดซื้อ" />
      <Card pad={false}>
        <div className="tbl-wrap" style={{ marginTop: 4 }}>
          <table className="tbl">
            <thead><tr><th>ผู้ขาย</th><th>กลุ่ม</th><th className="r">ใบรับ</th><th style={{ minWidth: 160 }}>น้ำหนักรับเข้า</th><th className="r">ยอดซื้อก่อน VAT</th><th className="r">ราคาเฉลี่ย/กก.</th><th>เกรดหลัก</th><th>รับล่าสุด</th></tr></thead>
            <tbody>
              {model.suppliers.map((x) => {
                const pricedKg = model.receipts.filter((r) => r.supplier === x.name).reduce((a, r) => a + r.lines.filter((l) => l.price > 0).reduce((b, l) => b + l.net, 0), 0);
                const topG = Object.entries(x.grades).sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <tr key={x.name} className={`click${s?.name === x.name ? ' sel' : ''}`} onClick={() => go({ page: 'suppliers', supplier: x.name })}>
                    <td><b>{x.name}</b>{x.noVat && <span className="chip info" style={{ marginLeft: 6 }}>No VAT</span>}</td>
                    <td className="muted">{x.group !== x.name ? `เครือ ${x.group}` : '–'}</td>
                    <td className="r num">{x.receipts.length}</td>
                    <td><div className="stack" style={{ gap: 3 }}><span className="num" style={{ fontSize: 13 }}>{kg(x.kg)} กก.</span><Bar v={x.kg} max={max} /></div></td>
                    <td className="r num">{baht(x.value)}</td>
                    <td className="r num">{pricedKg ? baht(x.value / pricedKg) : '–'}</td>
                    <td><div className="chips">{topG.map(([g]) => <GradeChip key={g} g={g} />)}</div></td>
                    <td className="num muted">{thDate(x.last)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {s && (
        <>
          <div className="row">
            <h2 style={{ fontSize: '1.35rem' }}>{s.name}</h2>
            {s.pending > 0 && <span className="chip warn">รอราคา {s.pending} ใบ</span>}
            <span className="spacer" />
            <button className="btn sm" onClick={() => go({ page: 'relations', supplier: s.name })}><Icon name="relations" size={14} />ผังความสัมพันธ์</button>
            <button className="btn sm" onClick={() => go({ page: 'receipts', supplier: s.name })}>กรองใบรับ</button>
          </div>
          <div className="grid g-kpi">
            <Kpi hero label="น้ำหนักรับเข้า" value={kg(s.kg)} unit="กก." sub={tonne(s.kg)} />
            <Kpi label="ยอดซื้อก่อน VAT" value={bahtShort(s.value)} unit="บาท" />
            <Kpi label="จำนวนใบรับ" value={String(s.receipts.length)} unit="ใบ" sub={`${thDate(s.first)} – ${thDate(s.last)}`} />
            <Kpi label="สัดส่วนของทั้งหมด" value={((s.kg / model.totals.kg) * 100).toFixed(1)} unit="%" sub="ตามน้ำหนัก" />
          </div>
          <div className="grid g-2">
            <Card title="ใบรับของผู้ขายนี้" pad={false}>
              <div className="tbl-wrap scroll-y" style={{ maxHeight: 420, marginTop: 8 }}>
                <table className="tbl">
                  <thead><tr><th>เลขที่รับ</th><th>วันที่</th><th className="r">นน.สุทธิ</th><th className="r">รวม VAT</th><th>สถานะ</th></tr></thead>
                  <tbody>
                    {[...s.receipts].reverse().map((id) => {
                      const r = model.receiptById.get(id)!;
                      return (
                        <tr key={id} className="click" onClick={() => go({ page: 'receipts', receiptId: id, supplier: s.name })}>
                          <td><ReceiptLink id={id} /></td><td className="num">{thDate(r.date)}</td><td className="r num">{kg(r.netKg)}</td><td className="r num">{r.total ? baht(r.total) : '–'}</td><td><StatusChip s={r.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
