# stock-sahamit

ระบบสต๊อกสหมิตร: สต๊อกสินค้าทองแดง/เศษโลหะ (โค้ดอยู่ในโฟลเดอร์ `stock/`)

- เว็บ: https://stock-sahamit.pages.dev/
- Repo: https://github.com/Kaopupis/stock-sahamit

ข้อมูลอ้างอิงจาก Google Sheet
[บัญชีรับส่งสินค้า สหมิตร เริ่มเดือนมิถุนายน 2569](https://docs.google.com/spreadsheets/d/1LG4EwAsb3N8Z_KCecDgZwyrWBk9gm-m3v-U7NgzppEo/edit)
(ใบรับ 152 ใบ, B06-01 ถึง B10-06)

```
npm install
npm run build         # ได้ไฟล์ระบบสต๊อกใน dist/ (ใช้กับ Cloudflare Pages)
```

เมนู
- **แดชบอร์ด**: คงเหลือรวม รับเข้ารายเดือน ใบรับล่าสุด ผู้ขายหลัก
- **สต๊อกคงเหลือ**: ยอดแยกเกรด ต้นทุนเฉลี่ย มูลค่า และปรับยอดตามการตรวจนับ
- **รับสินค้าเข้า**: ใบรับทั้งหมด (ตาชั่งรถ กระสอบ ราคา VAT) สร้างใบใหม่ และใส่ราคาให้ใบที่รอราคา
- **พนักงาน**: ข้อมูลพื้นฐานและรูปพนักงาน (รูปเก็บใน Cloudflare R2) ผู้ดูแลเพิ่ม/แก้ไข/อัปโหลดรูปได้ พนักงานดูได้อย่างเดียว
- **จ่ายออก / ขาย** และ **คัดแยกเกรด**: ตัดยอดหรือย้ายน้ำหนักระหว่างเกรด
- **เกรดสินค้า**: บัตรสต๊อก กราฟราคา ผู้ขายของแต่ละเกรด
- **ผู้ขาย / คู่ค้า**: ยอดรับ ยอดซื้อ เกรดที่ส่ง
- **ความสัมพันธ์ข้อมูล**: ผังข้อมูล และตารางไขว้ผู้ขาย × เกรด (กดเพื่อดูใบรับที่เกี่ยวข้อง)
- **รายงาน**: สรุปรายเดือน ราคาเฉลี่ย ผลต่างตาชั่งรถกับกระสอบ ส่งออก CSV
- **ข้อมูลและการสำรอง**: สำรอง/นำเข้าข้อมูลที่บันทึกเพิ่ม

ข้อมูลจากชีตอยู่ใน `stock/data/sheet-receipts.json` (สร้างด้วย `stock/data/parse_sheet.py`)
ส่วนที่ผู้ใช้บันทึกเพิ่มเก็บใน localStorage ของเบราว์เซอร์

## Login และผู้ใช้งาน (Cloudflare D1)

ทุกหน้าและข้อมูลต้อง login ก่อน ผู้ใช้เก็บในฐานข้อมูล D1 ชื่อ `stock-sahamit-db`
(รหัสผ่านเข้ารหัสแบบ PBKDF2-SHA256, session เป็น cookie HttpOnly อายุ 12 ชั่วโมง, ใส่รหัสผิด 5 ครั้งล็อก 15 นาที)

- **ผู้ดูแลระบบ** เพิ่มผู้ใช้ แก้ไขชื่อ/สิทธิ์ ปิดการใช้งาน และรีเซ็ตรหัสผ่าน (เมนู ระบบ → ผู้ใช้งาน)
- **พนักงาน** ใช้ระบบสต๊อกได้ทุกเมนู และเปลี่ยนรหัสผ่านของตัวเองได้
- ผู้ใช้ใหม่หรือผู้ที่ถูกรีเซ็ต ต้องตั้งรหัสผ่านใหม่เองเมื่อเข้าครั้งแรก

| ส่วน | ไฟล์ |
| --- | --- |
| API (Pages Functions) | `functions/api/**` |
| ตรรกะ login / session / รหัสผ่าน | `server/auth.ts` |
| ข้อมูลพนักงานและรูป | `functions/api/employees/**`, `server/employees.ts` |
| ตาราง D1 | `migrations/*.sql` |
| ตั้งค่า Cloudflare | `wrangler.toml` |

### Deploy บน Cloudflare Pages

`wrangler.toml` เป็นตัวกำหนดการตั้งค่า Pages (binding D1 และตัวแปร) แทนหน้า dashboard

| ค่า | ตั้งที่ | ความหมาย |
| --- | --- | --- |
| Build command `npm run build` · Output `dist` | dashboard / `wrangler.toml` | สร้างเว็บระบบสต๊อก |
| `DB` → `stock-sahamit-db` | `wrangler.toml` | ฐานข้อมูลผู้ใช้และพนักงาน |
| `PHOTOS` → R2 `stock-sahamit-photos` | `wrangler.toml` | รูปพนักงาน (ย่อเหลือไม่เกิน 800px ก่อนอัปโหลด, JPG/PNG/WEBP ไม่เกิน 5 MB) |
| `ADMIN_USERNAME` | `wrangler.toml` (ค่าเริ่มต้น `admin`) | ชื่อผู้ดูแลคนแรก |
| `SESSION_TTL_HOURS` | `wrangler.toml` (ค่าเริ่มต้น `12`) | อายุการ login |
| `ADMIN_PASSWORD` | **Secret** ใน dashboard (Settings → Variables and Secrets) | รหัสผ่านผู้ดูแลคนแรก อย่างน้อย 8 ตัว |

ผู้ดูแลคนแรกถูกสร้างจาก `ADMIN_USERNAME` / `ADMIN_PASSWORD` ตอนมีคน login ครั้งแรกและยังไม่มีผู้ใช้ในฐานข้อมูล
และต้องเปลี่ยนรหัสผ่านทันที หลังจากนั้นค่า `ADMIN_PASSWORD` ไม่ถูกใช้อีก

ตั้ง secret ผ่านคำสั่งก็ได้: `npx wrangler pages secret put ADMIN_PASSWORD --project-name stock-sahamit`
เมื่อเพิ่ม migration ใหม่: `npm run db:migrate:remote`

### ทดสอบในเครื่อง

```
cp .dev.vars.example .dev.vars   # ใส่ ADMIN_PASSWORD สำหรับทดสอบ
npm run db:migrate:local
npm run dev:full                 # http://localhost:8788 (มี API และ D1 จำลอง)
npm run stock:dev                # แก้หน้าจอแบบ hot reload ที่ :3100 (ส่ง /api ไปที่ :8788)
npm run typecheck
```

---

## แอป FUE-N (ฟื้น) เดิม

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ouVe3JvtkA9-vGbbUZ4gM-FmTnzRb_O8

### Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev` (build: `npm run build:fue-n`)
