# Content Calendar / CMS — Architecture (Kudsan & Bellinee's)

## 1. Tech Stack ที่แนะนำ

| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Full-stack ในโปรเจกต์เดียว (UI + API Route Handlers) ทีมเล็กดูแลง่าย |
| UI | **Tailwind CSS + shadcn/ui** | ได้ Dialog, Select, Popover, Badge พร้อมใช้ ปรับแต่งง่าย |
| Calendar / Kanban | **@dnd-kit/core + date-fns** | Drag & Drop ทั้งปฏิทินและ Kanban ด้วยเครื่องมือเดียว (ถ้าอยากได้ฟีเจอร์ปฏิทินเต็มรูปแบบ สลับเป็น FullCalendar ได้) |
| Data fetching | **TanStack Query** | Optimistic update ตอนลากวาง ตอบสนองทันที |
| Form | **React Hook Form + Zod** | Validate ฝั่ง client และ server ด้วย schema เดียวกัน |
| Database | **PostgreSQL (Supabase หรือ Neon)** + **Prisma ORM** | Relational เหมาะกับ Brand/Task/Tag, migration ง่าย |
| File Storage | **Supabase Storage หรือ Cloudflare R2 (S3-compatible)** | อัปโหลดตรงจาก browser ด้วย Presigned URL ไม่กินแบนด์วิดท์เซิร์ฟเวอร์ รองรับวิดีโอไฟล์ใหญ่ |
| Auth | **Supabase Auth หรือ Auth.js** | Login ด้วย Google/Email, แยก role |
| แจ้งเตือน | **LINE Messaging API** (หรือ Email/Resend) + **Vercel Cron** | แก้ปัญหา "ส่งงาน/บรีฟตกหล่น" ด้วยการเตือนอัตโนมัติ |
| Deploy | **Vercel** + Supabase | ตั้งค่าน้อย ค่าใช้จ่ายต่ำ |

**Roles:** `ADMIN` (จัดการทุกอย่าง), `EDITOR` (สร้าง/แก้งาน), `REVIEWER` (เปลี่ยนสถานะเป็น Approved/ให้แก้), `VIEWER` (ดูอย่างเดียว)

## 2. Data Model
ดูไฟล์ `prisma/schema.prisma` — หลักการสำคัญ:
- `Brand` เป็นตารางแยก (KS, BL) เพิ่มแบรนด์ใหม่ได้โดยไม่ต้องแก้โค้ด
- `ContentTask` 1 แถว = 1 คอนเทนต์ ผูกกับ `brandId`, `status`, `publishDate`
- แพลตฟอร์มเก็บเป็น enum array (`Platform[]`) เพราะคอนเทนต์ 1 ชิ้นลงได้หลายแพลตฟอร์ม
- `Attachment` แยกตาราง เก็บเฉพาะ URL/Key + metadata (ไม่เก็บไฟล์ใน DB)
- `StatusHistory` เก็บประวัติการเปลี่ยนสถานะ (ใครเปลี่ยน เมื่อไหร่) ใช้ตรวจย้อนหลังได้
- `Comment` ไว้ให้ผู้ตรวจเขียนคำสั่งแก้ในตัว Task

## 3. โครงสร้าง UI

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: Logo │ [Month ◀ พ.ย. 2026 ▶] │ [Calendar|Kanban] │ + New │ Avatar │
├───────────────┬──────────────────────────────────────────────────┤
│ FilterBar     │  Main View                                       │
│ (Sidebar/แถบ) │                                                  │
│               │  ── Calendar View ──        ── Kanban View ──    │
│ แบรนด์        │  อา จ อ พ พฤ ศ ส            Draft │รอตรวจ│ให้แก้│  │
│ ☑ KS ☑ BL     │  ┌──┬──┬──┬──┬──┬──┬──┐     │Approved │ Posted     │
│               │  │  │  │▮ │  │  │▮ │  │     (การ์ด ลากข้ามคอลัมน์   │
│ สถานะ         │  │  │▮ │  │▮▮│  │  │  │      เพื่อเปลี่ยนสถานะ)      │
│ ☑ Draft ...   │  └──┴──┴──┴──┴──┴──┴──┘                          │
│               │  (ลากชิปไปวันอื่น = เลื่อนวันโพสต์)                │
│ แพลตฟอร์ม     │                                                  │
│ ☑ FB ☑ IG ... │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
        คลิกชิป/การ์ด → TaskModal (Dialog กว้าง 2 คอลัมน์)
```

**Component tree**
```
app/(dashboard)/page.tsx
└─ ContentDashboard
   ├─ DashboardHeader (MonthNav, ViewToggle, NewTaskButton)
   ├─ FilterBar (BrandFilter, StatusFilter, PlatformFilter, ClearAll)
   ├─ CalendarView → DayCell(droppable) → TaskChip(draggable)
   ├─ KanbanBoard  → KanbanColumn(droppable) → TaskCard(draggable)
   └─ TaskModal
      ├─ BasicFields (title, brand, platforms, publishDate, briefDueAt, status)
      ├─ CaptionEditor (+ นับตัวอักษรตามแพลตฟอร์ม)
      ├─ FileUploader → AttachmentPreview (image / video / doc)
      └─ CommentThread + StatusHistory
```

**สีสถานะ:** Draft=เทา, รอตรวจ=เหลือง, ให้แก้=แดง/ส้ม, Approved=เขียว, Posted=น้ำเงิน
**สีแบรนด์:** แถบสีซ้ายของชิป/การ์ด (KS=ส้ม, BL=ชมพู) เพื่อแยกแบรนด์ได้ในพริบตาโดยไม่ต้องสลับหน้า

## 4. API Endpoints
| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/api/tasks?from=&to=&brand=&status=&platform=` | ดึงงานตามช่วงวันและ Filter |
| POST | `/api/tasks` | สร้างงาน |
| PATCH | `/api/tasks/:id` | แก้ไข / ย้ายวัน / เปลี่ยนสถานะ (บันทึก StatusHistory) |
| DELETE | `/api/tasks/:id` | ลบงาน |
| POST | `/api/uploads/sign` | ขอ Presigned URL สำหรับอัปโหลดไฟล์ |
| POST | `/api/tasks/:id/comments` | เพิ่มคอมเมนต์ |
| GET | `/api/cron/reminders` | Cron: เตือนงานใกล้ถึง `briefDueAt` / `publishDate` |

## 5. แนวทางย้ายข้อมูลจาก Excel
เขียน script import แบบครั้งเดียว: อ่านทุกชีท (ชื่อชีท → brand + เดือน), แปลงคอลัมน์วันที่ 1–31 เป็น `publishDate` ของแต่ละแถวคอนเทนต์ แล้ว insert เข้า `ContentTask` (ใช้ `xlsx` library ใน Node)

## 6. Roadmap
1. **MVP (1–2 สัปดาห์):** Auth, CRUD Task, Calendar + Kanban, Drag & Drop, Filter
2. **เฟส 2:** อัปโหลดไฟล์ + พรีวิว, Comment, StatusHistory
3. **เฟส 3:** แจ้งเตือน LINE/Email, Import จาก Excel, Export รายเดือนเป็น PDF/Excel ส่งลูกค้า
