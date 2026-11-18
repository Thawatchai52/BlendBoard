// /dashboard/calendar — ปฏิทิน + Kanban (อ่านแบรนด์จาก DB แล้วส่งให้คอมโพเนนต์)
import { prisma } from '@/lib/prisma';
import { ContentDashboard } from '@/components/dashboard/ContentDashboard';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const brands = await prisma.brand.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, color: true } });
  if (brands.length === 0) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <p className="font-head text-xl font-semibold">ยังไม่มีแบรนด์ในฐานข้อมูล</p>
        <p className="mt-2 text-sm text-muted">
          รัน <code>npx prisma db seed</code> เพื่อสร้างแบรนด์ Kudsan (KS) และ Bellinee&apos;s (BL)
        </p>
      </main>
    );
  }
  return <ContentDashboard brands={brands} />;
}
