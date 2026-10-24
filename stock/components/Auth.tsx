import React, { useState } from 'react';
import { ApiError, api, type User } from '../lib/api';
import { Icon } from './ui';

function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="brand auth-brand">
          <div className="brand-mark"><Icon name="stock" size={22} /></div>
          <div><b>สหมิตร สต๊อก</b><small>รับซื้อทองแดง · เศษโลหะ</small></div>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: '1.3rem' }}>{title}</h1>
          {sub && <p className="muted" style={{ margin: 0 }}>{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin, notice }: { onLogin: (u: User) => void; notice?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(notice ?? '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ user: User }>('/api/auth/login', { body: { username, password } });
      onLogin(r.user);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'เข้าสู่ระบบไม่สำเร็จ');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="เข้าสู่ระบบ" sub="ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบให้ไว้">
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="login-user">ชื่อผู้ใช้</label><input id="login-user" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
        <div className="field">
          <label htmlFor="login-pass">รหัสผ่าน</label>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <input id="login-pass" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="btn sm" onClick={() => setShow((s) => !s)}>{show ? 'ซ่อน' : 'แสดง'}</button>
          </div>
        </div>
        {err && <div className="note warn" role="alert">{err}</div>}
        <button className="btn pri" style={{ justifyContent: 'center' }} disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบให้รีเซ็ตรหัสผ่าน</p>
      </form>
    </AuthShell>
  );
}

export function ChangePasswordForm({ onDone, onCancel, forced }: { onDone: (u: User) => void; onCancel?: () => void; forced?: boolean }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setErr('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (next !== again) return setErr('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ user: User }>('/api/auth/password', { body: { currentPassword: cur, newPassword: next } });
      onDone(r.user);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack" onSubmit={submit}>
      {forced && <div className="note">รหัสผ่านนี้เป็นรหัสชั่วคราว กรุณาตั้งรหัสผ่านใหม่ของคุณก่อนเริ่มใช้งาน</div>}
      <input type="text" autoComplete="username" hidden readOnly />
      <div className="field"><label htmlFor="cp-cur">{forced ? 'รหัสผ่านชั่วคราว' : 'รหัสผ่านปัจจุบัน'}</label><input id="cp-cur" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
      <div className="field"><label htmlFor="cp-new">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label><input id="cp-new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
      <div className="field"><label htmlFor="cp-again">ยืนยันรหัสผ่านใหม่</label><input id="cp-again" className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></div>
      {err && <div className="note warn" role="alert">{err}</div>}
      <div className="row">
        <span className="spacer" />
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{forced ? 'ออกจากระบบ' : 'ยกเลิก'}</button>}
        <button className="btn pri" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}</button>
      </div>
    </form>
  );
}

export function ForcedPasswordScreen({ user, onDone, onLogout }: { user: User; onDone: (u: User) => void; onLogout: () => void }) {
  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" sub={`สวัสดี ${user.displayName || user.username}`}>
      <ChangePasswordForm forced onDone={onDone} onCancel={onLogout} />
    </AuthShell>
  );
}
