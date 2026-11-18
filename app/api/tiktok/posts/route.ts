// GET /api/tiktok/posts — เฉพาะ ADMIN
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { toDTO } from '@/lib/tiktok-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const rows = await prisma.tikTokPost.findMany({ orderBy: { submittedAt: 'desc' }, take: 500 });
  return NextResponse.json({ posts: rows.map(toDTO) });
}
