'use client';
// components/role-store.tsx + app/dashboard/layout.tsx (ดูตัวอย่าง layout ท้ายไฟล์)
// ส่ง role จาก Server Layout ลง Zustand เพื่อใช้ซ่อน/แสดงปุ่มใน UI (ตัวบังคับจริงคือ API)
import { ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { Action, Role, Status, can as canFn, canTransition as canTransitionFn } from '@/lib/session';

interface RoleState {
  role: Role | null;
}
export const useRoleStore = create<RoleState>(() => ({ role: null }));

/** ตั้งค่าครั้งเดียวระหว่าง render แรก กัน UI กะพริบเป็น "ไม่มีสิทธิ์" ก่อน useEffect ทำงาน */
export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  const done = useRef(false);
  if (!done.current) {
    useRoleStore.setState({ role });
    done.current = true;
  }
  return <>{children}</>;
}

export function usePermissions() {
  const role = useRoleStore((s) => s.role);
  return {
    role,
    isAdmin: role === 'ADMIN',
    isViewer: role === 'VIEWER',
    can: (action: Action) => canFn(role, action),
    canTransition: (from: Status, to: Status) => canTransitionFn(role, from, to),
  };
}

/** <Can action="task:create"><NewButton /></Can> */
export function Can({ action, fallback = null, children }: { action: Action; fallback?: ReactNode; children: ReactNode }) {
  const { can } = usePermissions();
  return <>{can(action) ? children : fallback}</>;
}

/** ปุ่มออกจากระบบ: ลบ cookie แล้วกลับหน้า Landing */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch('/api/auth/enter', { method: 'DELETE' });
        router.push('/');
        router.refresh();
      }}
    >
      ออกจากระบบ
    </button>
  );
}

/* ------------------------------ app/dashboard/layout.tsx ------------------------------
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, verifyRole } from '@/lib/session';
import { RoleProvider } from '@/components/role-store';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await verifyRole((await cookies()).get(COOKIE)?.value);
  if (!role) redirect('/');                 // ชั้นที่ 2 ต่อจาก middleware
  return <RoleProvider role={role}>{children}</RoleProvider>;
}

// ใน Dashboard: viewer ลากไม่ได้ / ไม่เห็นปุ่มสร้าง
//   const { can } = usePermissions();
//   useDraggable({ id, disabled: !can('task:reschedule') });
//   <Can action="task:create"><NewTaskButton /></Can>
//   <Can action="status:review"><ReviewPanel /></Can>
------------------------------------------------------------------------------------- */
