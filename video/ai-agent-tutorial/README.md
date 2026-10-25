# วิดีโอสอนใช้ AI Agent (แนวตั้ง 30 นาที)

ตัวสร้างวิดีโอ Motion Graphics แนวตั้ง 1080x1920 @30fps ความยาว 30:00 นาที
พร้อมเสียงพากย์ไทย ซับไตเติลเหลืองสลับขาว เพลงประกอบ เสียงเอฟเฟกต์ และวิดีโอ Insert 8 คลิป

## โครงสร้าง
| ไฟล์ | หน้าที่ |
|---|---|
| `script.txt` | สคริปต์บทพูด (`#` บท, `##` หัวข้อย่อย, `@` คลิป Insert, `-` บรรทัดพากย์ = 1 ซับ) |
| `parse.py` | อ่านสคริปต์ + แปลงคำอังกฤษ/ตัวเลขเป็นคำอ่านไทยสำหรับ TTS |
| `tts.py` | สร้างเสียงพากย์ไทยแบบออฟไลน์ (sherpa-onnx + โมเดล `vits-mms-tha`) |
| `timeline.py` | คำนวณไทม์ไลน์ให้ยาวพอดี 30 นาที |
| `audio.py` | สังเคราะห์เพลง (lo-fi 92 BPM) + SFX + มิกซ์ ducking ใต้เสียงพากย์ |
| `gfx.py`, `render.py`, `inserts.py` | เรนเดอร์ภาพเคลื่อนไหว (บทเรียน + Insert 8 ฉาก) |
| `assemble.py` | รวมไฟล์, ใส่เสียง, ส่งออก SRT และไฟล์ Insert แยก |

## วิธีสร้างใหม่
ต้องมี `ffmpeg`, Python 3 และ `pip install sherpa-onnx pythainlp scipy pillow numpy`
วางโมเดล `vits-mms-tha` (จาก k2-fsa/sherpa-onnx releases `tts-models`) ไว้ที่ `../models/`
และฟอนต์ Kanit / JetBrains Mono (Google Fonts) ไว้ที่ `../fonts/`

```bash
python3 tts.py 0.92      # เสียงพากย์
python3 timeline.py      # ไทม์ไลน์ 30:00
python3 audio.py         # เพลง + SFX + มิกซ์
python3 render.py all 4  # เรนเดอร์ภาพ (4 โปรเซส)
python3 assemble.py      # ไฟล์ผลลัพธ์ใน out/
```
