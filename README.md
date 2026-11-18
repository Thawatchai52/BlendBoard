# BlendBoard — Content Calendar (Kudsan · Bellinee's)

ระบบจัดการตารางคอนเทนต์รายเดือนของ 2 แบรนด์ (KS ส้ม / BL น้ำตาล) แทนไฟล์ Excel แยกแบรนด์/เดือน
ปฏิทิน + Kanban ลากวาง, บรีฟ, อัปโหลดไฟล์/ส่งลิงก์งาน, Workflow Draft → รอตรวจ → ให้แก้ → Approved → Posted
และสถิติคลิป TikTok อัตโนมัติ (ER + ป้าย 🔥 แมสแตก!)

**▶ ลองใช้งานเว็บต้นแบบ: https://thawatchai52.github.io/BlendBoard/** (เปิดแล้วเข้าได้เลย ข้อมูลเก็บในเบราว์เซอร์ของคุณ)

## มีอะไรใน repo นี้

| โฟลเดอร์ | คืออะไร |
|---|---|
| `prototype/index.html` | **เว็บต้นแบบไฟล์เดียว** เปิดในเบราว์เซอร์ได้เลย ข้อมูลเก็บใน localStorage ไม่มีเซิร์ฟเวอร์ ใช้ลองหน้าตา/การใช้งาน |
| `app/ components/ lib/ hooks/ middleware.ts` | **โค้ด Next.js 15 (App Router)** ของระบบจริง: หน้า Landing 2 ประตู, สิทธิ์ Viewer/Admin, Dashboard, TikTok Analytics |
| `prisma/schema.prisma` | ตารางงาน/แบรนด์ + TikTok (รวมไฟล์เดียวแล้ว) |
| `docs/` | สถาปัตยกรรม (`ARCHITECTURE.md`) และการออกแบบสิทธิ์ (`RBAC.md`) |
| `legacy-rbac/` | RBAC รุ่นเก่าแบบมีบัญชีรายคน เก็บไว้อ้างอิง **ไม่ได้ใช้แล้ว** ถูกแทนที่ด้วย 2 ประตู + cookie |
| `tests/` | เทสต์สูตร ER / ตัวตรวจลิงก์ TikTok |

## รันโปรเจกต์

```bash
npm install
cp .env.example .env        # แล้วกรอกค่า (อย่างน้อย DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD)
npx prisma db push          # สร้างตารางในฐานข้อมูล Postgres
npm run dev                 # http://localhost:3000
npm test                    # เทสต์สูตร ER / ตัวตรวจลิงก์
```

ต้องใช้ Node 20.9+ · ตอน build จริง (`NODE_ENV=production`) ต้องตั้ง `SESSION_SECRET` ไม่เช่นนั้นระบบจะไม่ยอมเริ่ม

## สถานะ (อ่านก่อนใช้)

- ✅ เว็บต้นแบบ (`prototype/`) ใช้งานได้ครบและผ่านการทดสอบอัตโนมัติ
- ✅ เทสต์ตรรกะผ่าน 12 ข้อ (ER, ป้ายแมส, ตรวจลิงก์ TikTok)
- ⚠️ **โปรเจกต์ Next.js ยังไม่เคย `npm install` / `next build` จริง** (สภาพแวดล้อมที่เขียนโค้ดต่อเน็ตติดตั้งแพ็กเกจไม่ได้)
  ตรวจได้แค่ว่า import ทุกจุดชี้ไฟล์ที่มีจริง ถ้า `npm run typecheck` / `build` ฟ้อง error ให้แจ้งมาแก้ต่อ
- ✅ ใช้ได้เมื่อรันแล้ว: หน้า Landing 2 ประตู, สิทธิ์ Viewer/Admin (cookie เซ็นลายเซ็น), `/dashboard`, TikTok Analytics (`/dashboard/tiktok`)
- ❌ **ยังไม่ได้ทำ:** API ของปฏิทิน/Kanban (`/api/tasks`, `/api/tasks/[id]`, `/api/uploads/sign`)
  คอมโพเนนต์ `components/dashboard/*` เรียก API เหล่านี้ จึงยังไม่ได้ต่อเข้าหน้า `/dashboard` ระหว่างนี้ใช้ `prototype/index.html`
- 🔐 **รหัสผ่านฝั่ง Admin:** ใน `prototype/index.html` ฝังรหัสไว้ในโค้ด (ใครเปิดซอร์สก็เห็น) เหมาะกับต้นแบบเท่านั้น
  ของจริงตรวจที่เซิร์ฟเวอร์ผ่าน `app/api/auth/enter/route.ts` (ตั้ง `ADMIN_PASSWORD` ใน env และ **ควรเปลี่ยนรหัสเริ่มต้น**)
  ถ้า repo นี้เป็น Public ใครก็เห็นรหัสในไฟล์ต้นแบบ ควรเปลี่ยนเป็น Private หรือเปลี่ยนรหัสก่อนใช้งานจริง

## ตั้งค่า env

ดู `.env.example` — `SESSION_SECRET` (ลงนาม cookie), `ADMIN_PASSWORD`, `DATABASE_URL`,
`APIFY_TOKEN` / `APIFY_TIKTOK_ACTOR` / `APIFY_URL_FIELD`, `CRON_SECRET`

## TikTok Analytics

ส่งลิงก์ → `POST /api/tiktok/submit` → ดึงสถิติผ่าน Apify Actor → เก็บยอด + snapshot → `cron` อัปเดตทุก 6 ชม. นาน 30 วัน
ER = (Likes+Comments+Shares+Saves)/Views×100 · ติด **🔥 แมสแตก!** เมื่อ ER ≥ 10% และ Views ≥ 50,000
หน้า Admin: `/dashboard/tiktok` · สลับผู้ให้บริการได้ที่ `lib/tiktok-service.ts` (`getProvider`)
ทดสอบ Actor กับลิงก์จริง 10–20 ลิงก์ก่อนใช้งาน ชื่อฟิลด์ input/output ต่างกันตาม Actor
