import React, { useState } from 'react';
import { Card, ConfirmButton, Icon, PageHead, useApp } from '../components/ui';
import { SHEET_URL } from '../lib/data';
import { EMPTY, isLocalData } from '../lib/store';
import { copyText } from './Reports';

export default function Settings() {
  const { local, update, toast, model } = useApp();
  const [text, setText] = useState('');
  const json = JSON.stringify(local, null, 1);
  const counts = [
    ['ใบรับที่บันทึกใหม่', local.receipts.length],
    ['ใบรับที่ใส่ราคาในระบบ', Object.keys(local.priceOverrides).length],
    ['จ่ายออก / ขาย', local.issues.length],
    ['คัดแยกเกรด', local.sorts.length],
    ['ปรับยอด', local.adjustments.length],
  ] as const;

  const restore = (raw: string) => {
    try {
      const d = JSON.parse(raw);
      if (!isLocalData(d)) throw new Error();
      update(() => ({ ...EMPTY, ...d }));
      setText('');
      toast('นำเข้าข้อมูลสำรองแล้ว');
    } catch {
      toast('ไฟล์หรือข้อความไม่ใช่ข้อมูลสำรองของระบบนี้');
    }
  };

  return (
    <>
      <PageHead crumb="ตั้งค่า" title="ข้อมูลและการสำรอง" desc="ข้อมูลจากชีตอยู่ในระบบเสมอ ส่วนที่บันทึกเพิ่มเก็บไว้ในเบราว์เซอร์เครื่องนี้" />
      <div className="grid g-2e">
        <Card title="ข้อมูลที่บันทึกในเครื่องนี้">
          <table className="tbl">
            <tbody>{counts.map(([k, v]) => <tr key={k}><td>{k}</td><td className="r num">{v}</td></tr>)}</tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => copyText(json, (ok) => toast(ok ? 'คัดลอกข้อมูลสำรองแล้ว' : 'คัดลอกไม่ได้ ให้เลือกข้อความด้านล่างแทน'))}><Icon name="copy" size={16} />คัดลอกข้อมูลสำรอง</button>
            <span className="spacer" />
            <ConfirmButton label="ล้างข้อมูลที่บันทึก" onConfirm={() => { update(() => EMPTY); toast('ล้างข้อมูลที่บันทึกแล้ว'); }} />
          </div>
        </Card>
        <Card title="นำเข้าข้อมูลสำรอง" sub="วางข้อความสำรอง หรือเลือกไฟล์ .json">
          <div className="stack">
            <textarea id="restore-text" className="input num" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"receipts":[], ...}' />
            <div className="row">
              <input id="restore-file" type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(restore); }} />
              <span className="spacer" />
              <button className="btn pri" disabled={!text.trim()} onClick={() => restore(text)}>นำเข้า</button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>การนำเข้าจะแทนที่ข้อมูลที่บันทึกในเครื่องนี้ทั้งหมด</p>
          </div>
        </Card>
      </div>
      <Card title="แหล่งข้อมูลต้นฉบับ">
        <div className="stack">
          <p style={{ margin: 0 }}>บัญชีรับส่งสินค้า สหมิตร เริ่มเดือนมิถุนายน 2569 · ใบรับ {model.receipts.filter((r) => r.source === 'sheet').length} ใบ</p>
          <div className="row"><a className="btn" href={SHEET_URL} target="_blank" rel="noreferrer"><Icon name="ext" size={16} />เปิด Google Sheet</a></div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>อัปเดตข้อมูลจากชีต: รันสคริปต์ <code>stock/data/parse_sheet.py</code> กับข้อความที่ส่งออกจากชีต แล้ว build ใหม่</p>
        </div>
      </Card>
    </>
  );
}
