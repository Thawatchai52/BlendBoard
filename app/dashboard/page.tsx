// หน้าแรกหลังเข้าสู่ระบบ — ทางเข้าไปปฏิทิน/Kanban และ (Admin) สถิติ TikTok
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

      <Link href="/dashboard/calendar" className="rounded-brand border border-line bg-surface p-5 hover:bg-surface-2">
        <p className="font-head text-lg font-semibold">ปฏิทินคอนเทนต์ / Kanban</p>
        <p className="mt-1 text-sm text-muted">
          {role === 'ADMIN' ? 'สร้าง แก้ไข ลากเลื่อนวัน' : 'ดูตารางงานและบรีฟ (อ่านอย่างเดียว)'}
        </p>
      </Link>

      {role === 'ADMIN' && (
        <Link href="/dashboard/tiktok" className="rounded-brand border border-line bg-surface p-5 hover:bg-surface-2">
          <p className="font-head text-lg font-semibold">สถิติคลิป TikTok</p>
          <p className="mt-1 text-sm text-muted">ยอดวิว ER และป้าย 🔥 แมสแตก!</p>
        </Link>
      )}

      {role === 'ADMIN' && (
        <Link href="/dashboard/trends" className="rounded-brand border border-line bg-surface p-5 hover:bg-surface-2">
          <p className="font-head text-lg font-semibold">Trend Radar</p>
          <p className="mt-1 text-sm text-muted">เทรนด์เบเกอรี่/เครื่องดื่ม 7 วันล่าสุด + คลังไอเดีย</p>
        </Link>
      )}
    </main>
  );
}
