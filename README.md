# OmniRoute Usage — ปลั๊กอิน Hermes Desktop

🌏 README in [English](README.en.md)

ดู usage summary, provider limits ต่อ connection, และ recent call logs ของ [OmniRoute](https://github.com/danny-avila/OmniRoute) ใน Hermes Desktop รองรับสองภาษา (EN / TH) และเป็นแบบ Read-only

## ฟีเจอร์

- **Status bar chip:** แสดง requests / cost สรุปย้อนหลัง 1 วัน (poll ทุก 30 วิ)
- **Chip popup:** สรุป 1d + tokens + ปุ่มเปิดหน้าเต็มและปุ่มรีเฟรช
- **สลับภาษา UI:** ปุ่ม `[ Auto | EN | TH ]` ด้านบนขวา สลับภาษาอังกฤษ/ไทยได้ทันที
- **หน้าเต็ม `/omniroute`:**
  - Hero summary (Requests, Tokens, Cost, Success rate, Latency)
  - Provider Limits Table (Rate limits, remaining %, reset time, upstream sync)
  - Recent Call Logs (20 รายการล่าสุด พร้อมสถานะ, latency, tokens)
- **คำสั่ง ⌘K Palette:**
  - `OmniRoute: Open Usage Page`
  - `OmniRoute: Refresh Data`
  - `OmniRoute: Clear accessToken`

## ติดตั้ง

**Install from Git** (Settings → Plugins) แล้วใส่ repo นี้: `Manchinn/hermes-omniroute`
หรือกดลิงก์:

```
hermes://plugin/install?repo=Manchinn/hermes-omniroute&enable=1
```

(ลิงก์เปิด dialog ให้กดยืนยันเอง ไม่ติดตั้งอัตโนมัติ)

หลังติดตั้ง ไฟล์จะอยู่ที่ `desktop-plugins/hermes-omniroute/plugin.js`
— ชื่อโฟลเดอร์ใช้ชื่อ repo ส่วน `id` ข้างในคือ `omniroute-usage`
จากนั้นเปิดในแอป: Settings → Plugins → เปิด **OmniRoute Usage** (มาแบบ opt-in: `defaultEnabled: false`)

> token ไม่ได้อยู่ในโฟลเดอร์นี้ — เก็บใน storage ของแอปตาม `id`
> ลบ/ลงใหม่แล้ว token เดิมยังอยู่

## ใช้งาน

1. เปิดหน้า **OmniRoute** จาก sidebar หรือ Palette (⌘K)
2. สลับภาษาอังกฤษ/ไทยได้ทันทีตามต้องการ
3. ใส่ **accessToken** (Management Bearer token จาก OmniRoute `config.json`)
4. ข้อมูลจะดึงอัตโนมัติจาก `http://localhost:20128`
