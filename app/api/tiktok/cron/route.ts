// GET /api/tiktok/cron — งานตั้งเวลา (Vercel Cron / GitHub Actions / cron ภายนอก)
// ต้องส่ง  Authorization: Bearer $CRON_SECRET  (Vercel Cron ใส่ให้เองเมื่อกำหนด env CRON_SECRET)
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS, refreshPost } from '@/lib/tiktok-service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000; // อัปเดตยอดคลิปที่ดึงสำเร็จแล้วทุก 6 ชั่วโมง
const TRACK_FOR_MS = 30 * 24 * 60 * 60 * 1000; // ติดตามต่อ 30 วันหลังส่ง หลังจากนั้นหยุด (ประหยัดเครดิต)
const RETRY_FAILED_AFTER_MS = 30 * 60 * 1000;
const STUCK_AFTER_MS = 10 * 60 * 1000; // FETCHING ค้างเกิน 10 นาที = งานตายกลางทาง
const BATCH = 30;
const CONCURRENCY = 3;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const now = Date.now();
  // คืนสถานะงานที่ค้างให้กลับมาลองได้
  await prisma.tikTokPost.updateMany({
    where: { status: 'FETCHING', updatedAt: { lt: new Date(now - STUCK_AFTER_MS) } },
    data: { status: 'FAILED', error: 'งานค้าง ลองใหม่อัตโนมัติ' },
  });

  const due = await prisma.tikTokPost.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'OK', lastFetchedAt: { lt: new Date(now - REFRESH_AFTER_MS) }, submittedAt: { gt: new Date(now - TRACK_FOR_MS) } },
        { status: 'FAILED', attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: new Date(now - RETRY_FAILED_AFTER_MS) } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });

  let ok = 0;
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const results = await Promise.all(due.slice(i, i + CONCURRENCY).map((p) => refreshPost(p.id)));
    ok += results.filter(Boolean).length;
  }
  return NextResponse.json({ picked: due.length, ok, failed: due.length - ok });
}
