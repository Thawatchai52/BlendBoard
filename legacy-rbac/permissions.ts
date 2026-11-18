// lib/permissions.ts
// แหล่งความจริงเดียวของสิทธิ์ ใช้ทั้ง server (API) และ client (ซ่อน/แสดงปุ่ม)
// ไฟล์นี้ห้าม import อะไรที่เป็น server-only เพื่อให้ client ใช้ได้

export const ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export type Status = 'DRAFT' | 'IN_REVIEW' | 'REVISION' | 'APPROVED' | 'POSTED';

export interface SessionUser {
  id: string;
  name: string;
  isSuperAdmin: boolean;
  /** brandId -> role ในแบรนด์นั้น (ไม่มี key = ไม่ใช่สมาชิก) */
  memberships: Record<string, Role>;
}

export interface TaskLike {
  brandId: string;
  assigneeId?: string | null;
  status: Status;
}

export type Action =
  | 'task:view'
  | 'task:create'
  | 'task:edit'
  | 'task:delete'
  | 'task:reschedule'      // Drag & Drop เลื่อนวัน/ลำดับ
  | 'task:assign'
  | 'file:download'
  | 'file:upload_reference'
  | 'file:upload_deliverable'
  | 'file:delete_any'
  | 'file:delete_own'
  | 'status:submit'        // ส่งงานตรวจ / ถอนงาน
  | 'status:review'        // Approve / Reject
  | 'status:post'
  | 'comment:create'
  | 'member:manage';

/** VIEWER ทำได้กับทุกงานในแบรนด์ */
const VIEWER_BASE = new Set<Action>(['task:view', 'file:download', 'comment:create']);

/** VIEWER ทำได้เฉพาะ "งานที่มอบหมายให้ตัวเอง" */
const VIEWER_OWN = new Set<Action>(['status:submit', 'file:upload_deliverable', 'file:delete_own']);

export function roleIn(user: SessionUser | null | undefined, brandId: string): Role | null {
  if (!user) return null;
  if (user.isSuperAdmin) return 'ADMIN';
  return user.memberships[brandId] ?? null;
}

export function can(
  user: SessionUser | null | undefined,
  brandId: string,
  action: Action,
  task?: Pick<TaskLike, 'assigneeId'>,
): boolean {
  const role = roleIn(user, brandId);
  if (!role || !user) return false;

  if (role === 'ADMIN') return true;
  if (role === 'MANAGER') return action !== 'member:manage';

  // VIEWER
  if (VIEWER_BASE.has(action)) return true;
  if (VIEWER_OWN.has(action)) return !!task && task.assigneeId === user.id;
  return false;
}

/* ------------------------------ state machine ------------------------------ */

/** เส้นทางที่ VIEWER (เจ้าของงาน) เปลี่ยนสถานะได้ */
const VIEWER_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  DRAFT: ['IN_REVIEW'],      // ส่งงานตรวจ
  REVISION: ['IN_REVIEW'],   // ส่งกลับหลังแก้
  IN_REVIEW: ['DRAFT'],      // ถอนงานกลับมาแก้ก่อนผู้ตรวจจะตัดสิน
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function canTransition(user: SessionUser | null | undefined, task: TaskLike, to: Status): TransitionCheck {
  if (task.status === to) return { ok: false, reason: 'งานอยู่ในสถานะนี้แล้ว' };

  const role = roleIn(user, task.brandId);
  if (!role || !user) return { ok: false, reason: 'ไม่ใช่สมาชิกของแบรนด์นี้' };

  if (role === 'ADMIN' || role === 'MANAGER') return { ok: true };

  if (task.assigneeId !== user.id) return { ok: false, reason: 'ไม่ใช่งานที่มอบหมายให้คุณ' };
  if (!(VIEWER_TRANSITIONS[task.status] ?? []).includes(to)) {
    return { ok: false, reason: 'คุณเปลี่ยนสถานะนี้ไม่ได้ ต้องให้ผู้ตรวจดำเนินการ' };
  }
  return { ok: true };
}

/** สถานะที่ผู้ใช้คนนี้กดเปลี่ยนไปได้ ใช้สร้างปุ่มบน UI (client ใช้ฟังก์ชันเดียวกับ server) */
export function allowedTransitions(user: SessionUser | null | undefined, task: TaskLike): Status[] {
  const all: Status[] = ['DRAFT', 'IN_REVIEW', 'REVISION', 'APPROVED', 'POSTED'];
  return all.filter((s) => canTransition(user, task, s).ok);
}

/** เส้นทางที่นับเป็น "การตรวจ" ต้องบันทึก Review และ Reject ต้องมีคอมเมนต์ */
export function isReviewTransition(from: Status, to: Status): 'APPROVED' | 'REJECTED' | null {
  if (from !== 'IN_REVIEW') return null;
  if (to === 'APPROVED') return 'APPROVED';
  if (to === 'REVISION') return 'REJECTED';
  return null;
}
