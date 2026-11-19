// POST /api/trends/refresh — ADMIN สั่งดึงเทรนด์ใหม่ตามคีย์เวิร์ดที่ตั้งไว้ (พัก 30 นาที กันเสียเครดิต)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { DEFAULT_KEYWORDS } from '@/lib/trend-classify';
import { REFRESH_COOLDOWN_MS, refreshTrends } from '@/lib/trend-service';

export const maxDuration = 300; // ดึงทีละคีย์เวิร์ด ถ้าตั้งคีย์เวิร์ดเยอะอาจใกล้เพดานนี้ (ปรับตามแพ็กเกจโฮสต์)
export const dynamic = 'force-dynamic';

export async function POST() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const last = (await prisma.trendClip.aggregate({ _max: { fetchedAt: true } }))._max.fetchedAt;
  if (last && Date.now() - last.getTime() < REFRESH_COOLDOWN_MS) {
    return NextResponse.json({ error: 'COOLDOWN', message: 'เพิ่งดึงไปเมื่อสักครู่ รอ 30 นาทีแล้วลองใหม่' }, { status: 429 });
  }
  const kws = (await prisma.trendKeyword.findMany({ orderBy: { createdAt: 'asc' } })).map((k) => k.term);
  const result = await refreshTrends(kws.length ? kws : DEFAULT_KEYWORDS);
  if (!result.ok) return NextResponse.json({ error: 'PROVIDER', message: result.message }, { status: 502 });
  return NextResponse.json(result);
}
