// GET /api/tasks/:id     อ่านงาน + ประวัติสถานะ (Viewer + Admin)
// PATCH /api/tasks/:id   แก้งาน / ลากเลื่อนวัน / ย้ายสถานะ (Admin เท่านั้น, whitelist ฟิลด์)
// DELETE /api/tasks/:id  ลบงาน (Admin เท่านั้น)
import { prisma } from '@/lib/prisma';
import { fail, json, requireRole } from '@/lib/api';
import { taskInclude, taskIncludeWithHistory, toTaskDTO } from '@/lib/task-dto';
import { attachmentError, attachmentRow, patchTask } from '@/lib/task-schemas';
import { checkTransition } from '@/lib/task-rules';
import { deleteObject } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const task = await prisma.contentTask.findUnique({ where: { id }, include: taskIncludeWithHistory });
  if (!task) return fail(404, 'NOT_FOUND');
  return json(toTaskDTO(task));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;
  if (auth.role !== 'ADMIN') {
    return fail(403, 'FORBIDDEN', 'แก้ไขบรีฟได้เฉพาะ Admin  ฝั่งส่งงานใช้ /transition และ /attachments');
  }

  const parsed = patchTask.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID', parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
  const d = parsed.data;

  const { id } = await ctx.params;
  const task = await prisma.contentTask.findUnique({ where: { id }, include: { attachments: true } });
  if (!task) return fail(404, 'NOT_FOUND');
  // ห้ามย้ายงานข้ามแบรนด์ผ่าน PATCH (กันข้อมูลสองโลกปนกัน)
  if (d.brandId && d.brandId !== task.brandId) return fail(400, 'BRAND_LOCKED', 'ย้ายงานข้ามแบรนด์ไม่ได้');
  if (d.attachments) {
    const bad = attachmentError(d.attachments, task.brandId);
    if (bad) return fail(400, 'INVALID', bad);
  }

  const statusChanged = d.status !== undefined && d.status !== task.status;
  let reject = false;
  if (statusChanged) {
    const deliverableCount = (d.attachments ?? task.attachments).filter((a) => a.purpose === 'DELIVERABLE').length;
    const r = checkTransition({ role: 'ADMIN', from: task.status, to: d.status!, comment: d.comment, deliverableCount });
    if (!r.ok) return fail(r.http, r.error, r.reason);
    reject = r.reject;
  }

  const removedKeys: (string | null)[] = [];
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.contentTask.updateMany({
        // ล็อกแบบ optimistic: ถ้ามีคนเปลี่ยนสถานะไปก่อน (Admin 2 คนพร้อมกัน) จะไม่เขียนทับ
        where: { id, ...(statusChanged ? { status: task.status } : {}) },
        data: {
          title: d.title,
          caption: d.caption,
          platforms: d.platforms,
          publishDate: d.publishDate ? new Date(d.publishDate) : undefined,
          briefDueAt: d.briefDueAt === undefined ? undefined : d.briefDueAt ? new Date(d.briefDueAt) : null,
          ...(statusChanged
            ? {
                status: d.status,
                submittedAt: d.status === 'IN_REVIEW' ? new Date() : undefined,
                revisionNote: reject ? d.comment!.trim() : undefined,
                revisionRound: reject ? { increment: 1 } : undefined,
              }
            : {}),
        },
      });
      if (res.count === 0) throw new Error('CONFLICT');

      if (statusChanged) {
        await tx.statusHistory.create({
          data: { taskId: id, fromStatus: task.status, toStatus: d.status!, actorRole: 'ADMIN', comment: d.comment?.trim() || null },
        });
      }

      if (d.attachments) {
        // ซิงก์รายการไฟล์: ที่หายไป = ลบ, ที่ id ไม่เคยมีในงานนี้ = เพิ่มใหม่, ที่ยังอยู่ = คงเดิม
        const have = new Set(task.attachments.map((a) => a.id));
        const keep = new Set(d.attachments.filter((a) => a.id && have.has(a.id)).map((a) => a.id!));
        const drop = task.attachments.filter((a) => !keep.has(a.id));
        if (drop.length) {
          await tx.attachment.deleteMany({ where: { id: { in: drop.map((a) => a.id) } } });
          removedKeys.push(...drop.map((a) => a.key));
        }
        const add = d.attachments.filter((a) => !(a.id && have.has(a.id)));
        if (add.length) await tx.attachment.createMany({ data: add.map((a) => ({ taskId: id, ...attachmentRow(a, 'ADMIN') })) });
      }
      return tx.contentTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });
    await Promise.all(removedKeys.map(deleteObject));
    return json(toTaskDTO(updated));
  } catch (e) {
    if (e instanceof Error && e.message === 'CONFLICT') {
      return fail(409, 'CONFLICT', 'มีคนเปลี่ยนสถานะงานนี้ไปแล้ว กรุณารีเฟรช');
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireRole(true);
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const task = await prisma.contentTask.findUnique({ where: { id }, select: { attachments: { select: { key: true } } } });
  if (!task) return fail(404, 'NOT_FOUND');
  await prisma.contentTask.delete({ where: { id } }); // ไฟล์แนบ/ประวัติลบตามด้วย (onDelete: Cascade)
  await Promise.all(task.attachments.map((a) => deleteObject(a.key)));
  return json({ ok: true });
}
