// POST /api/tiktok/submit  { url }  — ฝั่งคนส่งงาน (VIEWER หรือ ADMIN) แปะลิงก์แล้วส่งเข้า DB
import { after, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { parseTikTokUrl } from '@/lib/tiktok-url';
import { refreshPost } from '@/lib/tiktok-service';

export const maxDuration = 120; // รอผู้ให้บริการได้สูงสุด 120 วินาที (ปรับตามแพ็กเกจโฮสต์)

const Body = z.object({ url: z.string().min(8).max(300) });

export async function POST(req: Request) {
  if (!(await getRole())) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID', message: 'กรุณาวางลิงก์ TikTok' }, { status: 400 });

  const parsed = parseTikTokUrl(body.data.url);
  if (!parsed.ok) return NextResponse.json({ error: 'INVALID', message: parsed.reason }, { status: 400 });

  // ลิงก์ซ้ำ (url เดียวกัน หรือ videoId เดียวกัน) → ไม่สร้างใหม่ ไม่เสียเครดิตดึงซ้ำ
  const existing = await prisma.tikTokPost.findFirst({
    where: { OR: [{ url: parsed.url }, ...(parsed.videoId ? [{ videoId: parsed.videoId }] : [])] },
    select: { id: true, status: true },
  });
  if (existing) return NextResponse.json({ id: existing.id, status: existing.status, duplicate: true }, { status: 200 });

  try {
    const post = await prisma.tikTokPost.create({
      data: { url: parsed.url, videoId: parsed.videoId },
      select: { id: true, status: true },
    });
    // ตอบผู้ใช้ทันที แล้วค่อยไปดึงสถิติหลังส่งคำตอบ (ถ้าไม่สำเร็จ cron จะลองใหม่)
    after(() => refreshPost(post.id));
    return NextResponse.json({ id: post.id, status: post.status }, { status: 202 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ duplicate: true }, { status: 200 }); // 2 คนส่งพร้อมกัน
    }
    throw e;
  }
}
