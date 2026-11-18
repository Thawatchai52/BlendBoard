// หน้าแรกหลังเข้าสู่ระบบ — ตอนนี้เป็นหน้าทางเข้า (ปฏิทิน/Kanban ต้องมี API /api/tasks ก่อน ดู README)
import Link from 'next/link';
import { getRole } from '@/lib/guard';
import { LogoutButton } from '@/components/role-store';

export default async function DashboardHome() {
  const role = await getRole();
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-head text-2xl font-semibold">{role === 'ADMIN' ? 'จัดการตาราง' : 'ตารางคอนเทนต์'}</h1>
        <LogoutButton className="rounded-brand border border-line px-3 py-1.5 text-sm hover:bg-surface-2" />
      </header>

      {role === 'ADMIN' && (
        <Link href="/dashboard/tiktok" className="rounded-brand border border-line bg-surface p-5 hover:bg-surface-2">
          <p className="font-head text-lg font-semibold">สถิติคลิป TikTok</p>
          <p className="mt-1 text-sm text-muted">ยอดวิว ER และป้าย 🔥 แมสแตก!</p>
        </Link>
      )}

      <p className="rounded-brand border border-dashed border-line p-5 text-sm text-muted">
        ปฏิทินและ Kanban ยังไม่เชื่อมฐานข้อมูลในโปรเจกต์นี้ (ต้องสร้าง API <code>/api/tasks</code> และ <code>/api/uploads/sign</code> ก่อน)
        ระหว่างนี้ใช้เว็บต้นแบบที่ <code>prototype/index.html</code> ได้เลย
      </p>
    </main>
  );
}
