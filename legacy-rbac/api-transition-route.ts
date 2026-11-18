// app/api/tasks/[id]/transition/route.ts
// จุดเดียวที่เปลี่ยนสถานะงาน ตรวจสิทธิ์ + state machine + บันทึก Review/History ในธุรกรรมเดียว
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth'; // คืน SessionUser (อ่าน memberships จาก DB/cache อายุสั้น)
import { canTransition, isReviewTransition } from '@/lib/permissions';

const body = z.object({
  to: z.enum(['DRAFT', 'IN_REVIEW', 'REVISION', 'APPROVED', 'POSTED']),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  const { to, comment } = parsed.data;

  const task = await prisma.contentTask.findUnique({ where: { id: params.id } });
  // ไม่พบ และ ไม่ใช่สมาชิก ตอบเหมือนกัน (404) เพื่อไม่บอกว่ามีงานนี้อยู่
  if (!task || !(user.isSuperAdmin || user.memberships[task.brandId])) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const check = canTransition(user, task, to);
  if (!check.ok) return NextResponse.json({ error: 'FORBIDDEN', reason: check.reason }, { status: 403 });

  const review = isReviewTransition(task.status, to);
  if (review === 'REJECTED' && !comment?.trim()) {
    return NextResponse.json({ error: 'COMMENT_REQUIRED', reason: 'ตีกลับต้องระบุสิ่งที่ต้องแก้' }, { status: 400 });
  }
  // ส่งตรวจต้องมีไฟล์ส่งงานอย่างน้อย 1 ไฟล์
  if (to === 'IN_REVIEW') {
    const n = await prisma.attachment.count({ where: { taskId: task.id, purpose: 'DELIVERABLE' } });
    if (n === 0) return NextResponse.json({ error: 'DELIVERABLE_REQUIRED', reason: 'แนบไฟล์ส่งงานก่อนส่งตรวจ' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // optimistic lock: อัปเดตเฉพาะเมื่อสถานะยังเป็นค่าที่เราอ่านมา
      // ถ้ามี Manager 2 คนกด Approve พร้อมกัน จะสำเร็จคนเดียว
      const res = await tx.contentTask.updateMany({
        where: { id: task.id, status: task.status },
        data: {
          status: to,
          submittedAt: to === 'IN_REVIEW' ? new Date() : undefined,
          revisionRound: review === 'REJECTED' ? { increment: 1 } : undefined,
        },
      });
      if (res.count === 0) throw new Error('CONFLICT');

      await tx.statusHistory.create({
        data: { taskId: task.id, fromStatus: task.status, toStatus: to, changedById: user.id },
      });
      if (review) {
        await tx.review.create({
          data: {
            taskId: task.id,
            reviewerId: user.id,
            decision: review,
            comment: comment?.trim() || null,
            roundNo: task.revisionRound + 1,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'CONFLICT') {
      return NextResponse.json({ error: 'CONFLICT', reason: 'มีคนเปลี่ยนสถานะงานนี้ไปแล้ว กรุณารีเฟรช' }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}

/* =====================================================================
   ตัวอย่าง guard อื่น ๆ ที่ควรมีในโปรเจกต์
   ===================================================================== */

// lib/guards.ts — ใช้ใน Server Component / Route Handler
//
// import { redirect } from 'next/navigation';
// import { roleIn, type Role } from '@/lib/permissions';
//
// export async function requireRole(brandId: string, min: 'MANAGER' | 'ADMIN') {
//   const user = await getSessionUser();
//   if (!user) redirect('/login');
//   const role = roleIn(user, brandId);
//   const rank: Record<Role, number> = { VIEWER: 0, MANAGER: 1, ADMIN: 2 };
//   if (!role || rank[role] < rank[min]) redirect('/forbidden');
//   return user;
// }
//
// // app/admin/members/page.tsx
// export default async function MembersPage() {
//   await requireRole(currentBrandId, 'ADMIN');   // ตรวจที่ server ก่อน render
//   ...
// }

// PATCH /api/tasks/[id] — Manager/Admin เท่านั้น และ "whitelist" ฟิลด์
//
// const patchSchema = z.object({
//   title: z.string().min(1).max(150).optional(),
//   caption: z.string().max(5000).optional(),
//   platforms: z.array(z.enum([...])).min(1).optional(),
//   publishDate: z.string().datetime().optional(),
//   briefDueAt: z.string().datetime().nullable().optional(),
//   assigneeId: z.string().nullable().optional(),
// }).strict();                                      // .strict() ปฏิเสธฟิลด์แปลกปลอม เช่น status, brandId
//
// const action = parsed.publishDate ? 'task:reschedule' : 'task:edit';
// if (!can(user, task.brandId, action, task)) return 403;
// // ห้ามให้ย้ายงานข้ามแบรนด์ผ่าน PATCH (brandId ไม่อยู่ใน whitelist)

// POST /api/uploads/sign — ตรวจ purpose + เจ้าของงาน
//
// if (purpose === 'REFERENCE' && !can(user, task.brandId, 'file:upload_reference', task)) return 403;
// if (purpose === 'DELIVERABLE') {
//   if (!can(user, task.brandId, 'file:upload_deliverable', task)) return 403;
//   if (role === 'VIEWER' && !['DRAFT','REVISION'].includes(task.status)) return 409; // ส่งตรวจแล้วอัปโหลดเพิ่มไม่ได้
// }
// const key = `${task.brandId}/${task.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
//
// GET /api/files/[id]  → ตรวจสมาชิกแบรนด์ แล้วออก Signed URL อายุ 5–10 นาที
