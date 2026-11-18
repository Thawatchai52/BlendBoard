// lib/guard.ts — เช็ก role จาก cookie ที่เซิร์ฟเวอร์เซ็น (ชุดเดียวกับหน้า Landing 2 ประตู)
// /api/tiktok/* ไม่อยู่ใน matcher ของ middleware จึงเช็กเองในทุก route
import { cookies } from 'next/headers';
import { COOKIE, verifyRole, type Role } from '@/lib/session';

export async function getRole(): Promise<Role | null> {
  return verifyRole((await cookies()).get(COOKIE)?.value);
}
