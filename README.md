# stock-sahamit

ระบบสต๊อกสหมิตร: สต๊อกสินค้าทองแดง/เศษโลหะ (โค้ดอยู่ในโฟลเดอร์ `stock/`)

- เว็บ: https://stock-sahamit.pages.dev/
- Repo: https://github.com/Kaopupis/stock-sahamit

ข้อมูลอ้างอิงจาก Google Sheet
[บัญชีรับส่งสินค้า สหมิตร เริ่มเดือนมิถุนายน 2569](https://docs.google.com/spreadsheets/d/1LG4EwAsb3N8Z_KCecDgZwyrWBk9gm-m3v-U7NgzppEo/edit)
(ใบรับ 152 ใบ, B06-01 ถึง B10-06)

```
npm install
npm run stock:dev     # เปิดที่ http://localhost:3100
npm run build         # ได้ไฟล์ระบบสต๊อกใน dist/ (ใช้กับ Cloudflare Pages)
```

เมนู
- **แดชบอร์ด**: คงเหลือรวม รับเข้ารายเดือน ใบรับล่าสุด ผู้ขายหลัก
- **สต๊อกคงเหลือ**: ยอดแยกเกรด ต้นทุนเฉลี่ย มูลค่า และปรับยอดตามการตรวจนับ
- **รับสินค้าเข้า**: ใบรับทั้งหมด (ตาชั่งรถ กระสอบ ราคา VAT) สร้างใบใหม่ และใส่ราคาให้ใบที่รอราคา
- **จ่ายออก / ขาย** และ **คัดแยกเกรด**: ตัดยอดหรือย้ายน้ำหนักระหว่างเกรด
- **เกรดสินค้า**: บัตรสต๊อก กราฟราคา ผู้ขายของแต่ละเกรด
- **ผู้ขาย / คู่ค้า**: ยอดรับ ยอดซื้อ เกรดที่ส่ง
- **ความสัมพันธ์ข้อมูล**: ผังข้อมูล และตารางไขว้ผู้ขาย × เกรด (กดเพื่อดูใบรับที่เกี่ยวข้อง)
- **รายงาน**: สรุปรายเดือน ราคาเฉลี่ย ผลต่างตาชั่งรถกับกระสอบ ส่งออก CSV
- **ข้อมูลและการสำรอง**: สำรอง/นำเข้าข้อมูลที่บันทึกเพิ่ม

ข้อมูลจากชีตอยู่ใน `stock/data/sheet-receipts.json` (สร้างด้วย `stock/data/parse_sheet.py`)
ส่วนที่ผู้ใช้บันทึกเพิ่มเก็บใน localStorage ของเบราว์เซอร์

Cloudflare Pages: Build command `npm run build` · Build output directory `dist`

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
