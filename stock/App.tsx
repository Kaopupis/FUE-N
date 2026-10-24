import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ctx, Icon } from './components/ui';
import { buildModel } from './lib/calc';
import { SHEET_URL } from './lib/data';
import { useLocalData } from './lib/store';
import type { NavTarget, Page } from './lib/types';
import Dashboard from './pages/Dashboard';
import Grades from './pages/Grades';
import Issues from './pages/Issues';
import Receipts from './pages/Receipts';
import Relations from './pages/Relations';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Sorting from './pages/Sorting';
import Stock from './pages/Stock';
import Suppliers from './pages/Suppliers';

const MENU: { sec: string; items: { page: Page; label: string }[] }[] = [
  { sec: 'ภาพรวม', items: [{ page: 'dashboard', label: 'แดชบอร์ด' }, { page: 'stock', label: 'สต๊อกคงเหลือ' }] },
  { sec: 'เอกสาร', items: [{ page: 'receipts', label: 'รับสินค้าเข้า' }, { page: 'issues', label: 'จ่ายออก / ขาย' }, { page: 'sorting', label: 'คัดแยกเกรด' }] },
  { sec: 'ข้อมูลหลัก', items: [{ page: 'grades', label: 'เกรดสินค้า' }, { page: 'suppliers', label: 'ผู้ขาย / คู่ค้า' }, { page: 'relations', label: 'ความสัมพันธ์ข้อมูล' }] },
  { sec: 'สรุปผล', items: [{ page: 'reports', label: 'รายงาน' }, { page: 'settings', label: 'ข้อมูลและการสำรอง' }] },
];
const PAGES = MENU.flatMap((m) => m.items.map((i) => i.page));

function pageFromHash(): Page {
  const h = location.hash.replace('#', '') as Page;
  return PAGES.includes(h) ? h : 'dashboard';
}

export default function App() {
  const [local, update] = useLocalData();
  const model = useMemo(() => buildModel(local), [local]);
  const [nav, setNav] = useState<NavTarget>({ page: pageFromHash() });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastMsg, setToast] = useState('');

  const go = useCallback((t: NavTarget) => {
    setNav(t);
    setMenuOpen(false);
    try {
      if (location.hash !== `#${t.page}`) history.replaceState(null, '', `#${t.page}`);
    } catch {
      /* frame อาจไม่อนุญาต */
    }
    if (!t.receiptId) window.scrollTo({ top: 0 });
  }, []);
  const toast = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);
  useEffect(() => {
    const h = () => setNav({ page: pageFromHash() });
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const Page = { dashboard: Dashboard, stock: Stock, receipts: Receipts, issues: Issues, sorting: Sorting, grades: Grades, suppliers: Suppliers, relations: Relations, reports: Reports, settings: Settings }[nav.page];
  const title = MENU.flatMap((m) => m.items).find((i) => i.page === nav.page)?.label;

  return (
    <Ctx.Provider value={{ model, local, update, go, toast, nav }}>
      <div className="mobile-bar">
        <button className="iconbtn" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Icon name="menu" /></button>
        <b>{title}</b>
        <button className="iconbtn" onClick={() => go({ page: 'receipts', newForm: true })} aria-label="รับสินค้าเข้า"><Icon name="plus" /></button>
      </div>
      <div className="shell">
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
        <aside className={`side${menuOpen ? ' open' : ''}`}>
          <div className="brand">
            <div className="brand-mark"><Icon name="stock" size={22} /></div>
            <div><b>สหมิตร สต๊อก</b><small>รับซื้อทองแดง · เศษโลหะ</small></div>
          </div>
          <nav className="nav" aria-label="เมนูหลัก">
            {MENU.map((m) => (
              <React.Fragment key={m.sec}>
                <div className="nav-sec">{m.sec}</div>
                {m.items.map((i) => (
                  <button key={i.page} className={nav.page === i.page ? 'on' : ''} onClick={() => go({ page: i.page })} aria-current={nav.page === i.page ? 'page' : undefined}>
                    <Icon name={i.page} />
                    {i.label}
                    {i.page === 'receipts' && model.totals.pending > 0 && <span className="badge" title="ใบรับรอกำหนดราคา">{model.totals.pending}</span>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>
          <div className="side-foot">ข้อมูลอ้างอิง: <a href={SHEET_URL} target="_blank" rel="noreferrer">บัญชีรับส่งสินค้า สหมิตร</a></div>
        </aside>
        <main className="main">
          <div className="main-inner"><Page /></div>
        </main>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
