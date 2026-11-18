// app/api/auth/enter/route.ts
// เช็ครหัสผ่านฝั่งเซิร์ฟเวอร์ แล้วตั้ง cookie (httpOnly + เซ็นลายเซ็น)
// รหัสผ่านอยู่ในโค้ดฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ถูกส่งไปกับ JavaScript ที่เบราว์เซอร์โหลด
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { COOKIE, SESSION_HOURS, signRole } from '@/lib/session';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '202325'; // Hardcode ตามที่กำหนด / แนะนำให้ย้ายไป .env ภายหลัง

/* กันเดารหัส: ผิดครบ 5 ครั้งจาก IP เดียว รอ 60 วินาที
   (เก็บในหน่วยความจำ ใช้ได้กับเซิร์ฟเวอร์เดียว ถ้าใช้ serverless ให้ย้ายไป Redis/Upstash) */
const fails = new Map<string, { n: number; until: number }>();

function checkPassword(input: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { role?: string; password?: string } | null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  let role: 'VIEWER' | 'ADMIN';

  if (body?.role === 'VIEWER') {
    role = 'VIEWER'; // ไม่ต้องใช้รหัสผ่าน
  } else if (body?.role === 'ADMIN') {
    const f = fails.get(ip);
    if (f && f.n >= 5 && f.until > Date.now()) {
      return NextResponse.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
    }
    if (!checkPassword(String(body.password ?? ''))) {
      const n = (f && f.until > Date.now() ? f.n : 0) + 1;
      fails.set(ip, { n, until: Date.now() + 60_000 });
      return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 401 });
    }
    fails.delete(ip);
    role = 'ADMIN';
  } else {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(COOKIE, await signRole(role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}

/** ออกจากระบบ */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
