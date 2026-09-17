# OmniRoute Usage — ปลั๊กอิน Hermes Desktop

🌏 README in [English](README.en.md)

ดู usage summary, quota ต่อ connection, และ recent call logs ของ [OmniRoute](https://github.com/danny-avila/OmniRoute) ใน Hermes Desktop หน้า UI ภาษาไทย (Read-only)

## ฟีเจอร์

- **Status bar chip:** แสดง requests / cost สรุปย้อนหลัง 1 วัน (poll ทุก 30 วิ)
- **Chip popup:** สรุป 1d + tokens + ปุ่มเปิดหน้าเต็มและปุ่มรีเฟรช
- **หน้าเต็ม `/omniroute`:**
  - Hero summary (Requests, Tokens, Cost)
  - Connection Quota Table (Rate limits, remaining, reset time)
  - Recent Call Logs (20 รายการล่าสุด พร้อมสถานะ, latency, tokens)
- **คำสั่ง ⌘K Palette:**
  - `OmniRoute: เปิดหน้า Usage`
  - `OmniRoute: รีเฟรชข้อมูล`
  - `OmniRoute: ลบ accessToken`

## ติดตั้ง

**Install from Git** (Settings → Plugins) แล้วใส่ repo นี้: `Manchinn/hermes-omniroute`
หรือกดลิงก์:

```
hermes://plugin/install?repo=Manchinn/hermes-omniroute&enable=1
```

(ลิงก์เปิด dialog ให้กดยืนยันเอง ไม่ติดตั้งอัตโนมัติ)

หลังติดตั้ง ไฟล์จะอยู่ที่ `desktop-plugins/hermes-omniroute/plugin.js`
— ชื่อโฟลเดอร์ใช้ชื่อ repo ส่วน `id` ข้างในคือ `omniroute-usage`
จากนั้นเปิดในแอป: Settings → Plugins → เปิด **OmniRoute** (มาแบบ opt-in: `defaultEnabled: false`)

> token ไม่ได้อยู่ในโฟลเดอร์นี้ — เก็บใน storage ของแอปตาม `id`
> ลบ/ลงใหม่แล้ว token เดิมยังอยู่

## ใช้งาน

1. เปิดหน้า **OmniRoute** จาก sidebar หรือ Palette (⌘K)
2. ใส่ **accessToken** (Management Bearer token จาก OmniRoute `config.json`)
3. ข้อมูลจะดึงอัตโนมัติจาก `http://localhost:20128`

## ความเป็นส่วนตัวและความปลอดภัย

- **Local-first:** ยิงตรงหา `http://localhost:20128` ในเครื่องผู้ใช้เท่านั้น ไม่มี telemetry หรือส่งข้อมูลออกภายนอก
- **Read-only:** อ่านข้อมูลสถิติเท่านั้น ไม่เขียนหรือแก้ไข configuration/API keys ใดๆ ของ OmniRoute
- **Token Isolation:** Token เก็บใน storage ภายในของ Hermes Desktop (`ctx.storage`) ไม่ถูกบันทึกหรือแนบไปกับ repo

## ไฟล์ใน Repo

| File | คืออะไร |
| --- | --- |
| `plugin.js` | ตัว plugin (ไฟล์เดียว ไม่มี build step) |
| `README.md` | เอกสารภาษาไทย |
| `README.en.md` | English documentation |
| `LICENSE` | MIT License |

## SDK Reference

สร้างด้วย `@hermes/plugin-sdk` (`react`, `react/jsx-runtime`)
อ้างอิง: https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk

MIT License.
