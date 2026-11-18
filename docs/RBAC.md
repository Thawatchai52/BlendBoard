# ระบบสิทธิ์ผู้ใช้ (RBAC) — Content Calendar

## 1. หลักคิด

1. **สิทธิ์ผูกกับแบรนด์ ไม่ใช่ผูกกับคน** คนเดียวเป็น Manager ของ Kudsan และเป็น Viewer ของ Bellinee's ได้ จึงมีตาราง `BrandMembership(user, brand, role)` แทนการเก็บ role ไว้ที่ `User`
2. **UI ซ่อนปุ่มเพื่อความสะดวก ไม่ใช่เพื่อความปลอดภัย** ตัวบังคับจริงอยู่ที่ API ทุกครั้ง ใครยิง request ตรงก็ต้องโดนปฏิเสธ
3. **ฟังก์ชันตัดสินสิทธิ์ตัวเดียว** (`permissions.ts`) ใช้ร่วมกันทั้งฝั่ง server และ client เพื่อไม่ให้กฎสองที่ไม่ตรงกัน
4. **การเปลี่ยนสถานะเป็น state machine** แต่ละ role เปลี่ยนได้เฉพาะเส้นทางที่กำหนด

## 2. Role

| Role | ใครใช้ | ขอบเขต |
|---|---|---|
| `ADMIN` | เจ้าของระบบ / หัวหน้าทีม | ทุกอย่างของแบรนด์ + จัดการสมาชิกและ Role |
| `MANAGER` | คนเขียนบรีฟ / คนคุมคิวงาน | Full CRUD, Drag & Drop, อนุมัติ/ตีกลับ, มอบหมายงาน |
| `VIEWER` | กราฟิก / ทีมที่รอรับบรีฟ | อ่านอย่างเดียว + ทำได้เฉพาะ **งานที่ถูกมอบหมายให้ตัวเอง** |

`isSuperAdmin` บน `User` ใช้สำหรับเจ้าของระบบที่ต้องข้ามทุกแบรนด์ (ใช้น้อยที่สุด)

## 3. ตารางสิทธิ์

| การกระทำ | VIEWER | MANAGER | ADMIN |
|---|:---:|:---:|:---:|
| ดูปฏิทิน / Kanban / รายละเอียดบรีฟ | ✅ | ✅ | ✅ |
| ดาวน์โหลดไฟล์ | ✅ | ✅ | ✅ |
| สร้าง / แก้ไขบรีฟ | ❌ | ✅ | ✅ |
| ลบงาน | ❌ | ✅ | ✅ |
| ลากเลื่อนวัน / ลำดับคิว (Drag & Drop) | ❌ | ✅ | ✅ |
| มอบหมายงาน (assignee) | ❌ | ✅ | ✅ |
| แนบไฟล์ Reference | ❌ | ✅ | ✅ |
| อัปโหลดไฟล์ส่งงาน (Deliverable) | ✅ เฉพาะงานตัวเอง | ✅ | ✅ |
| ส่งงานตรวจ (Draft/ให้แก้ → รอตรวจ) | ✅ เฉพาะงานตัวเอง | ✅ | ✅ |
| Approve / Reject + คอมเมนต์ | ❌ | ✅ | ✅ |
| ตั้งเป็น Posted | ❌ | ✅ | ✅ |
| จัดการสมาชิกและ Role | ❌ | ❌ | ✅ |

## 4. State machine ของสถานะงาน

```
            ส่งงานตรวจ (Viewer ของงานนั้น)
 ┌─────────┐ ─────────────────────────────▶ ┌──────────┐
 │  DRAFT  │                                 │ IN_REVIEW│ ◀─────────────┐
 └─────────┘ ◀──── ถอนงานกลับ (Viewer) ───── └──────────┘               │
      ▲                                       │        │                │
      │                           Reject      │        │ Approve        │ ส่งงานตรวจใหม่
      │                    (บังคับมีคอมเมนต์)  ▼        ▼                │ (Viewer)
      │                                 ┌──────────┐ ┌──────────┐        │
      └──────── Manager ย้ายเอง ─────── │ REVISION │ │ APPROVED │        │
                                        └──────────┘ └──────────┘        │
                                             └────────────────────────────┘
                                                          │ Manager
                                                          ▼
                                                    ┌──────────┐
                                                    │  POSTED  │
                                                    └──────────┘
```

