// POST /api/tasks/:id/transition  { to, comment? }
// จุดเดียวที่ฝั่งส่งงาน (Viewer) ใช้เปลี่ยนสถานะ: ส่งตรวจ / ถอนกลับ  ส่วน Admin ใช้ได้ทุกเส้นทาง (อนุมัติ / ตีกลับ / Posted)
import { prisma } from '@/lib/prisma';
import { fail, json, requireRole } from '@/lib/api';
import { taskInclude, toTaskDTO } from '@/lib/task-dto';
import { transitionBody } from '@/lib/task-schemas';
import { checkTransition } from '@/lib/task-rules';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;

  const parsed = transitionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID', 'ข้อมูลไม่ถูกต้อง');
  const { to, comment } = parsed.data;

  const { id } = await ctx.params;
  const task = await prisma.contentTask.findUnique({ where: { id }, include: { attachments: { select: { purpose: true } } } });
  if (!task) return fail(404, 'NOT_FOUND');

  const check = checkTransition({
    role: auth.role,
    from: task.status,
    to,
    comment,
    deliverableCount: task.attachments.filter((a) => a.purpose === 'DELIVERABLE').length,
  });
  if (!check.ok) return fail(check.http, check.error, check.reason);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.contentTask.updateMany({
        where: { id, status: task.status }, // optimistic lock
        data: {
          status: to,
          submittedAt: to === 'IN_REVIEW' ? new Date() : undefined,
          revisionNote: check.reject ? comment!.trim() : undefined,
          revisionRound: check.reject ? { increment: 1 } : undefined,
        },
      });
      if (res.count === 0) throw new Error('CONFLICT');
      await tx.statusHistory.create({
        data: { taskId: id, fromStatus: task.status, toStatus: to, actorRole: auth.role, comment: comment?.trim() || null },
      });
      return tx.contentTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });
    return json(toTaskDTO(updated));
  } catch (e) {
    if (e instanceof Error && e.message === 'CONFLICT') {
      return fail(409, 'CONFLICT', 'มีคนเปลี่ยนสถานะงานนี้ไปแล้ว กรุณารีเฟรช');
    }
    throw e;
  }
}
