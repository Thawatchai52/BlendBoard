// lib/api.ts — ตัวช่วยตอบ JSON ของ API Route
import { NextResponse } from 'next/server';
import { getRole } from '@/lib/guard';
import type { Role } from '@/lib/session';

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const fail = (status: number, error: string, reason?: string) => json({ error, ...(reason ? { reason } : {}) }, status);

/** คืน role หรือ Response 401 / 403 (ถ้าระบุ adminOnly) ให้ route ส่งต่อได้เลย */
export async function requireRole(adminOnly = false): Promise<{ role: Role } | { res: Response }> {
  const role = await getRole();
  if (!role) return { res: fail(401, 'UNAUTHENTICATED') };
  if (adminOnly && role !== 'ADMIN') return { res: fail(403, 'FORBIDDEN', 'เฉพาะผู้จัดการตาราง (Admin)') };
  return { role };
}
