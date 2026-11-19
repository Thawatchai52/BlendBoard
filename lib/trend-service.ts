// lib/trend-service.ts — ดึงเทรนด์ → กรอง 7 วัน → จัดหมวด → เก็บลง DB
import { prisma } from '@/lib/prisma';
import { fetchTrending } from '@/lib/providers/apify-trends';
import { ProviderError } from '@/lib/providers/types';
import { classifyClip, windowStart } from '@/lib/trend-classify';

export const REFRESH_COOLDOWN_MS = 30 * 60 * 1000; // กันกดรัวเสียเครดิต

export type RefreshResult = { ok: true; kept: number; dropped: number } | { ok: false; message: string };

export async function refreshTrends(keywords: string[]): Promise<RefreshResult> {
  try {
    const since = windowStart();
    const items = await fetchTrending(keywords);
    let dropped = 0;
    const rows = [];
    for (const it of items) {
      const category = classifyClip(it.caption);
      if (!category || it.postedAt < since) {
        dropped++;
        continue;
      }
      rows.push({ ...it, category });
    }
    for (const r of rows) {
      await prisma.trendClip.upsert({
        where: { videoId: r.videoId },
        create: { ...r },
        update: { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves, coverUrl: r.coverUrl, fetchedAt: new Date() },
      });
    }
    await prisma.trendClip.deleteMany({ where: { postedAt: { lt: since } } });
    return { ok: true, kept: rows.length, dropped };
  } catch (e) {
    return { ok: false, message: e instanceof ProviderError ? e.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}
