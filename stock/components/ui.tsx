import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Model, PriceStatus } from '../lib/calc';
import type { User } from '../lib/api';
import type { LocalData, NavTarget } from '../lib/types';

export interface AppCtx {
  model: Model;
  local: LocalData;
  update: (fn: (d: LocalData) => LocalData) => void;
  go: (t: NavTarget) => void;
  toast: (msg: string) => void;
  nav: NavTarget;
  user: User;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);

// สีประจำเกรด ใช้ร่วมกันทั้งกราฟและชิป
const GRADE_COLORS: Record<string, string> = {
  ปอก: '#1f8a4c',
  ช็อต: '#2f6fb0',
  ใหญ่: '#c98a12',
  เล็ก: '#8e5bb5',
  ชุบขาว: '#7a8a93',
  ท่อใหม่: '#c4553b',
  ทองเหลือง: '#b8a01f',
};
const EXTRA = ['#3d9c9c', '#a3567a', '#5f7f2a', '#6a6fc2', '#b0723c', '#4f8f6b'];
export function gradeColor(g: string) {
  if (GRADE_COLORS[g]) return GRADE_COLORS[g];
  let h = 0;
  for (const c of g) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

const P: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  stock: 'M20 7 12 3 4 7v10l8 4 8-4zM4 7l8 4 8-4M12 11v10',
  receipts: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3',
  issues: 'M12 21V9m0 0-4 4m4-4 4 4M4 7V4h16v3',
  sorting: 'M4 6h16M7 12h10M10 18h4',
  grades: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  suppliers: 'M3 17h2l1-5h11l1 5h3M6 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0m8 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 12V7h6l3 5',
  relations: 'M6 6m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M18 18m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M18 6m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M9 6h6M18 9v6M8.2 8.2l7.6 7.6',
  reports: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0zM8 21h8',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v12',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}

export function Card({ title, sub, right, children, pad = true }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      {(title || right) && (
        <div className="card-h">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {pad ? <div className="card-b">{children}</div> : children}
    </section>
  );
}

export function Kpi({ label, value, unit, sub, icon, hero, onClick }: { label: string; value: string; unit?: string; sub?: React.ReactNode; icon?: string; hero?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      <span className="lbl">{icon && <Icon name={icon} size={16} />}{label}</span>
      <span className="val">{value}{unit && <small>{unit}</small>}</span>
      {sub && <span className="sub">{sub}</span>}
    </>
  );
  const cls = `card kpi${hero ? ' hero' : ''}`;
  return onClick ? <button className={cls} onClick={onClick}>{inner}</button> : <div className={cls}>{inner}</div>;
}

export function StatusChip({ s }: { s: PriceStatus }) {
  if (s === 'priced') return <span className="chip ok">มีราคาแล้ว</span>;
  if (s === 'partial') return <span className="chip warn">ราคาไม่ครบ</span>;
  return <span className="chip warn">รอกำหนดราคา</span>;
}

export function GradeChip({ g, kg }: { g: string; kg?: string }) {
  const { go } = useApp();
  return (
    <button className="chip plain" onClick={(e) => { e.stopPropagation(); go({ page: 'grades', grade: g }); }} title={`ดูเกรด ${g}`}>
      <i className="dot" style={{ background: gradeColor(g) }} />
      {g}
      {kg && <span className="num" style={{ color: 'var(--ink-3)' }}>{kg}</span>}
    </button>
  );
}

export function SupplierLink({ name }: { name: string }) {
  const { go } = useApp();
  return <button className="link" onClick={(e) => { e.stopPropagation(); go({ page: 'suppliers', supplier: name }); }}>{name}</button>;
}

export function ReceiptLink({ id }: { id: string }) {
  const { go, model } = useApp();
  if (!model.receiptById.has(id)) return <span className="num">{id}</span>;
  return <button className="link num" onClick={(e) => { e.stopPropagation(); go({ page: 'receipts', receiptId: id }); }}>{id}</button>;
}

export function Drawer({ title, onClose, children, right }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-h">
          <h2>{title}</h2>
          {right}
          <button className="iconbtn" onClick={onClose} aria-label="ปิด"><Icon name="close" /></button>
        </div>
        <div className="drawer-b">{children}</div>
      </aside>
    </div>
  );
}

// ปุ่มลบแบบกดสองครั้ง (หน้าจอบางแห่งไม่แสดง confirm())
export function ConfirmButton({ onConfirm, label = 'ลบ', armedLabel = 'กดอีกครั้งเพื่อยืนยัน', small }: { onConfirm: () => void; label?: string; armedLabel?: string; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`btn danger${armed ? ' armed' : ''}${small ? ' sm' : ''}`}
      onClick={(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    >
      <Icon name="trash" size={15} />{armed ? armedLabel : label}
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Bar({ v, max, color }: { v: number; max: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${max ? Math.max(1, (v / max) * 100) : 0}%`, background: color }} /></div>;
}

export function PageHead({ crumb, title, desc, actions }: { crumb: string; title: string; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
