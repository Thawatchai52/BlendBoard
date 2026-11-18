// lib/task-rules.ts — กติกาล้วน ๆ ของงาน (ไม่ import DB/เฟรมเวิร์ก) เทสต์ได้ตรง ๆ
// ใช้ซ้ำทั้งใน API Route และ session.ts (re-export canTransition)
import type { Role, Status } from '@/lib/session';

/* ------------------------------ เส้นทางเปลี่ยนสถานะ ------------------------------ */
/** Viewer เปลี่ยนได้เฉพาะเส้นทางเหล่านี้ ส่วน Admin เปลี่ยนได้ทุกเส้นทาง */
const VIEWER_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  DRAFT: ['IN_REVIEW'],
  REVISION: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT'],
};

export function canTransition(role: Role | null | undefined, from: Status, to: Status): boolean {
  if (from === to || !role) return false;
  if (role === 'ADMIN') return true;
  return (VIEWER_TRANSITIONS[from] ?? []).includes(to);
}

export type RuleResult =
  | { ok: true; reject: boolean }
  | { ok: false; http: number; error: string; reason: string };

/**
 * ตรวจการเปลี่ยนสถานะทั้งหมดในที่เดียว
 * - ตีกลับ (รอตรวจ → ให้แก้) ต้องมีคอมเมนต์
 * - ส่งตรวจ (→ รอตรวจ) ต้องมีไฟล์/ลิงก์ส่งงานอย่างน้อย 1 รายการ
 */
export function checkTransition(i: {
  role: Role | null | undefined;
  from: Status;
  to: Status;
  comment?: string | null;
  deliverableCount: number;
}): RuleResult {
  if (!i.role) return { ok: false, http: 401, error: 'UNAUTHENTICATED', reason: 'ยังไม่ได้เข้าสู่ระบบ' };
  if (i.from === i.to) return { ok: false, http: 400, error: 'NO_CHANGE', reason: 'สถานะเดิมอยู่แล้ว' };
  if (!canTransition(i.role, i.from, i.to)) {
    return { ok: false, http: 403, error: 'FORBIDDEN', reason: 'ไม่มีสิทธิ์เปลี่ยนสถานะนี้' };
  }
  const reject = i.from === 'IN_REVIEW' && i.to === 'REVISION';
  if (reject && !i.comment?.trim()) {
    return { ok: false, http: 400, error: 'COMMENT_REQUIRED', reason: 'ตีกลับต้องระบุสิ่งที่ต้องแก้' };
  }
  if (i.to === 'IN_REVIEW' && i.deliverableCount < 1) {
    return { ok: false, http: 400, error: 'DELIVERABLE_REQUIRED', reason: 'แนบไฟล์หรือลิงก์ส่งงานก่อนส่งตรวจ' };
  }
  return { ok: true, reject };
}

/* ------------------------------ ไฟล์แนบ ------------------------------ */
export type Purpose = 'REFERENCE' | 'DELIVERABLE';

/**
 * เพิ่ม/ลบไฟล์แนบได้ไหม
 * - Admin: ได้ทุกชนิด ทุกสถานะ
 * - Viewer: เฉพาะไฟล์ส่งงาน และเฉพาะตอนงานยัง Draft / ให้แก้ (ส่งตรวจแล้วแก้ไม่ได้)
 */
export function canChangeAttachment(role: Role | null | undefined, purpose: Purpose, status: Status): boolean {
  if (role === 'ADMIN') return true;
  return role === 'VIEWER' && purpose === 'DELIVERABLE' && (status === 'DRAFT' || status === 'REVISION');
}

export const MAX_FILE_BYTES = 200 * 1024 * 1024;

const MIME_OK = [
  /^image\/(png|jpe?g|gif|webp|svg\+xml|heic|heif)$/,
  /^video\/(mp4|quicktime|webm|x-m4v)$/,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)$/,
  /^application\/vnd\.ms-(powerpoint|excel)$/,
  /^application\/zip$/,
];
export const isAllowedMime = (m: string) => MIME_OK.some((r) => r.test(m));

export type Kind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export const kindFromMime = (m: string): Kind => (m.startsWith('image/') ? 'IMAGE' : m.startsWith('video/') ? 'VIDEO' : 'DOCUMENT');

/** ชื่อไฟล์ที่ปลอดภัยสำหรับใส่ใน key ของ storage (ตัด path, อักขระแปลก, จำกัดความยาว) */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').replace(/_+/g, '_');
  return (cleaned || 'file').slice(-80);
}

/** key ต้องอยู่ใต้โฟลเดอร์ของแบรนด์เดียวกับงาน (กันอ้างไฟล์ข้ามแบรนด์ / path แปลก ๆ) */
export function validAttachmentKey(key: string, brandId: string): boolean {
  return (
    key.length <= 300 &&
    key.startsWith(`${brandId}/`) &&
    !key.includes('..') &&
    !key.includes('//') &&
    /^[A-Za-z0-9/_.-]+$/.test(key)
  );
}

export function isHttpsUrl(u: string): boolean {
  if (u.length > 600) return false;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' && !p.username && !p.password;
  } catch {
    return false;
  }
}
