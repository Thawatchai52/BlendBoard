// middleware.ts
// ด่านหยาบ: ล็อกอินหรือยัง / เข้าโซน admin ได้ไหม  (ตัวตัดสินจริงคือ API ไม่ใช่ไฟล์นี้)
// ตัวอย่างใช้ Auth.js v5 ถ้าใช้ Supabase Auth ให้เปลี่ยนส่วนอ่าน session ตามเอกสารของมัน
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PUBLIC = ['/login', '/forbidden', '/api/auth'];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const user = req.auth?.user as
    | { id: string; isSuperAdmin?: boolean; canManageAny?: boolean } // canManageAny = มี MANAGER/ADMIN อย่างน้อย 1 แบรนด์
    | undefined;

  // 1) ยังไม่ล็อกอิน
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }
    const url = new URL('/login', req.nextUrl);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  // 2) โซนจัดการ: ต้องเป็น Manager/Admin อย่างน้อย 1 แบรนด์ (รายแบรนด์ตรวจซ้ำใน Server Component)
  if (pathname.startsWith('/admin') && !(user.isSuperAdmin || user.canManageAny)) {
    return NextResponse.redirect(new URL('/forbidden', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
