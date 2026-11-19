# BlendBoard — Content Calendar (Kudsan · Bellinee's)

ระบบจัดการตารางคอนเทนต์รายเดือนของ 2 แบรนด์ (KS ส้ม / BL น้ำตาล) แทนไฟล์ Excel แยกแบรนด์/เดือน
ปฏิทิน + Kanban ลากวาง, บรีฟ, วางลิงก์ TikTok เมื่อคอนเทนต์ลงแล้ว (งานขึ้นว่า "ลง TikTok แล้ว" ให้ทั้งสองฝั่งเห็น)
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
| `tests/` | เทสต์สูตร ER / ตัวตรวจลิงก์ TikTok / กติกางาน |

## รันโปรเจกต์

```bash
npm install
cp .env.example .env        # แล้วกรอกค่า (อย่างน้อย DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD)
npx prisma db push          # สร้างตารางในฐานข้อมูล Postgres
npx prisma db seed          # สร้างแบรนด์ KS / BL
npm run dev                 # http://localhost:3000
npm test                    # เทสต์สูตร ER / ตัวตรวจลิงก์
```

ต้องใช้ Node 20.9+ · ตอน build จริง (`NODE_ENV=production`) ต้องตั้ง `SESSION_SECRET` ไม่เช่นนั้นระบบจะไม่ยอมเริ่ม

## สถานะ (อ่านก่อนใช้)

- ✅ เว็บต้นแบบ (`prototype/`) ใช้งานได้ครบและผ่านการทดสอบอัตโนมัติ **ตัดระบบส่งงาน/ตรวจ/ตีกลับ และตัวเตือนงานค้าง/ใกล้กำหนดออกแล้ว** เหลือสถานะ 2 แบบ: ยังไม่ลง TikTok / ลง TikTok แล้ว (ดูจากลิงก์ที่วาง)
- ⚠️ **โค้ด Next.js (`app/ components/ lib/ prisma/`) ยังเป็นรุ่นเดิมที่มี workflow 5 สถานะ ยังไม่ได้ตัดให้เหมือนต้นแบบ**
- ✅ เทสต์ตรรกะผ่าน 23 ข้อ (ER/ป้ายแมส, ตรวจลิงก์ TikTok, สิทธิ์และ state machine, ตัวลงนาม URL ตรงกับตัวอย่างทางการของ AWS)
- ⚠️ **โปรเจกต์ Next.js ยังไม่เคย `npm install` / `next build` จริง** (สภาพแวดล้อมที่เขียนโค้ดต่อเน็ตติดตั้งแพ็กเกจไม่ได้)
  ตรวจได้แค่ว่า import ทุกจุดชี้ไฟล์ที่มีจริง ถ้า `npm run typecheck` / `build` ฟ้อง error ให้แจ้งมาแก้ต่อ
- ✅ ใช้ได้เมื่อรันแล้ว: หน้า Landing 2 ประตู, สิทธิ์ Viewer/Admin (cookie เซ็นลายเซ็น), `/dashboard`, TikTok Analytics (`/dashboard/tiktok`)
- ✅ **API ปฏิทิน/Kanban เขียนแล้ว** (ตารางด้านล่าง) และต่อหน้า `/dashboard/calendar` แล้ว — ยังไม่เคยรันกับฐานข้อมูลจริง
- ✅ **หน้าส่งงาน/ตรวจงานในหน้าต่างงานเขียนแล้ว** (`components/dashboard/WorkflowPanel.tsx`): Viewer แนบไฟล์/ลิงก์ส่งงาน ส่งตรวจ ถอนกลับ · Admin อนุมัติ / ตีกลับ (บังคับคอมเมนต์) / Posted — ต่อกับ API เดิมแล้ว แต่ **ยังไม่เคยรันจริง**
- ⚠️ **หน้า Next.js ยังไม่เท่าเว็บต้นแบบ:** ธีมสีส้ม/น้ำตาลยังไม่ถูกใช้กับหน้าปฏิทินนี้ และหน้าตา UI เป็นรุ่นพื้นฐาน
- 🔐 **รหัสผ่านฝั่ง Admin:** ใน `prototype/index.html` ฝังรหัสไว้ในโค้ด (ใครเปิดซอร์สก็เห็น) เหมาะกับต้นแบบเท่านั้น
  ของจริงตรวจที่เซิร์ฟเวอร์ผ่าน `app/api/auth/enter/route.ts` (ตั้ง `ADMIN_PASSWORD` ใน env และ **ควรเปลี่ยนรหัสเริ่มต้น**)
  ถ้า repo นี้เป็น Public ใครก็เห็นรหัสในไฟล์ต้นแบบ ควรเปลี่ยนเป็น Private หรือเปลี่ยนรหัสก่อนใช้งานจริง

## ตั้งค่า env

ดู `.env.example` — `SESSION_SECRET` (ลงนาม cookie), `ADMIN_PASSWORD`, `DATABASE_URL`,
`APIFY_TOKEN` / `APIFY_TIKTOK_ACTOR` / `APIFY_URL_FIELD`, `CRON_SECRET`

## API ปฏิทิน

ทุก route ตรวจ cookie role ที่เซิร์ฟเวอร์ (401 ถ้ายังไม่เข้าสู่ระบบ) — หน้าจอซ่อนปุ่มเป็นแค่ความสะดวก ตัวบังคับจริงคือ API

