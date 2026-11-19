// lib/trend-classify.ts — ตรรกะล้วน ๆ ของ Trend Radar (ไม่ยุ่ง DB/เครือข่าย เทสต์ได้ตรง ๆ)
export const TREND_WINDOW_DAYS = 7;
export const MAX_KEYWORDS = 12;
export const DEFAULT_KEYWORDS = ['เบเกอรี่', 'ขนมปัง', 'คาเฟ่', 'เครื่องดื่ม', 'อร่อยบอกต่อ'];

export type TrendCategory = 'bakery' | 'drink';

/** คำที่ใช้จัดหมวด (แก้ได้ตามแบรนด์) */
export const CATEGORY_WORDS: Record<TrendCategory, string[]> = {
  bakery: ['เบเกอรี่', 'ขนมปัง', 'ครัวซองต์', 'เค้ก', 'โดนัท', 'คุกกี้', 'ทาร์ต', 'เบเกิล', 'สโคน', 'มัฟฟิน', 'บราวนี่', 'ขนมอบ', 'อบใหม่', 'bakery', 'croissant', 'bread'],
  drink: ['เครื่องดื่ม', 'ชานม', 'กาแฟ', 'ลาเต้', 'มัทฉะ', 'โกโก้', 'น้ำผึ้งมะนาว', 'สมูทตี้', 'โซดา', 'ชาเย็น', 'เอสเปรสโซ', 'ชาส้ม', 'น้ำปั่น', 'coffee', 'latte', 'matcha'],
};

/** นับคำตรงของแต่ละหมวด หมวดที่ได้มากกว่าชนะ (เท่ากัน = เบเกอรี่) ไม่ตรงเลย = null (ตัดทิ้ง) */
export function classifyClip(text: string | null | undefined): TrendCategory | null {
  const t = (text ?? '').toLowerCase();
  const score = (words: string[]) => words.filter((w) => t.includes(w.toLowerCase())).length;
  const b = score(CATEGORY_WORDS.bakery);
  const d = score(CATEGORY_WORDS.drink);
  if (!b && !d) return null;
  return b >= d ? 'bakery' : 'drink';
}

export type KeywordResult = { ok: true; term: string } | { ok: false; reason: string };

/** ตัด # และช่องว่าง ตรวจความยาว/อักขระ (กันยัดอักขระแปลกเข้า input ของ Actor) */
export function normalizeKeyword(raw: string): KeywordResult {
  const term = (raw ?? '').replace(/^[#\s]+/, '').trim().replace(/\s+/g, '');
  if (!term) return { ok: false, reason: 'พิมพ์คีย์เวิร์ดก่อน' };
  if (term.length > 30) return { ok: false, reason: 'ยาวเกิน 30 ตัวอักษร' };
  if (!/^[\w฀-๿.]+$/.test(term)) return { ok: false, reason: 'ใช้ได้เฉพาะตัวอักษร ตัวเลข และจุด' };
  return { ok: true, term };
}

export function windowStart(now = Date.now()): Date {
  return new Date(now - TREND_WINDOW_DAYS * 86_400_000);
}
