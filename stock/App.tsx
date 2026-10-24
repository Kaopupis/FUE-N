import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChangePasswordForm } from './components/Auth';
import { Ctx, Drawer, Icon } from './components/ui';
import { ROLE_LABEL, type User } from './lib/api';
import { buildModel } from './lib/calc';
import { SHEET_URL } from './lib/data';
import { useLocalData } from './lib/store';
import type { NavTarget, Page, Receipt } from './lib/types';
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
import Users from './pages/Users';
import Employees from './pages/Employees';

const MENU: { sec: string; items: { page: Page; label: string }[] }[] = [
  { sec: 'ภาพรวม', items: [{ page: 'dashboard', label: 'แดชบอร์ด' }, { page: 'stock', label: 'สต๊อกคงเหลือ' }] },
  { sec: 'เอกสาร', items: [{ page: 'receipts', label: 'รับสินค้าเข้า' }, { page: 'issues', label: 'จ่ายออก / ขาย' }, { page: 'sorting', label: 'คัดแยกเกรด' }] },
  { sec: 'ข้อมูลหลัก', items: [{ page: 'grades', label: 'เกรดสินค้า' }, { page: 'suppliers', label: 'ผู้ขาย / คู่ค้า' }, { page: 'employees', label: 'พนักงาน' }, { page: 'relations', label: 'ความสัมพันธ์ข้อมูล' }] },
  { sec: 'สรุปผล', items: [{ page: 'reports', label: 'รายงาน' }, { page: 'settings', label: 'ข้อมูลและการสำรอง' }] },
  { sec: 'ระบบ', items: [{ page: 'users', label: 'ผู้ใช้งาน' }] },
];

function menuFor(user: User) {
  return user.role === 'admin' ? MENU : MENU.filter((m) => m.sec !== 'ระบบ');
}

function pageFromHash(user: User): Page {
  const h = location.hash.replace('#', '') as Page;
  return menuFor(user).flatMap((m) => m.items.map((i) => i.page)).includes(h) ? h : 'dashboard';
}

interface Props {
  user: User;
  sheet: Receipt[];
  onLogout: () => void;
  onUserChange: (u: User) => void;
}

export default function App({ user, sheet, onLogout, onUserChange }: Props) {
  const [local, update] = useLocalData();
  const model = useMemo(() => buildModel(local, sheet), [local, sheet]);
  const [nav, setNav] = useState<NavTarget>(() => ({ page: pageFromHash(user) }));
  const [pwOpen, setPwOpen] = useState(false);
  const menu = menuFor(user);
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
    const h = () => setNav({ page: pageFromHash(user) });
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [user]);

  const Page = { dashboard: Dashboard, stock: Stock, receipts: Receipts, issues: Issues, sorting: Sorting, grades: Grades, suppliers: Suppliers, relations: Relations, reports: Reports, settings: Settings, users: Users, employees: Employees }[nav.page];
  const title = menu.flatMap((m) => m.items).find((i) => i.page === nav.page)?.label;

  return (
    <Ctx.Provider value={{ model, local, update, go, toast, nav, user }}>
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
            {menu.map((m) => (
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
          <div className="side-user">
            <div className="side-user-name">
              <b>{user.displayName || user.username}</b>
              <small>{user.username} · {ROLE_LABEL[user.role]}</small>
            </div>
            <div className="side-user-actions">
              <button onClick={() => { setPwOpen(true); setMenuOpen(false); }}>เปลี่ยนรหัสผ่าน</button>
              <button onClick={onLogout}>ออกจากระบบ</button>
            </div>
          </div>
          <div className="side-foot">ข้อมูลอ้างอิง: <a href={SHEET_URL} target="_blank" rel="noreferrer">บัญชีรับส่งสินค้า สหมิตร</a></div>
        </aside>
        <main className="main">
          <div className="main-inner"><Page /></div>
        </main>
      </div>
      {pwOpen && (
        <Drawer title="เปลี่ยนรหัสผ่าน" onClose={() => setPwOpen(false)}>
          <div className="card card-b">
            <ChangePasswordForm onCancel={() => setPwOpen(false)} onDone={(u) => { setPwOpen(false); onUserChange(u); toast('เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่เคยเข้าไว้ถูกออกจากระบบ'); }} />
          </div>
        </Drawer>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
