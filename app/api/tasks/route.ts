// GET  /api/tasks?brand=KS&month=2026-11   หรือ  ?from=ISO&to=ISO   (Viewer + Admin อ่านได้)
// POST /api/tasks                          สร้างงาน (Admin เท่านั้น)
import { prisma } from '@/lib/prisma';
import { fail, json, requireRole } from '@/lib/api';
import { taskInclude, toTaskDTO } from '@/lib/task-dto';
import { attachmentError, attachmentRow, createTask } from '@/lib/task-schemas';
import { after } from 'next/server';
import { syncTikTokPosts } from '@/lib/tiktok-sync';

export const maxDuration = 120; // after() รอผู้ให้บริการสถิติได้สูงสุด 120 วินาที

export const dynamic = 'force-dynamic';
const DAY = 86_400_000;

export async function GET(req: Request) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;

  const q = new URL(req.url).searchParams;
  let from: Date, to: Date;
  const month = q.get('month');
  if (month) {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!m) return fail(400, 'INVALID', 'month ต้องเป็น YYYY-MM');
    const y = Number(m[1]), mo = Number(m[2]) - 1;
    // เผื่อ 7 วันหัวท้าย ให้ช่องวันของเดือนก่อน/ถัดไปที่โผล่ในตารางปฏิทินมีงานครบ
    from = new Date(Date.UTC(y, mo, 1) - 7 * DAY);
    to = new Date(Date.UTC(y, mo + 1, 1) + 7 * DAY);
  } else {
    from = new Date(q.get('from') ?? '');
    to = new Date(q.get('to') ?? '');
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return fail(400, 'INVALID', 'ระบุ month หรือ from และ to');
    if (to <= from || to.getTime() - from.getTime() > 100 * DAY) return fail(400, 'INVALID', 'ช่วงวันที่ไม่ถูกต้อง (ไม่เกิน 100 วัน)');
  }

  const brand = q.get('brand');
  if (brand && !/^[A-Za-z0-9_-]{1,20}$/.test(brand)) return fail(400, 'INVALID', 'brand ไม่ถูกต้อง');

  const rows = await prisma.contentTask.findMany({
    where: { publishDate: { gte: from, lt: to }, ...(brand ? { brand: { code: brand.toUpperCase() } } : {}) },
    include: taskInclude,
    orderBy: [{ publishDate: 'asc' }, { position: 'asc' }],
    take: 1000,
  });
  return json(rows.map(toTaskDTO));
}

export async function POST(req: Request) {
  const auth = await requireRole(true);
  if ('res' in auth) return auth.res;

  const parsed = createTask.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID', parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
  const d = parsed.data;

  const brand = await prisma.brand.findUnique({ where: { id: d.brandId }, select: { id: true } });
  if (!brand) return fail(400, 'INVALID', 'ไม่พบแบรนด์');
  const bad = attachmentError(d.attachments, d.brandId);
  if (bad) return fail(400, 'INVALID', bad);
  if (d.status === 'IN_REVIEW' && !d.attachments.some((a) => a.purpose === 'DELIVERABLE')) {
    return fail(400, 'DELIVERABLE_REQUIRED', 'แนบไฟล์หรือลิงก์ส่งงานก่อนส่งตรวจ');
  }

  const task = await prisma.contentTask.create({
    data: {
      title: d.title,
      caption: d.caption ?? null,
      brandId: d.brandId,
      ctype: d.ctype,
      platforms: d.platforms,
      status: d.status,
      publishDate: new Date(d.publishDate),
      briefDueAt: d.briefDueAt ? new Date(d.briefDueAt) : null,
      submittedAt: d.status === 'IN_REVIEW' ? new Date() : null,
      attachments: { create: d.attachments.map((a) => attachmentRow(a, 'ADMIN')) },
      history: { create: { toStatus: d.status, actorRole: 'ADMIN' } },
    },
    include: taskInclude,
  });
  after(() => syncTikTokPosts(task.id)); // ลิงก์ TikTok ในไฟล์ส่งงาน → ดึงสถิติหลังตอบผู้ใช้
  return json(toTaskDTO(task), 201);
}
