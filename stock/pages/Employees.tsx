import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, Icon, Note, PageHead, Pill, useApp, type Tone } from '../components/ui';
import { ApiError, type Employee, type EmployeeStatus, STATUS_LABEL, api, shrinkImage, uploadPhoto } from '../lib/api';
import { thDateLong } from '../lib/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`.trim();
const initials = (e: Employee) => (e.nickname || e.firstName).slice(0, 2);
const STATUS_CHIP: Record<EmployeeStatus, Tone> = { active: 'ok', leave: 'warn', resigned: 'plain' };

// อายุงานแบบ ปี/เดือน
function tenure(start: string | null) {
  if (!start) return '';
  const s = new Date(start);
  const n = new Date();
  let m = (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth();
  if (n.getDate() < s.getDate()) m--;
  if (m < 0) return '';
  const y = Math.floor(m / 12);
  return y ? `${y} ปี ${m % 12} เดือน` : `${m} เดือน`;
}

function EmpAvatar({ e, size = 56 }: { e: Employee; size?: number }) {
  return (
    <Avatar className="border-2 border-card ring-1 ring-input" style={{ width: size, height: size }}>
      {e.photoUrl && <AvatarImage src={e.photoUrl} alt={`รูป ${fullName(e)}`} className="object-cover" />}
      <AvatarFallback className="bg-accent font-heading font-semibold text-primary" style={{ fontSize: size * 0.34 }}>{initials(e)}</AvatarFallback>
    </Avatar>
  );
}

export default function Employees() {
  const { user, toast } = useApp();
  const admin = user.role === 'admin';
  const [list, setList] = useState<Employee[] | null>(null);
  const [photosEnabled, setPhotosEnabled] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('active');
  const [dept, setDept] = useState('');
  const [open, setOpen] = useState<Employee | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ employees: Employee[]; photosEnabled: boolean }>('/api/employees');
      setList(r.employees);
      setPhotosEnabled(r.photosEnabled);
      setErr('');
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'โหลดข้อมูลพนักงานไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const depts = useMemo(() => [...new Set((list ?? []).map((e) => e.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [list]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter(
      (e) =>
        (!status || e.status === status) &&
        (!dept || e.department === dept) &&
        (!s || [e.code, e.firstName, e.lastName, e.nickname, e.position, e.phone].some((x) => x.toLowerCase().includes(s))),
    );
  }, [list, q, status, dept]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { active: 0, leave: 0, resigned: 0 };
    (list ?? []).forEach((e) => c[e.status]++);
    return c;
  }, [list]);

  const onSaved = (e: Employee, msg: string) => {
    setList((l) => (l ? (l.some((x) => x.id === e.id) ? l.map((x) => (x.id === e.id ? e : x)) : [...l, e]) : [e]));
    setOpen(e);
    toast(msg);
  };

  return (
    <>
      <PageHead
        crumb="ข้อมูลหลัก"
        title="ข้อมูลพนักงาน"
        desc={`ทำงานอยู่ ${counts.active} คน · ลาพัก ${counts.leave} · ลาออก ${counts.resigned}`}
        actions={admin && <Button onClick={() => setOpen('new')}><Icon name="plus" size={16} />เพิ่มพนักงาน</Button>}
      />
      {err && <Note tone="warn">{err}</Note>}
      {!photosEnabled && admin && <Note tone="warn">ยังไม่ได้ผูกที่เก็บรูป R2 (binding ชื่อ PHOTOS) จึงยังอัปโหลดรูปไม่ได้ ข้อมูลอื่นบันทึกได้ตามปกติ</Note>}
      <Card pad={false}>
        <div className="filters px-4">
          <Input id="emp-search" className="search" placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง หรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} />
          <NativeSelect id="emp-status" value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </NativeSelect>
          {depts.length > 0 && (
            <NativeSelect id="emp-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">ทุกแผนก</option>
              {depts.map((d) => <option key={d}>{d}</option>)}
            </NativeSelect>
          )}
        </div>
        <div className="emp-grid px-4">
          {rows.map((e) => (
            <button key={e.id} className="emp-card" onClick={() => setOpen(e)}>
              <EmpAvatar e={e} size={64} />
              <span className="emp-info">
                <b>{fullName(e)}{e.nickname && <span className="muted"> ({e.nickname})</span>}</b>
                <span className="muted">{[e.position, e.department].filter(Boolean).join(' · ') || 'ยังไม่ระบุตำแหน่ง'}</span>
                <span className="row" style={{ gap: 6 }}>
                  <Pill tone={STATUS_CHIP[e.status]}>{STATUS_LABEL[e.status]}</Pill>
                  {e.code && <Badge variant="outline" className="num">{e.code}</Badge>}
                </span>
              </span>
            </button>
          ))}
        </div>
        {list === null && !err && <Empty>กำลังโหลด…</Empty>}
        {list && !rows.length && (
          <Empty>
            {list.length ? 'ไม่พบพนักงานที่ตรงกับตัวกรอง' : 'ยังไม่มีข้อมูลพนักงาน'}
            {admin && !list.length && <p><Button onClick={() => setOpen('new')}><Icon name="plus" size={16} />เพิ่มพนักงานคนแรก</Button></p>}
          </Empty>
        )}
      </Card>
      {open && (
        <EmployeeDrawer
          key={open === 'new' ? 'new' : open.id}
          e={open === 'new' ? undefined : open}
          admin={admin}
          photosEnabled={photosEnabled}
          onClose={() => setOpen(null)}
          onSaved={onSaved}
          onDeleted={(id) => { setList((l) => l?.filter((x) => x.id !== id) ?? null); setOpen(null); toast('ลบข้อมูลพนักงานแล้ว'); }}
        />
      )}
    </>
  );
}

