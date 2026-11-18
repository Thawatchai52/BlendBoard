// lib/tiktok-service.ts — ดึงสถิติของ 1 โพสต์ แล้วบันทึกลง DB (ใช้ร่วมกันทั้ง submit / refresh / cron)
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { engagementRate, isErPartial, isViral } from '@/lib/metrics';
import { ApifyProvider } from '@/lib/providers/apify';
import { ProviderError, type StatsProvider } from '@/lib/providers/types';

// สลับผู้ให้บริการที่นี่จุดเดียว (เพิ่ม adapter ใหม่ใน lib/providers/ แล้วเลือกด้วย env)
export function getProvider(): StatsProvider {
  switch (process.env.TIKTOK_PROVIDER ?? 'apify') {
    case 'apify':
      return new ApifyProvider();
    default:
      throw new ProviderError('TIKTOK_PROVIDER ไม่รู้จัก', false);
  }
}

export const MAX_ATTEMPTS = 5;

/** ดึง + บันทึก 1 โพสต์ ไม่ throw (สถานะความล้มเหลวเก็บใน DB) คืน true เมื่อสำเร็จ */
export async function refreshPost(id: string): Promise<boolean> {
  // ล็อกด้วย updateMany: ถ้ามีงานอื่นกำลังดึงโพสต์นี้อยู่ (FETCHING) จะได้ count = 0 แล้วข้าม
  const claimed = await prisma.tikTokPost.updateMany({
    where: { id, status: { in: ['PENDING', 'OK', 'FAILED'] } },
    data: { status: 'FETCHING' },
  });
  if (claimed.count === 0) return false;

  const post = await prisma.tikTokPost.findUniqueOrThrow({ where: { id } });
  try {
    const s = await getProvider().fetchStats(post.url);
    const now = new Date();
    const counts = { views: s.views, likes: s.likes, comments: s.comments, shares: s.shares, saves: s.saves };

    try {
      await prisma.$transaction([
        prisma.tikTokPost.update({
          where: { id },
          data: {
            ...counts,
            status: 'OK',
            error: null,
            attempts: 0,
            lastFetchedAt: now,
            videoId: post.videoId ?? s.videoId,
            authorHandle: s.authorHandle ?? post.authorHandle,
            caption: s.caption ?? post.caption,
            postedAt: s.postedAt ?? post.postedAt,
          },
        }),
        prisma.tikTokSnapshot.create({ data: { postId: id, takenAt: now, ...counts } }),
      ]);
    } catch (e) {
      // ลิงก์สั้นไปตรงกับคลิปที่มีอยู่แล้ว (videoId ซ้ำ) → ลบแถวใหม่ทิ้ง เหลือแถวเดิมแถวเดียว
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        await prisma.tikTokPost.delete({ where: { id } });
        return true;
      }
      throw e;
    }
    return true;
  } catch (e) {
    const msg = e instanceof ProviderError ? e.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
    const retryable = e instanceof ProviderError ? e.retryable : true;
    await prisma.tikTokPost.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: msg,
        // ข้อผิดพลาดแบบแก้ไม่ได้ (คลิปถูกลบ ตั้งค่าผิด) ให้นับเต็มทันที cron จะไม่ยิงซ้ำให้เสียเครดิต
        attempts: retryable ? { increment: 1 } : MAX_ATTEMPTS,
      },
    });
    return false;
  }
}

/** แปลงแถว DB → JSON สำหรับหน้า Dashboard (ER และป้ายคำนวณตอนอ่าน แก้เกณฑ์แล้วมีผลย้อนหลังทันที) */
export function toDTO(p: Prisma.TikTokPostGetPayload<object>) {
  const counts = { views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves };
  return {
    id: p.id,
    url: p.url,
    status: p.status,
    error: p.error,
    ...counts,
    er: engagementRate(counts),
    erPartial: isErPartial(counts) && p.views != null,
    viral: isViral(counts),
    authorHandle: p.authorHandle,
    caption: p.caption ? p.caption.slice(0, 140) : null,
    postedAt: p.postedAt?.toISOString() ?? null,
    submittedAt: p.submittedAt.toISOString(),
    lastFetchedAt: p.lastFetchedAt?.toISOString() ?? null,
  };
}
export type TikTokPostDTO = ReturnType<typeof toDTO>;
