// app/dashboard/trends/page.tsx — Trend Radar เฉพาะ ADMIN (ตัวบังคับจริงคือ /api/trends/*)
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/guard';
import TrendRadar from '@/components/TrendRadar';

export default async function TrendsPage() {
  const role = await getRole();
  if (!role) redirect('/');
  if (role !== 'ADMIN') redirect('/dashboard');
  return <TrendRadar />;
}