const EMPTY = { code: '', firstName: '', lastName: '', nickname: '', position: '', department: '', phone: '', email: '', startDate: '', status: 'active' as EmployeeStatus, note: '' };

function EmployeeDrawer({ e, admin, photosEnabled, onClose, onSaved, onDeleted }: {
  e?: Employee; admin: boolean; photosEnabled: boolean;
  onClose: () => void; onSaved: (e: Employee, msg: string) => void; onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(!e);
  const [f, setF] = useState(() => (e ? { ...EMPTY, ...e, startDate: e.startDate ?? '' } : EMPTY));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof EMPTY) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: ev.target.value }));

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  const pick = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) return setErr('เลือกได้เฉพาะไฟล์รูป JPG, PNG หรือ WEBP');
    setErr('');
    try {
      const blob = await shrinkImage(file);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setErr('เปิดไฟล์รูปนี้ไม่ได้ ลองบันทึกเป็น JPG แล้วเลือกใหม่');
    }
  };

  const sendPhoto = async (id: number, blob: Blob) => {
    setUploading(true);
    try {
      const updated = await uploadPhoto(id, blob);
      setPending(null);
      return updated;
    } finally {
      setUploading(false);
    }
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, startDate: f.startDate || null };
      let saved = e
        ? (await api<{ employee: Employee }>(`/api/employees/${e.id}`, { method: 'PATCH', body })).employee
        : (await api<{ employee: Employee }>('/api/employees', { body })).employee;
      if (pending) {
        try {
          saved = await sendPhoto(saved.id, pending.blob);
        } catch (x) {
          setErr(`บันทึกข้อมูลแล้ว แต่อัปโหลดรูปไม่สำเร็จ: ${x instanceof Error ? x.message : ''}`);
        }
      }
      setEditing(false);
      onSaved(saved, e ? 'บันทึกข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว');
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  // ตอนดูข้อมูล (ไม่ได้แก้ไข) อัปโหลดรูปได้ทันที
  const uploadNow = async () => {
    if (!e || !pending) return;
    setErr('');
    try {
      onSaved(await sendPhoto(e.id, pending.blob), 'อัปโหลดรูปแล้ว');
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'อัปโหลดไม่สำเร็จ');
    }
  };

  const removePhoto = async () => {
    if (!e) return;
    try {
      onSaved((await api<{ employee: Employee }>(`/api/employees/${e.id}/photo`, { method: 'DELETE' })).employee, 'ลบรูปแล้ว');
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'ลบรูปไม่สำเร็จ');
    }
  };

  const del = async () => {
    if (!e) return;
    try {
      await api(`/api/employees/${e.id}`, { method: 'DELETE' });
      onDeleted(e.id);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'ลบไม่สำเร็จ');
    }
  };

  const photoBox = (
    <div
      className={`photo-box${drag ? ' drag' : ''}`}
      onDragOver={(ev) => { if (admin && photosEnabled) { ev.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)}
      onDrop={(ev) => { ev.preventDefault(); setDrag(false); if (admin && photosEnabled) pick(ev.dataTransfer.files[0]); }}
    >
      {pending ? (
        <Avatar className="size-[140px] border-2 border-card ring-1 ring-input"><AvatarImage src={pending.url} alt="รูปที่เลือก" className="object-cover" /></Avatar>
      ) : e ? (
        <EmpAvatar e={e} size={140} />
      ) : (
        <Avatar className="size-[140px] ring-1 ring-input"><AvatarFallback className="bg-accent text-primary"><Icon name="employees" size={44} /></AvatarFallback></Avatar>
      )}
      {admin && photosEnabled && (
        <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
          <input ref={fileRef} id="emp-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(ev) => { pick(ev.target.files?.[0]); ev.target.value = ''; }} />
          <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{e?.photoUrl || pending ? 'เปลี่ยนรูป' : 'เลือกรูป'}</Button>
            {pending && !editing && <Button type="button" size="sm" disabled={uploading} onClick={uploadNow}>{uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูปนี้'}</Button>}
            {pending && <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>ยกเลิก</Button>}
            {!pending && e?.photoUrl && !editing && <ConfirmButton small label="ลบรูป" armedLabel="กดอีกครั้ง" onConfirm={removePhoto} />}
          </div>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{pending && editing ? 'รูปจะอัปโหลดเมื่อกดบันทึก' : 'ลากรูปมาวาง หรือกดเลือก · มือถือถ่ายรูปได้เลย'}</span>
        </div>
      )}
    </div>
  );

  return (
    <Drawer
      title={e ? fullName(e) : 'เพิ่มพนักงานใหม่'}
      onClose={onClose}
      right={admin && e && !editing ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}>แก้ไข</Button> : undefined}
    >
      {!editing && e ? (
        <>
          <div className="panel emp-head">
            {photoBox}
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.3rem' }}>{fullName(e)}{e.nickname && <span className="muted" style={{ fontWeight: 400 }}> ({e.nickname})</span>}</h2>
              <span>{[e.position, e.department].filter(Boolean).join(' · ') || <span className="muted">ยังไม่ระบุตำแหน่ง</span>}</span>
              <span className="row" style={{ gap: 6 }}><Pill tone={STATUS_CHIP[e.status]}>{STATUS_LABEL[e.status]}</Pill>{e.code && <Badge variant="outline" className="num">{e.code}</Badge>}</span>
            </div>
          </div>
          <div className="panel kv">
            <div><span>เบอร์โทร</span><b className="num">{e.phone || '–'}</b></div>
            <div><span>อีเมล</span><b style={{ overflowWrap: 'anywhere' }}>{e.email || '–'}</b></div>
            <div><span>วันที่เริ่มงาน</span><b>{e.startDate ? thDateLong(e.startDate) : '–'}</b></div>
            <div><span>อายุงาน</span><b>{tenure(e.startDate) || '–'}</b></div>
          </div>
          {e.note && <div className="panel"><span className="muted" style={{ fontSize: 13 }}>หมายเหตุ</span><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{e.note}</p></div>}
          {err && <Note tone="warn">{err}</Note>}
          {admin && <div className="row"><span className="spacer" /><ConfirmButton label="ลบพนักงานนี้" onConfirm={del} /></div>}
        </>
      ) : (
        <form className="stack" onSubmit={save}>
          <div className="panel emp-head">{photoBox}<p className="muted" style={{ margin: 0 }}>รูปจะถูกย่อให้ไม่เกิน 800 พิกเซลก่อนอัปโหลด และเก็บไว้ใน Cloudflare R2</p></div>
          <div className="panel stack">
            <h3>ข้อมูลพื้นฐาน</h3>
            <div className="form-grid">
              <div className="field"><Label htmlFor="e-first">ชื่อ *</Label><Input id="e-first"  value={f.firstName} onChange={set('firstName')} required /></div>
              <div className="field"><Label htmlFor="e-last">นามสกุล</Label><Input id="e-last"  value={f.lastName} onChange={set('lastName')} /></div>
              <div className="field"><Label htmlFor="e-nick">ชื่อเล่น</Label><Input id="e-nick"  value={f.nickname} onChange={set('nickname')} /></div>
              <div className="field"><Label htmlFor="e-code">รหัสพนักงาน</Label><Input id="e-code"  value={f.code} onChange={set('code')} placeholder="เช่น EMP-001" /></div>
              <div className="field"><Label htmlFor="e-pos">ตำแหน่ง</Label><Input id="e-pos"  value={f.position} onChange={set('position')} placeholder="เช่น พนักงานคัดแยก" /></div>
              <div className="field"><Label htmlFor="e-dept">แผนก</Label><Input id="e-dept"  value={f.department} onChange={set('department')} placeholder="เช่น คลังสินค้า" /></div>
              <div className="field"><Label htmlFor="e-phone">เบอร์โทร</Label><Input id="e-phone"  type="tel" value={f.phone} onChange={set('phone')} /></div>
              <div className="field"><Label htmlFor="e-email">อีเมล</Label><Input id="e-email"  type="email" value={f.email} onChange={set('email')} /></div>
              <div className="field"><Label htmlFor="e-start">วันที่เริ่มงาน</Label><Input id="e-start"  type="date" value={f.startDate} onChange={set('startDate')} /></div>
              <div className="field">
                <Label htmlFor="e-status">สถานะ</Label>
                <NativeSelect id="e-status" value={f.status} onChange={set('status')}>
                  {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div className="field"><Label htmlFor="e-note">หมายเหตุ</Label><Textarea id="e-note"  rows={3} value={f.note} onChange={set('note')} /></div>
          </div>
          {err && <Note tone="warn">{err}</Note>}
          <div className="row">
            <span className="spacer" />
            <Button type="button" variant="outline" onClick={() => (e ? setEditing(false) : onClose())}>ยกเลิก</Button>
            <Button disabled={busy}>{busy ? (uploading ? 'กำลังอัปโหลดรูป…' : 'กำลังบันทึก…') : e ? 'บันทึก' : 'เพิ่มพนักงาน'}</Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
