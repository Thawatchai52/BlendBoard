// lib/tiktok-sync.ts — ลิงก์ TikTok ที่คนส่งงานแปะในช่อง "ไฟล์ส่งงาน" ของแต่ละงาน → สร้างรายการสถิติ + สั่งดึง
// ไม่มีฟอร์มแยก: เรียกหลังบันทึกงาน/แนบลิงก์ (ผ่าน after()) และจากงานตั้งเวลา (cron) เป็นตาข่ายรองรับ
import { prisma } from '@/lib/prisma';
import { parseTikTokUrl } from '@/lib/tiktok-url';
import { refreshPost } from '@/lib/tiktok-service';

/**
 * สร้างแถว TikTokPost ให้ทุกลิงก์ TikTok (ไฟล์ส่งงาน) ที่ยังไม่มี แล้วดึงสถิติของแถวใหม่
 * taskId ไม่ระบุ = ตรวจทุกงาน (cron). ไม่ throw ออกไปหาผู้เรียก
 */
export async function syncTikTokPosts(taskId?: string): Promise<number> {
  try {
    const atts = await prisma.attachment.findMany({
      where: { kind: 'LINK', purpose: 'DELIVERABLE', tiktok: null, ...(taskId ? { taskId } : {}), url: { contains: 'tiktok.com' } },
      select: { id: true, taskId: true, url: true },
      take: 200,
    });
    const created: string[] = [];
    for (const a of atts) {
      const p = a.url ? parseTikTokUrl(a.url) : null;
      if (!p || !p.ok) continue;
      try {
        const row = await prisma.tikTokPost.create({
          data: { attachmentId: a.id, taskId: a.taskId, url: p.url, videoId: p.videoId },
          select: { id: true },
        });
        created.push(row.id);
      } catch {
        // attachmentId ซ้ำ (เรียกซ้อนกัน 2 ครั้ง) หรือถูกลบไปแล้ว → ข้าม
      }
    }
    // ดึงทีละ 3 (ผู้ให้บริการคิดเครดิตตามจำนวนครั้ง และกันยิงพร้อมกันเกิน)
    for (let i = 0; i < created.length; i += 3) {
      await Promise.all(created.slice(i, i + 3).map((id) => refreshPost(id)));
    }
    return created.length;
  } catch (e) {
    console.error('[tiktok-sync]', e);
    return 0;
  }
}
