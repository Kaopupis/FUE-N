import React, { useCallback, useEffect, useState } from 'react';
import { Card, Drawer, Empty, Icon, PageHead, useApp } from '../components/ui';
import { ApiError, ROLE_LABEL, type Role, type User, api, randomPassword } from '../lib/api';
import { copyText } from './Reports';

// วันเวลาจาก D1 (UTC "YYYY-MM-DD HH:MM:SS") แสดงเป็นเวลาไทย พ.ศ.
function when(s: string | null) {
  if (!s) return '–';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Users() {
  const { user: me, toast } = useApp();
  const [users, setUsers] = useState<User[] | null>(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [reset, setReset] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: User[] }>('/api/users')).users);
      setErr('');
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (me.role !== 'admin') {
    return (
      <>
        <PageHead crumb="ผู้ใช้งาน" title="ผู้ใช้งาน" />
        <div className="note warn">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>
      </>
    );
  }

  return (
    <>
      <PageHead
        crumb="ผู้ใช้งาน"
        title="ผู้ใช้งานระบบ"
        desc="เพิ่มผู้ใช้ แก้ไขสิทธิ์ ปิดการใช้งาน และรีเซ็ตรหัสผ่าน ข้อมูลเก็บในฐานข้อมูล D1 บน Cloudflare"
        actions={<button className="btn pri" onClick={() => setEdit('new')}><Icon name="plus" size={16} />เพิ่มผู้ใช้</button>}
      />
      {err && <div className="note warn">{err}</div>}
      <Card pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th /></tr></thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="num"><b>{u.username}</b>{u.id === me.id && <span className="chip info" style={{ marginLeft: 6 }}>คุณ</span>}</td>
                  <td>{u.displayName || <span className="muted">–</span>}</td>
                  <td><span className={`chip ${u.role === 'admin' ? 'ok' : 'plain'}`}>{ROLE_LABEL[u.role]}</span></td>
                  <td>
                    {!u.active ? <span className="chip bad">ปิดการใช้งาน</span> : u.mustChangePassword ? <span className="chip warn">รอเปลี่ยนรหัสผ่าน</span> : <span className="chip ok">ใช้งานได้</span>}
                  </td>
                  <td className="muted">{when(u.lastLoginAt)}</td>
                  <td className="r">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setEdit(u)}>แก้ไข</button>
                      <button className="btn sm" onClick={() => setReset(u)}>รีเซ็ตรหัสผ่าน</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users === null && !err && <Empty>กำลังโหลด…</Empty>}
        </div>
      </Card>
      <div className="note">
        ผู้ใช้ใหม่และผู้ที่ถูกรีเซ็ตรหัสผ่าน ต้องตั้งรหัสผ่านใหม่เองเมื่อเข้าระบบครั้งถัดไป · <b>ผู้ดูแลระบบ</b> จัดการผู้ใช้ได้ · <b>พนักงาน</b> ใช้งานระบบสต๊อกได้ทุกเมนู ยกเว้นหน้านี้
      </div>
      {edit && <UserForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); toast(m); load(); }} />}
      {reset && <ResetPassword u={reset} onClose={() => { setReset(null); load(); }} />}
    </>
  );
}

