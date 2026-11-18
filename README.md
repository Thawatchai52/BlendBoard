# BlendBoard — Content Calendar (Kudsan · Bellinee's)

ระบบจัดการตารางคอนเทนต์รายเดือนของ 2 แบรนด์ (KS ส้ม / BL น้ำตาล) แทนไฟล์ Excel แยกแบรนด์/เดือน
ปฏิทิน + Kanban ลากวาง, บรีฟ, อัปโหลดไฟล์/ส่งลิงก์งาน, Workflow Draft → รอตรวจ → ให้แก้ → Approved → Posted
และสถิติคลิป TikTok อัตโนมัติ (ER + ป้าย 🔥 แมสแตก!)

## มีอะไรใน repo นี้

| โฟลเดอร์ | คืออะไร |
|---|---|
| `prototype/index.html` | **เว็บต้นแบบไฟล์เดียว** เปิดในเบราว์เซอร์ได้เลย ข้อมูลเก็บใน localStorage ไม่มีเซิร์ฟเวอร์ ใช้ลองหน้าตา/การใช้งาน |
| `app/ components/ lib/ hooks/ middleware.ts` | **โค้ด Next.js 15 (App Router)** ของระบบจริง: หน้า Landing 2 ประตู, สิทธิ์ Viewer/Admin, Dashboard, TikTok Analytics |
| `prisma/` | `schema.prisma` (งาน/แบรนด์) + `tiktok.prisma` (ต่อท้าย schema.prisma) |
| `docs/` | สถาปัตยกรรม (`ARCHITECTURE.md`) และการออกแบบสิทธิ์ (`RBAC.md`) |
| `legacy-rbac/` | RBAC รุ่นเก่าแบบมีบัญชีรายคน เก็บไว้อ้างอิง **ไม่ได้ใช้แล้ว** ถูกแทนที่ด้วย 2 ประตู + cookie |
| `tests/` | เทสต์สูตร ER / ตัวตรวจลิงก์ TikTok |

## สถานะ (อ่านก่อนใช้)

- ✅ เว็บต้นแบบ (`prototype/`) ใช้งานได้ครบและผ่านการทดสอบอัตโนมัติ
- ⚠️ โค้ด Next.js เป็น **ชุดไฟล์ที่ยังไม่เคยรันเป็นโปรเจกต์** ยังไม่มี `package.json` / `tsconfig.json` / `lib/prisma.ts`
  ต้องสร้างโปรเจกต์ Next.js 15 แล้วนำไฟล์เหล่านี้ใส่ ติดตั้ง `zustand @tanstack/react-query @dnd-kit/core zod @prisma/client`
  และเพิ่ม alias `@/*` ใน tsconfig
- ✅ เทสต์ตรรกะผ่าน (`node --experimental-strip-types --test tests/metrics.test.ts tests/tiktok-url.test.ts`)
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
