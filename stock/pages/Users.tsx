import React, { useCallback, useEffect, useState } from 'react';
import { Card, Drawer, Empty, Icon, Note, PageHead, Pill, useApp } from '../components/ui';
import { ApiError, ROLE_LABEL, type Role, type User, api, randomPassword } from '../lib/api';
import { copyText } from './Reports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        <Note tone="warn">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Note>
      </>
    );
  }

  return (
    <>
      <PageHead
        crumb="ผู้ใช้งาน"
        title="ผู้ใช้งานระบบ"
        desc="เพิ่มผู้ใช้ แก้ไขสิทธิ์ ปิดการใช้งาน และรีเซ็ตรหัสผ่าน ข้อมูลเก็บในฐานข้อมูล D1 บน Cloudflare"
        actions={<Button onClick={() => setEdit('new')}><Icon name="plus" size={16} />เพิ่มผู้ใช้</Button>}
      />
      {err && <Note tone="warn">{err}</Note>}
      <Card pad={false}>
        <div>
          <Table>
            <TableHeader><TableRow><TableHead>ชื่อผู้ใช้</TableHead><TableHead>ชื่อที่แสดง</TableHead><TableHead>สิทธิ์</TableHead><TableHead>สถานะ</TableHead><TableHead>เข้าใช้ล่าสุด</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="num"><b>{u.username}</b>{u.id === me.id && <Badge variant="info" style={{ marginLeft: 6 }}>คุณ</Badge>}</TableCell>
                  <TableCell>{u.displayName || <span className="muted">–</span>}</TableCell>
                  <TableCell><Pill tone={u.role === 'admin' ? 'ok' : 'plain'}>{ROLE_LABEL[u.role]}</Pill></TableCell>
                  <TableCell>
                    {!u.active ? <Badge variant="secondary" className="bg-destructive/12 text-destructive">ปิดการใช้งาน</Badge> : u.mustChangePassword ? <Badge variant="warning">รอเปลี่ยนรหัสผ่าน</Badge> : <Badge variant="success">ใช้งานได้</Badge>}
                  </TableCell>
                  <TableCell className="muted">{when(u.lastLoginAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                      <Button variant="outline" size="sm" onClick={() => setEdit(u)}>แก้ไข</Button>
                      <Button variant="outline" size="sm" onClick={() => setReset(u)}>รีเซ็ตรหัสผ่าน</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users === null && !err && <Empty>กำลังโหลด…</Empty>}
        </div>
      </Card>
      <Note>
        ผู้ใช้ใหม่และผู้ที่ถูกรีเซ็ตรหัสผ่าน ต้องตั้งรหัสผ่านใหม่เองเมื่อเข้าระบบครั้งถัดไป · <b>ผู้ดูแลระบบ</b> จัดการผู้ใช้ได้ · <b>พนักงาน</b> ใช้งานระบบสต๊อกได้ทุกเมนู ยกเว้นหน้านี้
      </Note>
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
      <form className="panel stack" onSubmit={save}>
        <div className="form-grid">
          <div className="field"><Label htmlFor="u-name">ชื่อผู้ใช้ (ใช้ login)</Label><Input id="u-name"  value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น somchai" required /></div>
          <div className="field"><Label htmlFor="u-display">ชื่อที่แสดง</Label><Input id="u-display"  value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="เช่น สมชาย (คลังสินค้า)" /></div>
          <div className="field">
            <Label htmlFor="u-role">สิทธิ์</Label>
            <NativeSelect id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">{ROLE_LABEL.staff}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </NativeSelect>
          </div>
          {initial && (
            <Label htmlFor="u-active" className="self-end pb-2.5 font-normal">
              <Checkbox id="u-active" checked={active} disabled={self} onCheckedChange={(v) => setActive(v === true)} />เปิดใช้งาน
            </Label>
          )}
        </div>
        {self && <p className="muted" style={{ margin: 0, fontSize: 13 }}>ปิดการใช้งานบัญชีของตัวเองไม่ได้</p>}
        {!initial && (
          <div className="field">
            <Label htmlFor="u-pass">รหัสผ่านชั่วคราว</Label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Input id="u-pass" className="font-mono" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>สุ่มใหม่</Button>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>จดหรือคัดลอกไว้แจ้งผู้ใช้ ผู้ใช้จะต้องเปลี่ยนเป็นรหัสของตัวเองเมื่อเข้าครั้งแรก</span>
          </div>
        )}
        {err && <Note tone="warn">{err}</Note>}
        <div className="row"><span className="spacer" /><Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button><Button disabled={busy}>{busy ? 'กำลังบันทึก…' : initial ? 'บันทึก' : 'เพิ่มผู้ใช้'}</Button></div>
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
        <div className="panel stack">
          <Note>ตั้งรหัสผ่านชั่วคราวให้ <b>{u.username}</b> แล้ว ผู้ใช้ถูกออกจากระบบทุกเครื่อง และต้องตั้งรหัสใหม่เมื่อเข้าครั้งถัดไป</Note>
          <div className="field">
            <Label htmlFor="rp-show">รหัสผ่านชั่วคราว</Label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Input id="rp-show" className="font-mono" readOnly value={password} onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="sm" onClick={() => copyText(password, (ok) => toast(ok ? 'คัดลอกรหัสผ่านแล้ว' : 'คัดลอกไม่ได้ ให้เลือกข้อความแทน'))}><Icon name="copy" size={14} />คัดลอก</Button>
            </div>
          </div>
          <div className="row"><span className="spacer" /><Button onClick={onClose}>เสร็จสิ้น</Button></div>
        </div>
      ) : (
        <form className="panel stack" onSubmit={submit}>
          <p style={{ margin: 0 }}>ตั้งรหัสผ่านชั่วคราวใหม่ให้ <b>{u.displayName || u.username}</b></p>
          <div className="field">
            <Label htmlFor="rp-pass">รหัสผ่านชั่วคราว (อย่างน้อย 8 ตัว)</Label>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Input id="rp-pass" className="font-mono" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>สุ่มใหม่</Button>
            </div>
          </div>
          {err && <Note tone="warn">{err}</Note>}
          <div className="row"><span className="spacer" /><Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button><Button disabled={busy}>{busy ? 'กำลังบันทึก…' : 'รีเซ็ตรหัสผ่าน'}</Button></div>
        </form>
      )}
    </Drawer>
  );
}