function UserForm({ initial, onClose, onSaved }: { initial?: User; onClose: () => void; onSaved: (msg: string) => void }) {
  const { user: me } = useApp();
  const [username, setUsername] = useState(initial?.username ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [role, setRole] = useState<Role>(initial?.role ?? 'staff');
  const [active, setActive] = useState(initial?.active ?? true);
  const [password, setPassword] = useState(() => (initial ? '' : randomPassword()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const self = initial?.id === me.id;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (initial) {
        await api(`/api/users/${initial.id}`, { method: 'PATCH', body: { username, displayName, role, active } });
        onSaved(`บันทึกผู้ใช้ ${username} แล้ว`);
      } else {
        await api('/api/users', { body: { username, displayName, role, password } });
        onSaved(`เพิ่มผู้ใช้ ${username} แล้ว อย่าลืมแจ้งรหัสผ่านชั่วคราว`);
      }
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={initial ? `แก้ไขผู้ใช้ ${initial.username}` : 'เพิ่มผู้ใช้ใหม่'} onClose={onClose}>
      <form className="card card-b stack" onSubmit={save}>
        <div className="form-grid">
          <div className="field"><label htmlFor="u-name">ชื่อผู้ใช้ (ใช้ login)</label><input id="u-name" className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น somchai" required /></div>
          <div className="field"><label htmlFor="u-display">ชื่อที่แสดง</label><input id="u-display" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="เช่น สมชาย (คลังสินค้า)" /></div>
          <div className="field">
            <label htmlFor="u-role">สิทธิ์</label>
            <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">{ROLE_LABEL.staff}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </select>
          </div>
          {initial && (
            <label className="row" style={{ fontSize: 14, alignSelf: 'end', paddingBottom: 8 }}>
              <input id="u-active" type="checkbox" checked={active} disabled={self} onChange={(e) => setActive(e.target.checked)} />เปิดใช้งาน
            </label>
          )}
        </div>
        {self && <p className="muted" style={{ margin: 0, fontSize: 13 }}>ปิดการใช้งานบัญชีของตัวเองไม่ได้</p>}
        {!initial && (
          <div className="field">
            <label htmlFor="u-pass">รหัสผ่านชั่วคราว</label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <input id="u-pass" className="input mono" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <button type="button" className="btn sm" onClick={() => setPassword(randomPassword())}>สุ่มใหม่</button>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>จดหรือคัดลอกไว้แจ้งผู้ใช้ ผู้ใช้จะต้องเปลี่ยนเป็นรหัสของตัวเองเมื่อเข้าครั้งแรก</span>
          </div>
        )}
        {err && <div className="note warn" role="alert">{err}</div>}
        <div className="row"><span className="spacer" /><button type="button" className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" disabled={busy}>{busy ? 'กำลังบันทึก…' : initial ? 'บันทึก' : 'เพิ่มผู้ใช้'}</button></div>
      </form>
    </Drawer>
  );
}

function ResetPassword({ u, onClose }: { u: User; onClose: () => void }) {
  const { toast } = useApp();
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api(`/api/users/${u.id}/reset-password`, { body: { newPassword: password } });
      setDone(true);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer title={`รีเซ็ตรหัสผ่าน ${u.username}`} onClose={onClose}>
      {done ? (
        <div className="card card-b stack">
          <div className="note">ตั้งรหัสผ่านชั่วคราวให้ <b>{u.username}</b> แล้ว ผู้ใช้ถูกออกจากระบบทุกเครื่อง และต้องตั้งรหัสใหม่เมื่อเข้าครั้งถัดไป</div>
          <div className="field">
            <label htmlFor="rp-show">รหัสผ่านชั่วคราว</label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <input id="rp-show" className="input mono" readOnly value={password} onFocus={(e) => e.target.select()} />
              <button className="btn sm" onClick={() => copyText(password, (ok) => toast(ok ? 'คัดลอกรหัสผ่านแล้ว' : 'คัดลอกไม่ได้ ให้เลือกข้อความแทน'))}><Icon name="copy" size={14} />คัดลอก</button>
            </div>
          </div>
          <div className="row"><span className="spacer" /><button className="btn pri" onClick={onClose}>เสร็จสิ้น</button></div>
        </div>
      ) : (
        <form className="card card-b stack" onSubmit={submit}>
          <p style={{ margin: 0 }}>ตั้งรหัสผ่านชั่วคราวใหม่ให้ <b>{u.displayName || u.username}</b></p>
          <div className="field">
            <label htmlFor="rp-pass">รหัสผ่านชั่วคราว (อย่างน้อย 8 ตัว)</label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <input id="rp-pass" className="input mono" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <button type="button" className="btn sm" onClick={() => setPassword(randomPassword())}>สุ่มใหม่</button>
            </div>
          </div>
          {err && <div className="note warn" role="alert">{err}</div>}
          <div className="row"><span className="spacer" /><button type="button" className="btn" onClick={onClose}>ยกเลิก</button><button className="btn pri" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'รีเซ็ตรหัสผ่าน'}</button></div>
        </form>
      )}
    </Drawer>
  );
}
