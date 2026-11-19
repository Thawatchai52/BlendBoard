// lib/providers/apify-trends.ts — ดึงคลิปตามแฮชแท็กผ่าน Apify Actor (run-sync-get-dataset-items)
//
// Actor ที่ออกแบบไว้: clockworks/tiktok-scraper (ใส่เป็น  clockworks~tiktok-scraper)
//   input  : hashtags[] (มีหรือไม่มี # ก็ได้), resultsPerPage      — ตรงกับเอกสาร input schema บนหน้า Apify
//   output : webVideoUrl, videoMeta.coverUrl, playCount, diggCount, shareCount, collectCount, commentCount,
//            createTimeISO, authorMeta.name, text                  — ตรงกับตัวอย่างผลลัพธ์ในเอกสาร
// ⚠️ ตรวจจากเอกสารสาธารณะเท่านั้น ยังไม่ได้รันกับบัญชี Apify จริง ลองดึง 1 คีย์เวิร์ดก่อนแล้วเช็กว่าการ์ดขึ้นครบ
// (ตัวกรองวันที่ของ Actor คิดเงินเพิ่ม จึงไม่ใช้ แต่กรอง 7 วันเองฝั่งเรา)
//   env: APIFY_TOKEN, APIFY_TREND_ACTOR, APIFY_TREND_FIELD (ค่าเริ่มต้น hashtags), APIFY_TREND_LIMIT (ต่อแฮชแท็ก, ค่าเริ่มต้น 20)
import { ProviderError } from './types';
import { mapItem } from './apify';

type Item = Record<string, unknown>;

export interface TrendItem {
  videoId: string;
  url: string;
  author: string | null;
  caption: string | null;
  coverUrl: string | null;
  views: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  postedAt: Date;
  keyword: string;
}

const obj = (v: unknown): Item | null => (v && typeof v === 'object' ? (v as Item) : null);
const httpsUrl = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//i.test(v) ? v.slice(0, 1000) : null);

/** แปลงผลลัพธ์ 1 รายการ → TrendItem; ข้ามรายการที่ไม่มีไอดี/ลิงก์/ยอดวิว/วันที่โพสต์ */
export function mapTrendItem(item: Item, keyword: string): TrendItem | null {
  const s = mapItem(item);
  const meta = obj(item.videoMeta);
  const url = httpsUrl(item.webVideoUrl) ?? httpsUrl(item.url);
  if (!s.videoId || !url || s.views == null || !s.postedAt) return null;
  // ลิงก์ต้องเป็นโดเมน TikTok เท่านั้น (กันผลลัพธ์แปลกปลอมถูกเอาไปแสดงเป็นลิงก์กดออก)
  try {
    if (!/(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) return null;
  } catch {
    return null;
  }
  return {
    videoId: s.videoId,
    url,
    author: s.authorHandle,
    caption: s.caption,
    coverUrl: httpsUrl(meta?.coverUrl) ?? httpsUrl(meta?.originalCoverUrl) ?? httpsUrl(item.cover),
    views: s.views,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    saves: s.saves,
    postedAt: s.postedAt,
    keyword,
  };
}

export async function fetchTrending(keywords: string[]): Promise<TrendItem[]> {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_TREND_ACTOR;
  const field = process.env.APIFY_TREND_FIELD ?? 'hashtags';
  const limit = Math.min(50, Math.max(1, Number(process.env.APIFY_TREND_LIMIT) || 20));
  if (!token || !actor) throw new ProviderError('ยังไม่ได้ตั้งค่า APIFY_TOKEN / APIFY_TREND_ACTOR', false);

  const out = new Map<string, TrendItem>();
  // ยิงทีละคีย์เวิร์ด เพื่อรู้ว่าคลิปมาจากคำไหน และถ้าคำหนึ่งพังอีกคำยังได้ผล
  for (const kw of keywords) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: [kw], resultsPerPage: limit }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ProviderError(e instanceof Error && e.name === 'AbortError' ? 'ผู้ให้บริการตอบช้าเกินไป' : 'เชื่อมต่อผู้ให้บริการไม่ได้', true);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError('Token ผู้ให้บริการไม่ถูกต้องหรือหมดสิทธิ์', false);
    if (res.status === 402) throw new ProviderError('เครดิตผู้ให้บริการหมด', false);
    if (!res.ok) throw new ProviderError(`ผู้ให้บริการตอบกลับ ${res.status}`, res.status === 408 || res.status === 429 || res.status >= 500);

    const data: unknown = await res.json().catch(() => null);
    if (!Array.isArray(data)) continue;
    for (const raw of data) {
      const it = obj(raw) ? mapTrendItem(raw as Item, kw) : null;
      if (it && !out.has(it.videoId)) out.set(it.videoId, it);
    }
  }
  return [...out.values()];
}
