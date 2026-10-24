import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ForcedPasswordScreen, LoginScreen } from './components/Auth';
import { ApiError, api, type User } from './lib/api';
import { type RawReceipt, parseSheetReceipts } from './lib/data';
import type { Receipt } from './lib/types';
import { Toaster } from '@/components/ui/sonner';
import './styles.css';
import { Button } from '@/components/ui/button';
import { Note } from './components/ui';

type State =
  | { s: 'loading' }
  | { s: 'login'; notice?: string }
  | { s: 'error'; message: string }
  | { s: 'ready'; user: User; sheet: Receipt[] | null };

// ตรวจ session ก่อน แล้วจึงโหลดข้อมูลใบรับ (ข้อมูลไม่ได้ฝังอยู่ในหน้าเว็บ)
function Root() {
  const [st, setSt] = useState<State>({ s: 'loading' });

  const loadSheet = useCallback(async (user: User) => {
    setSt({ s: 'ready', user, sheet: null });
    if (user.mustChangePassword) return;
    try {
      const raw = await api<RawReceipt[]>('/api/data/receipts');
      setSt({ s: 'ready', user, sheet: parseSheetReceipts(raw) });
    } catch (x) {
      if (x instanceof ApiError && x.status === 401) setSt({ s: 'login', notice: 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง' });
      else setSt({ s: 'error', message: x instanceof Error ? x.message : 'โหลดข้อมูลไม่สำเร็จ' });
    }
  }, []);

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => loadSheet(r.user))
      .catch((x) => {
        if (x instanceof ApiError && (x.status === 401 || x.status === 403)) setSt({ s: 'login' });
        else setSt({ s: 'error', message: x instanceof Error ? x.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
      });
  }, [loadSheet]);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSt({ s: 'login', notice: 'ออกจากระบบแล้ว' });
  }, []);

  if (st.s === 'loading') return <div className="auth-wrap"><p className="muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p></div>;
  if (st.s === 'error')
    return (
      <div className="auth-wrap">
        <div className="auth-card stack rounded-xl border bg-card p-6 shadow-sm">
          <h1 style={{ fontSize: '1.2rem' }}>เปิดระบบไม่สำเร็จ</h1>
          <Note tone="warn">{st.message}</Note>
          <Button onClick={() => location.reload()}>ลองอีกครั้ง</Button>
        </div>
      </div>
    );
  if (st.s === 'login') return <LoginScreen notice={st.notice} onLogin={loadSheet} />;
  if (st.user.mustChangePassword) return <ForcedPasswordScreen user={st.user} onDone={loadSheet} onLogout={logout} />;
  if (!st.sheet) return <div className="auth-wrap"><p className="muted">กำลังโหลดข้อมูลสต๊อก…</p></div>;
  return <App user={st.user} sheet={st.sheet} onLogout={logout} onUserChange={(u) => setSt({ ...st, user: u })} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
    <Toaster position="bottom-center" richColors />
  </React.StrictMode>,
);
