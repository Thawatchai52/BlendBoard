// GET /api/tiktok/posts — เฉพาะ ADMIN  (แต่ละแถว = 1 ลิงก์ TikTok ที่ส่งในช่องไฟล์ส่งงานของงานหนึ่ง)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { postInclude, toDTO } from '@/lib/tiktok-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const rows = await prisma.tikTokPost.findMany({ include: postInclude, orderBy: { submittedAt: 'desc' }, take: 500 });
  return NextResponse.json({ posts: rows.map(toDTO) });
}
