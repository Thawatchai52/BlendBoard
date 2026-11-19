// GET /api/trends?category=bakery|drink&sort=views|er — เฉพาะ ADMIN  คลิปในรอบ 7 วันที่ดึงไว้ + เวลาอัปเดตล่าสุด
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { engagementRate, isViral } from '@/lib/metrics';
import { windowStart } from '@/lib/trend-classify';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const q = new URL(req.url).searchParams;
  const cat = q.get('category');
  const rows = await prisma.trendClip.findMany({
    where: { postedAt: { gte: windowStart() }, ...(cat === 'bakery' || cat === 'drink' ? { category: cat } : {}) },
    orderBy: { views: 'desc' },
    take: 200,
  });
  const saved = new Set((await prisma.savedIdea.findMany({ select: { videoId: true } })).map((s) => s.videoId));
  let clips = rows.map((r) => {
    const c = { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves };
    return {
      videoId: r.videoId, url: r.url, author: r.author, caption: r.caption?.slice(0, 200) ?? null, coverUrl: r.coverUrl,
      category: r.category, keyword: r.keyword, views: r.views, er: engagementRate(c), viral: isViral(c),
      postedAt: r.postedAt.toISOString(), saved: saved.has(r.videoId),
    };
  });
  if (q.get('sort') === 'er') clips = clips.sort((a, b) => (b.er ?? -1) - (a.er ?? -1));
  const last = await prisma.trendClip.aggregate({ _max: { fetchedAt: true } });
  return NextResponse.json({ clips, fetchedAt: last._max.fetchedAt?.toISOString() ?? null });
}
