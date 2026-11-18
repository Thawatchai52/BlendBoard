// lib/metrics.ts — สูตรคำนวณล้วน ๆ (ไม่ยุ่ง DB/เครือข่าย) เทสต์ได้ตรง ๆ
// ER = (Likes + Comments + Shares + Saves) / Views × 100

export const VIRAL_MIN_ER_PCT = 10; // ER >= 10 %
export const VIRAL_MIN_VIEWS = 50_000; // Views >= 50,000
export const VIRAL_BADGE = '🔥 แมสแตก!';

export interface Counts {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export function interactions(c: Counts): number {
  return (c.likes ?? 0) + (c.comments ?? 0) + (c.shares ?? 0) + (c.saves ?? 0);
}

/** ER เป็นเปอร์เซ็นต์ ปัด 2 ตำแหน่ง; ไม่มี/ศูนย์ view → null (กันหารศูนย์) */
export function engagementRate(c: Counts): number | null {
  if (c.views == null || c.views <= 0) return null;
  return Math.round(((interactions(c) * 100) / c.views) * 100) / 100;
}

/**
 * ติดป้ายแมสเมื่อ ER >= 10% และ Views >= 50,000
 * เทียบด้วยจำนวนเต็ม (interactions*100 >= views*10) ไม่ใช้ทศนิยม
 * กัน 5,000/50,000 ที่ต้องได้ 10% เป๊ะ ไม่หลุดเป็น 9.999…
 */
export function isViral(c: Counts): boolean {
  if (c.views == null || c.views < VIRAL_MIN_VIEWS) return false;
  return interactions(c) * 100 >= c.views * VIRAL_MIN_ER_PCT;
}

/** true = ผู้ให้บริการไม่ส่งยอด Saves มา ER จึงต่ำกว่าความจริง (แสดงเป็น ~) */
export function isErPartial(c: Counts): boolean {
  return c.saves == null;
}
