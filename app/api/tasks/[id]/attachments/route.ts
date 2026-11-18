// POST   /api/tasks/:id/attachments        { attachments: [...] }  เพิ่มไฟล์/ลิงก์ (หลังอัปโหลดขึ้น storage แล้ว)
// DELETE /api/tasks/:id/attachments?id=xxx  ลบไฟล์/ลิงก์
// Viewer: เฉพาะ "ไฟล์ส่งงาน" และเฉพาะตอนงานเป็น Draft / ให้แก้   Admin: ทุกชนิด ทุกสถานะ
import { prisma } from '@/lib/prisma';
import { fail, json, requireRole } from '@/lib/api';
import { taskInclude, toTaskDTO } from '@/lib/task-dto';
import { addAttachments, attachmentError, attachmentRow } from '@/lib/task-schemas';
import { canChangeAttachment } from '@/lib/task-rules';
import { deleteObject } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;

  const parsed = addAttachments.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID', parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');

  const { id } = await ctx.params;
  const task = await prisma.contentTask.findUnique({ where: { id }, select: { brandId: true, status: true } });
  if (!task) return fail(404, 'NOT_FOUND');

  for (const a of parsed.data.attachments) {
    if (!canChangeAttachment(auth.role, a.purpose, task.status)) {
      return fail(403, 'FORBIDDEN', auth.role === 'VIEWER' && a.purpose === 'DELIVERABLE' ? 'ส่งตรวจแล้ว แนบไฟล์เพิ่มไม่ได้' : 'ไม่มีสิทธิ์แนบไฟล์ชนิดนี้');
    }
  }
  const bad = attachmentError(parsed.data.attachments, task.brandId);
  if (bad) return fail(400, 'INVALID', bad);

  await prisma.attachment.createMany({ data: parsed.data.attachments.map((a) => ({ taskId: id, ...attachmentRow(a, auth.role) })) });
  const updated = await prisma.contentTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
  return json(toTaskDTO(updated), 201);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;

  const attId = new URL(req.url).searchParams.get('id');
  if (!attId) return fail(400, 'INVALID', 'ระบุ id ของไฟล์');

  const { id } = await ctx.params;
  const att = await prisma.attachment.findFirst({ where: { id: attId, taskId: id }, include: { task: { select: { status: true } } } });
  if (!att) return fail(404, 'NOT_FOUND');
  if (!canChangeAttachment(auth.role, att.purpose, att.task.status)) return fail(403, 'FORBIDDEN', 'ลบไฟล์นี้ไม่ได้ในสถานะปัจจุบัน');

  await prisma.attachment.delete({ where: { id: att.id } });
  await deleteObject(att.key);
  const updated = await prisma.contentTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
  return json(toTaskDTO(updated));
}
