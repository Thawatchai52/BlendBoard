// POST /api/tiktok/posts/:id/refresh — ADMIN กดดึงสถิติใหม่ (พักอย่างน้อย 10 นาทีต่อคลิป กันกดรัวเสียเครดิต)
import { after, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { refreshPost } from '@/lib/tiktok-service';

export const maxDuration = 120;
const COOLDOWN_MS = 10 * 60 * 1000;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await ctx.params;
  const post = await prisma.tikTokPost.findUnique({ where: { id }, select: { status: true, lastFetchedAt: true, updatedAt: true } });
  if (!post) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (post.status === 'FETCHING') return NextResponse.json({ status: 'FETCHING' }, { status: 202 });

  const last = post.lastFetchedAt ?? post.updatedAt;
  if (post.status === 'OK' && Date.now() - last.getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'COOLDOWN', message: 'เพิ่งอัปเดตไป รอสักครู่แล้วลองใหม่' }, { status: 429 });
  }

  after(() => refreshPost(id));
  return NextResponse.json({ status: 'FETCHING' }, { status: 202 });
}
