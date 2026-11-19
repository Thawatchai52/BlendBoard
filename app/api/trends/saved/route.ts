// คลังไอเดีย (เรฟ) — เฉพาะ ADMIN
//   GET                      รายการที่เซฟไว้
//   POST   { videoId }       เซฟคลิปจากรายการเทรนด์ (เก็บสำเนา ไม่หายตามรอบ 7 วัน)
//   DELETE ?videoId=...      เอาออกจากคลัง
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';

export const dynamic = 'force-dynamic';

async function admin() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  return null;
}

export async function GET() {
  const deny = await admin();
  if (deny) return deny;
  const rows = await prisma.savedIdea.findMany({ orderBy: { savedAt: 'desc' }, take: 500 });
  return NextResponse.json({ ideas: rows.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() })) });
}

export async function POST(req: Request) {
  const deny = await admin();
  if (deny) return deny;
  const body = z.object({ videoId: z.string().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  const clip = await prisma.trendClip.findUnique({ where: { videoId: body.data.videoId } });
  if (!clip) return NextResponse.json({ error: 'NOT_FOUND', message: 'ไม่พบคลิปนี้ (อาจหมดรอบ 7 วันแล้ว)' }, { status: 404 });
  const { videoId, url, author, caption, coverUrl, category, views } = clip;
  await prisma.savedIdea.upsert({
    where: { videoId },
    create: { videoId, url, author, caption, coverUrl, category, views },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const deny = await admin();
  if (deny) return deny;
  const videoId = new URL(req.url).searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  await prisma.savedIdea.deleteMany({ where: { videoId } });
  return NextResponse.json({ ok: true });
}
