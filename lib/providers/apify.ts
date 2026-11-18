// lib/providers/apify.ts — ดึงสถิติคลิปผ่าน Apify Actor (เรียกแบบ run-sync-get-dataset-items)
//
// ใช้ได้กับ Actor ที่รับ "ลิงก์คลิป" แล้วคืน playCount/diggCount/commentCount/shareCount/collectCount
// (หรือชื่อสั้น views/likes/comments/shares/saves) ชื่อช่อง input ต่างกันตาม Actor จึงตั้งผ่าน env
//   APIFY_TOKEN, APIFY_TIKTOK_ACTOR (รูปแบบ  user~actor-name), APIFY_URL_FIELD (เช่น postURLs หรือ videoUrls)
// ตรวจชื่อ field จริงของ Actor ที่เลือกก่อนใช้งาน และลองกับลิงก์จริง 10–20 ลิงก์
import { ProviderError, type RawStats, type StatsProvider } from './types';

type Item = Record<string, unknown>;

function pick(item: Item, keys: string[]): unknown {
  for (const k of keys) {
    const v = item[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Math.round(Number(v));
  return null;
}

function str(v: unknown, max = 500): string | null {
  return typeof v === 'string' && v ? v.slice(0, max) : null;
}

function date(v: unknown): Date | null {
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v); // epoch วินาทีหรือมิลลิวินาที
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function mapItem(item: Item): RawStats {
  const author = (item.authorMeta ?? item.author) as Item | string | undefined;
  const handle =
    typeof author === 'string'
      ? author
      : author && typeof author === 'object'
        ? str(pick(author, ['name', 'uniqueId', 'username']), 80)
        : str(pick(item, ['authorUsername', 'authorHandle']), 80);
  return {
    videoId: str(pick(item, ['videoId', 'id']), 30),
    views: num(pick(item, ['playCount', 'views'])),
    likes: num(pick(item, ['diggCount', 'likes'])),
    comments: num(pick(item, ['commentCount', 'comments'])),
    shares: num(pick(item, ['shareCount', 'shares'])),
    saves: num(pick(item, ['collectCount', 'saves', 'bookmarks'])),
    authorHandle: handle,
    caption: str(pick(item, ['text', 'description', 'caption'])),
    postedAt: date(pick(item, ['createTime', 'createdAt', 'createTimeISO'])),
  };
}

export class ApifyProvider implements StatsProvider {
  async fetchStats(url: string): Promise<RawStats> {
    const token = process.env.APIFY_TOKEN;
    const actor = process.env.APIFY_TIKTOK_ACTOR;
    const field = process.env.APIFY_URL_FIELD ?? 'postURLs';
    if (!token || !actor) throw new ProviderError('ยังไม่ได้ตั้งค่า APIFY_TOKEN / APIFY_TIKTOK_ACTOR', false);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: [url] }),
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
    const item = Array.isArray(data) ? (data[0] as Item | undefined) : undefined;
    if (!item) throw new ProviderError('ไม่พบข้อมูลคลิปนี้ (อาจถูกลบหรือเป็นส่วนตัว)', false);
    if (item.error) throw new ProviderError(`ดึงข้อมูลไม่สำเร็จ: ${String(item.error).slice(0, 200)}`, false);

    const stats = mapItem(item);
    if (stats.views == null) throw new ProviderError('ผลลัพธ์ไม่มียอดวิว ตรวจชื่อฟิลด์ของ Actor', false);
    return stats;
  }
}
