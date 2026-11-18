'use client';
// lib/session-store.tsx
// เก็บผู้ใช้ปัจจุบันฝั่ง client + hook ตัดสินสิทธิ์ตามแบรนด์ที่เลือกอยู่
import { ReactNode, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { useBrand } from '@/lib/brand-store';
import { Action, Role, SessionUser, TaskLike, allowedTransitions, can as canFn, roleIn } from '@/lib/permissions';

interface SessionState {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
}
export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

/**
 * วางใน Server Layout ก่อน children:
 *   const user = await getSessionUser();
 *   <SessionHydrator user={user} />{children}
 * ตั้งค่าครั้งเดียวระหว่าง render แรก เพื่อไม่ให้ UI กะพริบเป็นสถานะ "ไม่มีสิทธิ์" ก่อน useEffect ทำงาน
 */
export function SessionHydrator({ user }: { user: SessionUser | null }): ReactNode {
  const done = useRef(false);
  if (!done.current) {
    useSessionStore.setState({ user });
    done.current = true;
  }
  return null;
}

export function usePermissions() {
  const user = useSessionStore((s) => s.user);
  const brand = useBrand(); // 'KS' | 'BL' จาก brand-store → ถ้า brandId จริงในฐานข้อมูลเป็นอย่างอื่น ให้แมปที่นี่

  return useMemo(() => {
    const role: Role | null = roleIn(user, brand);
    return {
      user,
      role,
      isManager: role === 'ADMIN' || role === 'MANAGER',
      isViewer: role === 'VIEWER',
      /** can('task:create') หรือ can('status:submit', task) */
      can: (action: Action, task?: TaskLike) => canFn(user, task?.brandId ?? brand, action, task),
      /** ปุ่มสถานะที่ผู้ใช้กดได้กับงานนี้ */
      transitionsFor: (task: TaskLike) => allowedTransitions(user, task),
    };
  }, [user, brand]);
}

/** <Can action="task:create"><NewButton/></Can> */
export function Can({
  action,
  task,
  fallback = null,
  children,
}: {
  action: Action;
  task?: TaskLike;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(action, task) ? children : fallback}</>;
}
