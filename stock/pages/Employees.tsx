import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, ConfirmButton, Drawer, Empty, Icon, PageHead, useApp } from '../components/ui';
import { ApiError, type Employee, type EmployeeStatus, STATUS_LABEL, api, shrinkImage, uploadPhoto } from '../lib/api';
import { thDateLong } from '../lib/format';

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`.trim();
const initials = (e: Employee) => (e.nickname || e.firstName).slice(0, 2);
const STATUS_CHIP: Record<EmployeeStatus, string> = { active: 'ok', leave: 'warn', resigned: 'plain' };

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

function Avatar({ e, size = 56 }: { e: Employee; size?: number }) {
  const [broken, setBroken] = useState(false);
  return e.photoUrl && !broken ? (
    <img className="avatar" src={e.photoUrl} alt={`รูป ${fullName(e)}`} width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} />
  ) : (
    <span className="avatar avatar-empty" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">{initials(e)}</span>
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
        actions={admin && <button className="btn pri" onClick={() => setOpen('new')}><Icon name="plus" size={16} />เพิ่มพนักงาน</button>}
      />
      {err && <div className="note warn">{err}</div>}
      {!photosEnabled && admin && <div className="note warn">ยังไม่ได้ผูกที่เก็บรูป R2 (binding ชื่อ PHOTOS) จึงยังอัปโหลดรูปไม่ได้ ข้อมูลอื่นบันทึกได้ตามปกติ</div>}
      <Card pad={false}>
        <div className="card-b filters">
          <input id="emp-search" className="input search" placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง หรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} />
          <select id="emp-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {depts.length > 0 && (
            <select id="emp-dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">ทุกแผนก</option>
              {depts.map((d) => <option key={d}>{d}</option>)}
            </select>
          )}
        </div>
        <div className="emp-grid">
          {rows.map((e) => (
            <button key={e.id} className="emp-card" onClick={() => setOpen(e)}>
              <Avatar e={e} size={64} />
              <span className="emp-info">
                <b>{fullName(e)}{e.nickname && <span className="muted"> ({e.nickname})</span>}</b>
                <span className="muted">{[e.position, e.department].filter(Boolean).join(' · ') || 'ยังไม่ระบุตำแหน่ง'}</span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`chip ${STATUS_CHIP[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                  {e.code && <span className="chip plain num">{e.code}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
        {list === null && !err && <Empty>กำลังโหลด…</Empty>}
        {list && !rows.length && (
          <Empty>
            {list.length ? 'ไม่พบพนักงานที่ตรงกับตัวกรอง' : 'ยังไม่มีข้อมูลพนักงาน'}
            {admin && !list.length && <p><button className="btn pri" onClick={() => setOpen('new')}><Icon name="plus" size={16} />เพิ่มพนักงานคนแรก</button></p>}
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
        <img className="avatar" src={pending.url} alt="รูปที่เลือก" style={{ width: 140, height: 140 }} />
      ) : e ? (
        <Avatar e={e} size={140} />
      ) : (
        <span className="avatar avatar-empty" style={{ width: 140, height: 140 }}><Icon name="employees" size={44} /></span>
      )}
      {admin && photosEnabled && (
        <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
          <input ref={fileRef} id="emp-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(ev) => { pick(ev.target.files?.[0]); ev.target.value = ''; }} />
          <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>{e?.photoUrl || pending ? 'เปลี่ยนรูป' : 'เลือกรูป'}</button>
            {pending && !editing && <button type="button" className="btn sm pri" disabled={uploading} onClick={uploadNow}>{uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูปนี้'}</button>}
            {pending && <button type="button" className="btn sm ghost" onClick={() => setPending(null)}>ยกเลิก</button>}
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
      right={admin && e && !editing ? <button className="btn sm" onClick={() => setEditing(true)}>แก้ไข</button> : undefined}
    >
      {!editing && e ? (
        <>
          <div className="card card-b emp-head">
            {photoBox}
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.3rem' }}>{fullName(e)}{e.nickname && <span className="muted" style={{ fontWeight: 400 }}> ({e.nickname})</span>}</h2>
              <span>{[e.position, e.department].filter(Boolean).join(' · ') || <span className="muted">ยังไม่ระบุตำแหน่ง</span>}</span>
              <span className="row" style={{ gap: 6 }}><span className={`chip ${STATUS_CHIP[e.status]}`}>{STATUS_LABEL[e.status]}</span>{e.code && <span className="chip plain num">{e.code}</span>}</span>
            </div>
          </div>
          <div className="card card-b kv">
            <div><span>เบอร์โทร</span><b className="num">{e.phone || '–'}</b></div>
            <div><span>อีเมล</span><b style={{ overflowWrap: 'anywhere' }}>{e.email || '–'}</b></div>
            <div><span>วันที่เริ่มงาน</span><b>{e.startDate ? thDateLong(e.startDate) : '–'}</b></div>
            <div><span>อายุงาน</span><b>{tenure(e.startDate) || '–'}</b></div>
          </div>
          {e.note && <div className="card card-b"><span className="muted" style={{ fontSize: 13 }}>หมายเหตุ</span><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{e.note}</p></div>}
          {err && <div className="note warn" role="alert">{err}</div>}
          {admin && <div className="row"><span className="spacer" /><ConfirmButton label="ลบพนักงานนี้" onConfirm={del} /></div>}
        </>
      ) : (
        <form className="stack" onSubmit={save}>
          <div className="card card-b emp-head">{photoBox}<p className="muted" style={{ margin: 0 }}>รูปจะถูกย่อให้ไม่เกิน 800 พิกเซลก่อนอัปโหลด และเก็บไว้ใน Cloudflare R2</p></div>
          <div className="card card-b stack">
            <h3>ข้อมูลพื้นฐาน</h3>
            <div className="form-grid">
              <div className="field"><label htmlFor="e-first">ชื่อ *</label><input id="e-first" className="input" value={f.firstName} onChange={set('firstName')} required /></div>
              <div className="field"><label htmlFor="e-last">นามสกุล</label><input id="e-last" className="input" value={f.lastName} onChange={set('lastName')} /></div>
              <div className="field"><label htmlFor="e-nick">ชื่อเล่น</label><input id="e-nick" className="input" value={f.nickname} onChange={set('nickname')} /></div>
              <div className="field"><label htmlFor="e-code">รหัสพนักงาน</label><input id="e-code" className="input" value={f.code} onChange={set('code')} placeholder="เช่น EMP-001" /></div>
              <div className="field"><label htmlFor="e-pos">ตำแหน่ง</label><input id="e-pos" className="input" value={f.position} onChange={set('position')} placeholder="เช่น พนักงานคัดแยก" /></div>
              <div className="field"><label htmlFor="e-dept">แผนก</label><input id="e-dept" className="input" value={f.department} onChange={set('department')} placeholder="เช่น คลังสินค้า" /></div>
              <div className="field"><label htmlFor="e-phone">เบอร์โทร</label><input id="e-phone" className="input" type="tel" value={f.phone} onChange={set('phone')} /></div>
              <div className="field"><label htmlFor="e-email">อีเมล</label><input id="e-email" className="input" type="email" value={f.email} onChange={set('email')} /></div>
              <div className="field"><label htmlFor="e-start">วันที่เริ่มงาน</label><input id="e-start" className="input" type="date" value={f.startDate} onChange={set('startDate')} /></div>
              <div className="field">
                <label htmlFor="e-status">สถานะ</label>
                <select id="e-status" className="input" value={f.status} onChange={set('status')}>
                  {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="e-note">หมายเหตุ</label><textarea id="e-note" className="input" rows={3} value={f.note} onChange={set('note')} /></div>
          </div>
          {err && <div className="note warn" role="alert">{err}</div>}
          <div className="row">
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => (e ? setEditing(false) : onClose())}>ยกเลิก</button>
            <button className="btn pri" disabled={busy}>{busy ? (uploading ? 'กำลังอัปโหลดรูป…' : 'กำลังบันทึก…') : e ? 'บันทึก' : 'เพิ่มพนักงาน'}</button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
