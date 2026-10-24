import React from 'react';
import { Card, GradeChip, PageHead, useApp } from '../components/ui';
import { kg, int } from '../lib/format';
import type { NavTarget } from '../lib/types';

interface Node { key: string; x: number; y: number; title: string; sub: string; num: string; to: NavTarget; core?: boolean }
const W = 184;
const H = 70;

export default function Relations() {
  const { model, local, go, nav } = useApp();
  const bags = model.receipts.reduce((s, r) => s + r.bags.length, 0);
  const lines = model.receipts.reduce((s, r) => s + r.lines.length, 0);
  const activeGrades = model.grades.filter((g) => g.received > 0 || g.sortedIn > 0);

  const nodes: Node[] = [
    { key: 'sup', x: 20, y: 60, title: 'ผู้ขาย', sub: 'คู่ค้าที่ส่งของเข้า', num: `${model.suppliers.length} ราย`, to: { page: 'suppliers' } },
    { key: 'rec', x: 300, y: 60, title: 'ใบรับสินค้า', sub: 'เลขที่รับ B(เดือน)-(ลำดับ)', num: `${model.receipts.length} ใบ`, to: { page: 'receipts' }, core: true },
    { key: 'truck', x: 300, y: 230, title: 'ตาชั่งรถ', sub: 'ชั่งเข้า − ชั่งออก', num: `${model.totals.trucks} เที่ยว`, to: { page: 'reports' } },
    { key: 'bag', x: 570, y: 20, title: 'รายการกระสอบ', sub: 'นน.ก่อน − เต๋า = สุทธิ', num: `${int(bags)} กระสอบ`, to: { page: 'receipts' } },
    { key: 'line', x: 570, y: 130, title: 'บรรทัดราคา', sub: 'นน. × ราคา/กก.', num: `${int(lines)} บรรทัด`, to: { page: 'reports' } },
    { key: 'grade', x: 810, y: 75, title: 'เกรดสินค้า', sub: 'ปอก ช็อต ใหญ่ เล็ก …', num: `${activeGrades.length} เกรด`, to: { page: 'grades' }, core: true },
    { key: 'stock', x: 810, y: 330, title: 'สต๊อกคงเหลือ', sub: 'บัตรสต๊อกต่อเกรด', num: `${kg(model.totals.balance)} กก.`, to: { page: 'stock' }, core: true },
    { key: 'sort', x: 570, y: 250, title: 'คัดแยกเกรด', sub: 'ก่อนคัด → หลังคัด', num: `${local.sorts.length} ครั้ง`, to: { page: 'sorting' } },
    { key: 'issue', x: 570, y: 345, title: 'จ่ายออก / ขาย', sub: 'ตัดยอดสต๊อก', num: `${local.issues.length} รายการ`, to: { page: 'issues' } },
    { key: 'adj', x: 570, y: 440, title: 'ปรับยอด', sub: 'ตรวจนับ / ของเสีย', num: `${local.adjustments.length} รายการ`, to: { page: 'stock' } },
  ];
  const n = Object.fromEntries(nodes.map((x) => [x.key, x]));
  const right = (a: Node) => [a.x + W, a.y + H / 2] as const;
  const left = (a: Node) => [a.x, a.y + H / 2] as const;
  const curve = (p: readonly [number, number], q: readonly [number, number]) => {
    const dx = (q[0] - p[0]) / 2;
    return `M${p[0]},${p[1]} C${p[0] + dx},${p[1]} ${q[0] - dx},${q[1]} ${q[0] - 6},${q[1]}`;
  };
  const edges: { d: string; label: string; lx: number; ly: number }[] = [
    { d: curve(right(n.sup), left(n.rec)), label: '1 : N ส่งของ', lx: 252, ly: 84 },
    { d: curve(right(n.rec), left(n.bag)), label: '1 : N', lx: 527, ly: 58 },
    { d: curve(right(n.rec), left(n.line)), label: '1 : N', lx: 527, ly: 150 },
    { d: `M${n.rec.x + W / 2},${n.rec.y + H} L${n.truck.x + W / 2},${n.truck.y - 6}`, label: '1 : N คัน', lx: 432, ly: 180 },
    { d: curve(right(n.bag), left(n.grade)), label: 'N : 1', lx: 782, ly: 50 },
    { d: curve(right(n.line), left(n.grade)), label: 'N : 1 ราคา', lx: 782, ly: 160 },
    { d: `M${n.grade.x + W / 2},${n.grade.y + H} L${n.stock.x + W / 2},${n.stock.y - 6}`, label: '1 : 1 คงเหลือ', lx: 950, ly: 250 },
    { d: curve(right(n.sort), left(n.stock)), label: 'ย้ายเกรด', lx: 780, ly: 300 },
    { d: curve(right(n.issue), left(n.stock)), label: '− ตัดยอด', lx: 780, ly: 372 },
    { d: curve(right(n.adj), left(n.stock)), label: '±', lx: 780, ly: 430 },
  ];

  // ตารางไขว้ ผู้ขาย × เกรด
  const cols = activeGrades.filter((g) => g.received > 0).slice(0, 10).map((g) => g.grade);
  const maxCell = Math.max(...model.suppliers.flatMap((s) => cols.map((g) => s.grades[g] || 0)), 1);

  return (
    <>
      <PageHead crumb="ความสัมพันธ์" title="ความสัมพันธ์ของข้อมูล" desc="ข้อมูลแต่ละส่วนเชื่อมกันอย่างไร กดกล่องเพื่อไปยังเมนูนั้น" />
      <Card title="ผังข้อมูล" sub="ตัวเลขในกล่องคือจำนวนข้อมูลจริงในระบบตอนนี้">
        <div className="tbl-wrap">
          <svg className="er" viewBox="0 0 1004 530" style={{ minWidth: 760 }} role="img" aria-label="ผังความสัมพันธ์ของข้อมูลสต๊อก">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path className="arrow" d="M0,0 L10,5 L0,10 z" />
              </marker>
            </defs>
            {edges.map((e, i) => <path key={i} className="edge" d={e.d} markerEnd="url(#arr)" />)}
            {edges.map((e, i) => <text key={i} className="edge-lbl" x={e.lx} y={e.ly} textAnchor="middle">{e.label}</text>)}
            {nodes.map((x) => (
              <g key={x.key} className={`node${x.core ? ' core' : ''}`} tabIndex={0} role="button" onClick={() => go(x.to)} onKeyDown={(e) => e.key === 'Enter' && go(x.to)}>
                <rect x={x.x} y={x.y} width={W} height={H} rx={10} />
                <text className="t-title" x={x.x + 14} y={x.y + 24}>{x.title}</text>
                <text className="t-sub" x={x.x + 14} y={x.y + 42}>{x.sub}</text>
                <text className="t-num" x={x.x + 14} y={x.y + 60}>{x.num}</text>
              </g>
            ))}
          </svg>
        </div>
      </Card>

      <Card title="ผู้ขาย × เกรด" sub="น้ำหนักรับเข้าสะสม (กก.) · สีเข้มคือส่งมาก · กดช่องเพื่อดูใบรับที่เกี่ยวข้อง" pad={false}>
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table className="tbl heat">
            <thead>
              <tr><th>ผู้ขาย</th>{cols.map((g) => <th key={g} className="r rot"><GradeChip g={g} /></th>)}<th className="r">รวม</th></tr>
            </thead>
            <tbody>
              {model.suppliers.map((s) => (
                <tr key={s.name} className={nav.supplier === s.name ? 'sel' : ''}>
                  <td><button className="link" onClick={() => go({ page: 'suppliers', supplier: s.name })}>{s.name}</button></td>
                  {cols.map((g) => {
                    const v = s.grades[g] || 0;
                    const a = v ? 0.12 + 0.78 * Math.sqrt(v / maxCell) : 0;
                    return (
                      <td
                        key={g}
                        className="cell"
                        style={{ background: v ? `color-mix(in srgb, var(--leaf) ${Math.round(a * 100)}%, transparent)` : undefined, color: a > 0.55 ? '#fff' : undefined }}
                        onClick={() => v && go({ page: 'receipts', supplier: s.name, grade: g })}
                        title={v ? `${s.name} · ${g}: ${kg(v)} กก.` : undefined}
                      >
                        {v ? kg(v) : <span className="muted">·</span>}
                      </td>
                    );
                  })}
                  <td className="r num" style={{ fontWeight: 600 }}>{kg(s.kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g-2e">
        <Card title="กฎการคำนวณ">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'var(--ink-2)' }}>
            <li>นน.สุทธิกระสอบ = นน.ก่อน (ชั่งเข้า) − นน. เต๋า/กระสอบ</li>
            <li>สต๊อกรับเข้า = ผลรวม นน.สุทธิกระสอบแยกเกรด (ใบที่ไม่มีกระสอบใช้น้ำหนักในบรรทัดราคา)</li>
            <li>ราคารวม = นน.สุทธิ × ราคา/กก. · รวม VAT = ราคารวม × 1.07 (ยกเว้นผู้ขาย No VAT)</li>
            <li>ต้นทุนเฉลี่ยเกรด = ผลรวมราคารวม ÷ ผลรวมน้ำหนักที่มีราคา</li>
            <li>คงเหลือ = รับเข้า + ได้จากคัด − นำไปคัด − จ่ายออก ± ปรับยอด</li>
          </ul>
        </Card>
        <Card title="แหล่งข้อมูล">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'var(--ink-2)' }}>
            <li>ชีต “ใบรับสินค้า(เข้า)” → ใบรับ ตาชั่งรถ กระสอบ และราคา ({model.receipts.filter((r) => r.source === 'sheet').length} ใบ)</li>
            <li>ชีต “คัดแยกเกรด &amp; Stock คงเหลือ” → รายชื่อเกรด และขั้นตอนคัดแยก</li>
            <li>ข้อมูลที่บันทึกในระบบนี้ (ใบรับใหม่ ราคา จ่ายออก คัดแยก ปรับยอด) เก็บในเบราว์เซอร์ สำรอง/ย้ายเครื่องได้ที่เมนูตั้งค่า</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