| Method + Path | ใครใช้ได้ | ทำอะไร |
|---|---|---|
| `GET /api/tasks?brand=KS&month=2026-11` หรือ `?from=&to=` | Viewer, Admin | รายการงานตามช่วงวัน (กรองแบรนด์ได้) |
| `POST /api/tasks` | Admin | สร้างงาน (พร้อมไฟล์แนบ) |
| `GET /api/tasks/:id` | Viewer, Admin | งานเดียว + ประวัติสถานะ |
| `PATCH /api/tasks/:id` | Admin | แก้ / ลากเลื่อนวัน / ย้ายสถานะ (whitelist ฟิลด์, ย้ายข้ามแบรนด์ไม่ได้) |
| `DELETE /api/tasks/:id` | Admin | ลบงาน + ไฟล์ใน storage |
| `POST /api/tasks/:id/transition` | Viewer, Admin | เปลี่ยนสถานะตามสิทธิ์: Viewer = ส่งตรวจ/ถอนกลับ, Admin = ทุกเส้นทาง |
| `POST/DELETE /api/tasks/:id/attachments` | Viewer (เฉพาะไฟล์ส่งงานตอน Draft/ให้แก้), Admin | เพิ่ม/ลบไฟล์หรือลิงก์ (เช่น TikTok) |
| `POST /api/uploads/sign` | Viewer, Admin (ตามสิทธิ์ไฟล์) | ขอ URL ชั่วคราวอัปโหลดไฟล์ตรงเข้า storage |

กติกา (ทดสอบแล้วใน `tests/task-rules.test.ts`): ตีกลับ (รอตรวจ → ให้แก้) ต้องมีคอมเมนต์ · ส่งตรวจต้องมีไฟล์/ลิงก์ส่งงานอย่างน้อย 1 ·
ไฟล์ต้องอยู่ใต้โฟลเดอร์แบรนด์เดียวกับงาน · ลิงก์ต้องเป็น https · เปลี่ยนสถานะใช้ optimistic lock (คนที่สองได้ 409)

ไฟล์แนบเก็บใน storage แบบ S3 (Cloudflare R2 / Supabase / AWS S3) ตั้งค่า `S3_*` ใน `.env` ถ้ายังไม่ตั้ง การอัปโหลดไฟล์จะตอบ 501 (ลิงก์ยังใช้ได้)

## TikTok Analytics

**ไม่มีฟอร์มส่งลิงก์แยก** — ยอดมาจากลิงก์ TikTok ที่คนส่งงานวางในช่อง "ไฟล์ส่งงาน" ของแต่ละงานในปฏิทินเลย
แนบลิงก์ → `after()` สร้างแถวสถิติ (`lib/tiktok-sync.ts`) → ดึงยอดผ่าน Apify Actor → เก็บยอด + snapshot → `cron` อัปเดตทุก 6 ชม. นาน 30 วัน
ลบลิงก์หรือลบงาน → สถิติของคลิปนั้นหายตาม (cascade) · ลิงก์ TikTok ที่ไม่ใช่ลิงก์คลิปจะถูกปฏิเสธตอนแนบ
ER = (Likes+Comments+Shares+Saves)/Views×100 · ติด **🔥 แมสแตก!** เมื่อ ER ≥ 10% และ Views ≥ 50,000
หน้า Admin: `/dashboard/tiktok` (ตารางแสดงชื่องาน + แบรนด์ + ลิงก์คลิป) · Viewer ไม่เห็นสถิติ · สลับผู้ให้บริการได้ที่ `lib/tiktok-service.ts` (`getProvider`)
ทดสอบ Actor กับลิงก์จริง 10–20 ลิงก์ก่อนใช้งาน ชื่อฟิลด์ input/output ต่างกันตาม Actor

> หมายเหตุ: หลังอัปเดตโครงสร้างนี้ต้องรัน `npx prisma db push` ใหม่ (ตาราง `TikTokPost` ผูกกับ `Attachment` แล้ว ข้อมูล TikTok เดิมที่ส่งผ่านฟอร์มเก่าจะไม่ถูกย้าย)

## Trend Radar (Admin)

หน้า `/dashboard/trends` (ในต้นแบบคือแท็บ "Trend Radar") — ดึงคลิปเบเกอรี่/เครื่องดื่มที่กำลังมาแรงใน 7 วันล่าสุด ตามคีย์เวิร์ด/แฮชแท็กที่แอดมินตั้งเอง (ค่าเริ่มต้น #เบเกอรี่ #ขนมปัง #คาเฟ่ #เครื่องดื่ม #อร่อยบอกต่อ)
การ์ดเรียงตามยอดวิวหรือความแมส (ER) แยกแท็บเบเกอรี่/เครื่องดื่ม โชว์ภาพปก ยอดวิว แคปชัน และลิงก์ดูคลิปต้นทาง · ปุ่ม **เซฟเป็นเรฟ** เก็บเข้าคลังไอเดียถาวร
- จัดหมวดจากคำในแคปชัน/แฮชแท็ก (`lib/trend-classify.ts` แก้รายการคำได้) คลิปที่ไม่เข้าหมวดไหนถูกตัดทิ้ง
- ดึงผ่าน Apify Actor ตั้ง `APIFY_TREND_ACTOR` (ดู `.env.example`) — **ชื่อ input/output ใน `lib/providers/apify-trends.ts` เป็นค่าสมมติ ยังไม่ได้ทดสอบกับ Actor จริง** ต้องตรวจก่อนใช้
- กดดึงซ้ำได้ทุก 30 นาที (กันเสียเครดิต) · ลิงก์ภาพปกของ TikTok หมดอายุได้ หน้าเว็บมีภาพสำรอง
- ใช้ `npx prisma db push` เพื่อสร้างตาราง `TrendKeyword` `TrendClip` `SavedIdea`

