// lib/tiktok-url.ts — ตรวจและ normalize ลิงก์ TikTok ก่อนลง DB / ส่งให้ผู้ให้บริการ
// ไม่มี fetch ฝั่งเซิร์ฟเวอร์ที่นี่ (กัน SSRF) แค่ allowlist โดเมน + ตัด query/hash ทิ้ง

const HOST = /^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com$/i;
const VIDEO_ID = /\/(?:video|photo|v)\/(\d{6,25})(?:\.html)?(?:\/|$)/;

export type ParsedUrl =
  | { ok: true; url: string; videoId: string | null }
  | { ok: false; reason: string };

/** โดเมนเป็นของ TikTok ไหม (ใช้แยกลิงก์ TikTok ออกจากลิงก์ส่งงานทั่วไป) */
export function isTikTokHost(input: string): boolean {
  try {
    return HOST.test(new URL(input).hostname);
  } catch {
    return false;
  }
}

export function parseTikTokUrl(input: string): ParsedUrl {
  let raw = (input ?? '').trim();
  if (!raw) return { ok: false, reason: 'กรุณาวางลิงก์ TikTok' };
  if (raw.length > 300) return { ok: false, reason: 'ลิงก์ยาวเกินไป' };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'รูปแบบลิงก์ไม่ถูกต้อง' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'รองรับเฉพาะลิงก์ https' };
  if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) {
    return { ok: false, reason: 'ลิงก์ไม่ถูกต้อง' };
  }
  if (!HOST.test(u.hostname)) return { ok: false, reason: 'ต้องเป็นลิงก์จาก tiktok.com เท่านั้น' };

  const path = u.pathname.replace(/\/+$/, '');
  const m = VIDEO_ID.exec(path + '/');
  const isShort = /^(?:vm|vt)\./i.test(u.hostname) || /^\/t\/[\w-]+$/.test(path);
  if (!m && !isShort) return { ok: false, reason: 'ไม่ใช่ลิงก์คลิป TikTok (ต้องมี /video/เลขไอดี หรือเป็นลิงก์แชร์แบบสั้น)' };
  if (isShort && path.length < 2) return { ok: false, reason: 'ลิงก์แชร์ไม่ครบ' };

  // ลิงก์ที่มีไอดีคลิป → ใช้โดเมนมาตรฐาน www.tiktok.com ลิงก์แชร์แบบสั้นคงโดเมนเดิม (vm./vt.)
  const host = m ? 'www.tiktok.com' : u.hostname.toLowerCase();
  // query/hash ตัดทิ้ง ลิงก์เดียวกันจากปุ่มแชร์ที่ต่าง ?is_from_webapp=... จะได้ซ้ำกันจริง
  return { ok: true, url: `https://${host}${path}`, videoId: m ? m[1] : null };
}
