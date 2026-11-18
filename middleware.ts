// middleware.ts  (แทนไฟล์ middleware เดิมของชุด RBAC)
// ด่านหยาบ: ยังไม่ได้เข้าผ่านประตู → ส่งกลับหน้า Landing ("/")  ส่วนสิทธิ์รายการกระทำตรวจซ้ำใน API เสมอ
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifyRole } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const role = await verifyRole(req.cookies.get(COOKIE)?.value);
  if (role) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/', req.nextUrl));
}

// /api/auth/* และหน้า Landing ("/") ไม่อยู่ใน matcher จึงเข้าได้โดยไม่ต้องมี cookie
export const config = {
  matcher: ['/dashboard/:path*', '/api/tasks/:path*', '/api/uploads/:path*', '/api/files/:path*'],
};
