// app/dashboard/tiktok/page.tsx — เฉพาะ ADMIN (ชั้นที่ 2 ต่อจาก middleware; ตัวบังคับจริงคือ /api/tiktok/posts)
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/guard';
import TikTokDashboard from '@/components/TikTokDashboard';

export default async function TikTokPage() {
  const role = await getRole();
  if (!role) redirect('/');
  if (role !== 'ADMIN') redirect('/dashboard');
  return <TikTokDashboard />;
}