- **Viewer** เปลี่ยนได้แค่: `DRAFT → IN_REVIEW`, `REVISION → IN_REVIEW`, `IN_REVIEW → DRAFT` (ถอนกลับ)
- **Manager/Admin** เปลี่ยนได้ทุกเส้นทาง แต่ `IN_REVIEW → REVISION` ต้องมีคอมเมนต์เสมอ
- ทุกการเปลี่ยนสถานะบันทึกลง `StatusHistory`, ส่วน Approve/Reject บันทึกลง `Review` พร้อมเลขรอบแก้ (`roundNo`)

## 5. Database

ดู `rbac.prisma` สรุปการเปลี่ยนแปลงจาก schema เดิม:

| เปลี่ยน | รายละเอียด |
|---|---|
| `Role` enum | จาก `ADMIN/EDITOR/REVIEWER/VIEWER` เหลือ `ADMIN/MANAGER/VIEWER` (EDITOR และ REVIEWER รวมเป็น MANAGER) |
| `User.role` | **ลบ** แทนด้วย `BrandMembership` |
| `BrandMembership` | ใหม่: `userId + brandId` ไม่ซ้ำ เก็บ role ต่อแบรนด์ |
| `Attachment.purpose` | ใหม่: `REFERENCE` (ไฟล์บรีฟจากผู้เขียน) หรือ `DELIVERABLE` (ไฟล์ส่งงานจากกราฟิก) |
| `Attachment.uploadedById` | ใหม่: ใช้ตรวจว่าใครลบไฟล์ของใครได้ |
| `Review` | ใหม่: ผลตรวจแต่ละรอบ (APPROVED/REJECTED) + คอมเมนต์ |
| `ContentTask` | เพิ่ม `submittedAt`, `revisionRound` |

ย้ายข้อมูลเดิม: ผู้ใช้ที่เป็น EDITOR/REVIEWER → MANAGER, VIEWER → VIEWER แล้วสร้าง `BrandMembership` ให้ครบทุกแบรนด์ที่เขาเคยเข้าถึง

## 6. ป้องกัน 4 ชั้น

| ชั้น | ทำอะไร | ไฟล์ |
|---|---|---|
| 1. Middleware | ต้องล็อกอิน, `/admin/*` ต้องเป็น Manager ขึ้นไป (ตรวจหยาบเพื่อ redirect เร็ว) | `middleware.ts` |
| 2. Server Component / Layout | `requireRole()` ก่อน render หน้าที่จำกัดสิทธิ์ | `api-transition-route.ts` (ตัวอย่าง guard) |
| 3. API Route (**ชั้นหลัก**) | `can()` และ `canTransition()` ทุก endpoint ที่เปลี่ยนข้อมูล, whitelist ฟิลด์, ตรวจเจ้าของงาน | `api-transition-route.ts` |
| 4. ฐานข้อมูล (ทางเลือก) | Row Level Security ถ้าใช้ Supabase เป็น defense in depth | หัวข้อ 8 |

> อย่าใช้ Middleware เป็นด่านเดียว เคยมีช่องโหว่ใน Next.js ที่ข้าม Middleware ได้ (CVE-2025-29927) ควรอัปเดตเวอร์ชันและตรวจสิทธิ์ซ้ำใน API เสมอ

### กฎเหล็กของ API
- `PATCH /api/tasks/:id` ใช้ได้เฉพาะ Manager/Admin และรับเฉพาะฟิลด์ที่อนุญาต (whitelist) ห้าม spread body ลง DB
- การเปลี่ยนสถานะทั้งหมดผ่าน `POST /api/tasks/:id/transition` เท่านั้น ไม่ผ่าน PATCH
- ทุก query ใส่ `brandId` ตามสมาชิกของผู้ใช้เสมอ (ห้ามเชื่อ `brand` ใน query string อย่างเดียว)
- อ่านสิทธิ์จาก DB หรือ cache อายุสั้น ไม่ฝังสิทธิ์ใน JWT ระยะยาว เมื่อถอนสิทธิ์จะมีผลทันที

## 7. ความปลอดภัยของไฟล์

- Bucket เป็น **private** ดาวน์โหลดผ่าน Signed URL อายุสั้น (5–10 นาที) ที่ออกให้หลังตรวจว่าผู้ขอเป็นสมาชิกของแบรนด์นั้น
- `POST /api/uploads/sign` รับ `taskId` และ `purpose` แล้วตรวจ:
  - `REFERENCE` → Manager/Admin เท่านั้น
  - `DELIVERABLE` → Viewer ต้องเป็น assignee ของงานนั้น และงานต้องอยู่สถานะ `DRAFT` หรือ `REVISION`
