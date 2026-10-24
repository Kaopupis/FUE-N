import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ArrowRight, ChartColumn, Clock, Coins, Contact, Copy, DatabaseBackup, ExternalLink, Info, LayoutDashboard, ListFilter,
  type LucideIcon, Menu, Network, Package, PackageMinus, PackagePlus, Plus, Scale, Search, Tag, Trash2, TriangleAlert, Truck, Users, X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle, Card as UICard } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
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

// ไอคอนจาก lucide (ชุดไอคอนมาตรฐานของ shadcn/ui)
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, stock: Package, receipts: PackagePlus, issues: PackageMinus, sorting: ListFilter,
  grades: Tag, suppliers: Truck, relations: Network, reports: ChartColumn, settings: DatabaseBackup,
  users: Users, employees: Contact, plus: Plus, close: X, menu: Menu, search: Search, truck: Truck,
  scale: Scale, coin: Coins, clock: Clock, trash: Trash2, copy: Copy, arrow: ArrowRight, ext: ExternalLink,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Package;
  return <C size={size} aria-hidden="true" />;
}

export function Card({ title, sub, right, children, pad = true }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <UICard className="min-w-0 gap-3 py-4">
      {(title || right) && (
        <CardHeader className="px-4">
          {title && <CardTitle className="font-heading text-[1.05rem]">{title}</CardTitle>}
          {sub && <CardDescription>{sub}</CardDescription>}
          {right && <CardAction className="max-sm:col-start-1 max-sm:row-start-3 max-sm:justify-self-start">{right}</CardAction>}
        </CardHeader>
      )}
      {pad ? <CardContent className="px-4">{children}</CardContent> : children}
    </UICard>
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
  const cls = cn('kpi flex flex-col rounded-xl border shadow-sm', hero ? 'hero' : 'bg-card text-card-foreground');
  return onClick ? <button className={cls} onClick={onClick}>{inner}</button> : <div className={cls}>{inner}</div>;
}

export function StatusChip({ s }: { s: PriceStatus }) {
  if (s === 'priced') return <Badge variant="success">มีราคาแล้ว</Badge>;
  if (s === 'partial') return <Badge variant="warning">ราคาไม่ครบ</Badge>;
  return <Badge variant="warning">รอกำหนดราคา</Badge>;
}

export function GradeChip({ g, kg }: { g: string; kg?: string }) {
  const { go } = useApp();
  return (
    <Badge asChild variant="outline" className="cursor-pointer hover:border-primary">
      <button onClick={(e) => { e.stopPropagation(); go({ page: 'grades', grade: g }); }} title={`ดูเกรด ${g}`}>
        <i className="dot" style={{ background: gradeColor(g) }} />
        {g}
        {kg && <span className="num text-muted-foreground">{kg}</span>}
      </button>
    </Badge>
  );
}

export type Tone = 'ok' | 'warn' | 'info' | 'plain' | 'bad';
const TONE: Record<Tone, React.ComponentProps<typeof Badge>> = {
  ok: { variant: 'success' }, warn: { variant: 'warning' }, info: { variant: 'info' }, plain: { variant: 'outline' },
  bad: { variant: 'secondary', className: 'bg-destructive/12 text-destructive' },
};

// ป้ายสถานะแบบเลือกโทนตามค่า
export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <Badge {...TONE[tone]}>{children}</Badge>;
}

export const LINK = 'cursor-pointer font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring';

export function SupplierLink({ name }: { name: string }) {
  const { go } = useApp();
  return <button className={LINK} onClick={(e) => { e.stopPropagation(); go({ page: 'suppliers', supplier: name }); }}>{name}</button>;
}

export function ReceiptLink({ id }: { id: string }) {
  const { go, model } = useApp();
  if (!model.receiptById.has(id)) return <span className="num">{id}</span>;
  return <button className={cn(LINK, 'num')} onClick={(e) => { e.stopPropagation(); go({ page: 'receipts', receiptId: id }); }}>{id}</button>;
}

// แผงด้านขวา (Sheet ของ shadcn) สำหรับรายละเอียดและฟอร์ม
export function Drawer({ title, onClose, children, right }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 bg-background p-0 sm:max-w-3xl" aria-describedby={undefined}>
        <SheetHeader className="sticky top-0 z-10 flex-row items-center gap-3 border-b bg-card px-5 py-3 pr-14">
          <SheetTitle className="flex-1 font-heading text-lg">{title}</SheetTitle>
          {right}
        </SheetHeader>
        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-10">{children}</div>
      </SheetContent>
    </Sheet>
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
    <Button
      type="button"
      variant={armed ? 'destructive' : 'outline'}
      size={small ? 'sm' : 'default'}
      className={armed ? '' : 'text-destructive hover:text-destructive'}
      onClick={(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    >
      <Trash2 />{armed ? armedLabel : label}
    </Button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

// กล่องข้อความแจ้ง (Alert ของ shadcn)
export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <Alert className={tone === 'warn' ? 'border-warning/40 bg-warning/8 text-warning' : 'border-primary/25 bg-accent text-accent-foreground'} role={tone === 'warn' ? 'alert' : undefined}>
      {tone === 'warn' ? <TriangleAlert /> : <Info />}
      <AlertDescription className="block text-inherit">{children}</AlertDescription>
    </Alert>
  );
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
