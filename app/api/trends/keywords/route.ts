// GET /api/trends/keywords — รายการคีย์เวิร์ด  PUT { keywords: string[] } — แทนที่ทั้งชุด (เฉพาะ ADMIN)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/guard';
import { DEFAULT_KEYWORDS, MAX_KEYWORDS, normalizeKeyword } from '@/lib/trend-classify';

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
  const rows = await prisma.trendKeyword.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ keywords: rows.length ? rows.map((r) => r.term) : DEFAULT_KEYWORDS });
}

const Body = z.object({ keywords: z.array(z.string().max(60)).max(MAX_KEYWORDS) });

export async function PUT(req: Request) {
  const deny = await admin();
  if (deny) return deny;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID', message: `ส่งได้สูงสุด ${MAX_KEYWORDS} คีย์เวิร์ด` }, { status: 400 });
  const terms: string[] = [];
  for (const raw of body.data.keywords) {
    const r = normalizeKeyword(raw);
    if (!r.ok) return NextResponse.json({ error: 'INVALID', message: `"${raw}": ${r.reason}` }, { status: 400 });
    if (!terms.includes(r.term)) terms.push(r.term);
  }
  await prisma.$transaction([
    prisma.trendKeyword.deleteMany({}),
    prisma.trendKeyword.createMany({ data: terms.map((term, i) => ({ term, createdAt: new Date(Date.now() + i) })) }),
  ]);
  return NextResponse.json({ keywords: terms });
}
