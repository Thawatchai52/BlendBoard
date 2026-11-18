// ด่านที่ 2 ต่อจาก middleware: ไม่มี cookie ที่เซ็นถูกต้อง → กลับหน้า Landing
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/guard';
import { RoleProvider } from '@/components/role-store';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const role = await getRole();
  if (!role) redirect('/');
  return <RoleProvider role={role}>{children}</RoleProvider>;
}