- Key ของไฟล์ใช้รูปแบบ `brandId/taskId/uuid-ชื่อไฟล์` ห้ามใช้ชื่อไฟล์จากผู้ใช้ตรง ๆ
- จำกัดชนิดและขนาดไฟล์ที่ server (ไม่ใช่แค่ใน `<input accept>`)
- Viewer ลบได้เฉพาะไฟล์ที่ตัวเองอัปโหลดและงานยังไม่เข้าสถานะ `IN_REVIEW`

## 8. Row Level Security (ทางเลือก สำหรับ Supabase)

```sql
alter table content_task enable row level security;

create policy "members can read tasks" on content_task for select
using (exists (
  select 1 from brand_membership m
  where m.brand_id = content_task.brand_id and m.user_id = auth.uid()
));

create policy "managers can write tasks" on content_task for all
using (exists (
  select 1 from brand_membership m
  where m.brand_id = content_task.brand_id and m.user_id = auth.uid()
    and m.role in ('ADMIN','MANAGER')
));
```
Viewer ที่ส่งงานต้องผ่าน API (service role) เท่านั้น เพราะต้องตรวจ state machine ซึ่งเขียนใน SQL policy ได้ยาก

## 9. ฝั่ง Frontend

| เรื่อง | วิธีทำ |
|---|---|
| เก็บ session | Server Layout อ่านผู้ใช้และ memberships แล้วส่งเข้า Zustand ผ่าน `<SessionHydrator>` |
| role ปัจจุบัน | คำนวณจาก **แบรนด์ที่เลือกอยู่** (`brand-store`) สลับแบรนด์แล้ว role และปุ่มเปลี่ยนตามทันที |
| ซ่อน/แสดงปุ่ม | `<Can action="task:create">…</Can>` หรือ `const { can } = usePermissions()` |
| Drag & Drop | `useDraggable({ disabled: !can('task:reschedule') })` และเปลี่ยน cursor เป็นปกติ |
| ปุ่มเปลี่ยนสถานะของ Viewer | แสดงเฉพาะปุ่มที่ `canTransition` อนุญาต ไม่ใช้ dropdown สถานะอิสระ |
| ฟอร์มบรีฟ | Viewer เห็นเป็นโหมดอ่านอย่างเดียว (ไม่ใช่ฟอร์มที่ disable ทั้งหมด) |
| ตัวเลือกใน Kanban | Viewer เห็นการ์ดทั้งหมดของแบรนด์ แต่มีป้าย "งานของคุณ" ที่งานตัวเอง และมีตัวกรอง "เฉพาะงานของฉัน" |
| Error จาก API | 403 → toast "ไม่มีสิทธิ์ทำรายการนี้" แล้ว refetch เพื่อให้ UI ตรงกับความจริง |

## 10. รายการทดสอบ (ควรเขียนเป็น automated test)

- [ ] Viewer ยิง `PATCH /api/tasks/:id` ตรง ๆ → 403
- [ ] Viewer เปลี่ยนสถานะงานของคนอื่น → 403
- [ ] Viewer เปลี่ยน `IN_REVIEW → APPROVED` → 403
- [ ] Viewer อัปโหลด `REFERENCE` → 403
- [ ] Manager ของ KS ยิงแก้งานของ BL (ไม่มี membership) → 403
- [ ] Reject โดยไม่มีคอมเมนต์ → 400
- [ ] กด Approve พร้อมกัน 2 คน → สำเร็จเพียงรายการเดียว (409 อีกรายการ)
- [ ] ถอนสิทธิ์ผู้ใช้แล้ว request ถัดไปถูกปฏิเสธทันที
- [ ] Signed URL ของไฟล์แบรนด์อื่นขอไม่ได้

## 11. ลำดับการทำ

1. Migration: เพิ่ม `BrandMembership`, `Review`, ฟิลด์ใหม่ของ `Attachment` แล้วย้ายข้อมูล role เดิม
2. วาง `permissions.ts` และเขียน unit test ของ `can()` / `canTransition()` ก่อน
3. ใส่ guard ใน API ทุกตัว (เริ่มจาก `transition`)
4. Middleware และหน้า `/admin/members`
5. ปรับ UI: `SessionHydrator`, `usePermissions`, `<Can>`, ReviewPanel / SubmitWorkPanel
