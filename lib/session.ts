// lib/session.ts
// Role มี 2 ค่า ตามประตูที่เลือก: VIEWER (ฝั่งดูตารางและส่งงาน) | ADMIN (ฝั่งคนเขียนบรีฟและจัดการตาราง)
// เก็บใน cookie ที่ "เซ็นลายเซ็น" (HMAC) กันแก้ค่าเอง ใช้ Web Crypto จึงรันได้ทั้ง Middleware (edge) และ Node
export type Role = 'VIEWER' | 'ADMIN';
export const COOKIE = 'cc_role';
export const SESSION_HOURS = 12;

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-change-me'; // ตั้งค่าจริงใน .env: SESSION_SECRET=สุ่มยาว ๆ
const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  let s = '';
  sig.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signRole(role: Role): Promise<string> {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const body = `${role}.${exp}`;
  return `${body}.${await hmac(body)}`;
}

export async function verifyRole(token?: string | null): Promise<Role | null> {
  if (!token) return null;
  const [role, exp, sig] = token.split('.');
  if (!role || !exp || !sig) return null;
  if (role !== 'VIEWER' && role !== 'ADMIN') return null;
  if (!(Number(exp) > Date.now())) return null;
  return safeEqual(sig, await hmac(`${role}.${exp}`)) ? (role as Role) : null;
}

/* ------------------------------ สิทธิ์ 2 ฝั่ง ------------------------------ */
export type Status = 'DRAFT' | 'IN_REVIEW' | 'REVISION' | 'APPROVED' | 'POSTED';

export type Action =
  | 'task:view' | 'task:create' | 'task:edit' | 'task:delete' | 'task:reschedule'
  | 'file:download' | 'file:upload_reference' | 'file:upload_deliverable'
  | 'status:submit' | 'status:review' | 'status:post';

const VIEWER_ACTIONS = new Set<Action>(['task:view', 'file:download', 'file:upload_deliverable', 'status:submit']);

export const can = (role: Role | null | undefined, action: Action) =>
  role === 'ADMIN' || (role === 'VIEWER' && VIEWER_ACTIONS.has(action));

/** Viewer เปลี่ยนสถานะได้เฉพาะเส้นทางเหล่านี้ ส่วน Admin เปลี่ยนได้ทุกเส้นทาง */
const VIEWER_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  DRAFT: ['IN_REVIEW'],
  REVISION: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT'],
};

export function canTransition(role: Role | null | undefined, from: Status, to: Status) {
  if (from === to || !role) return false;
  if (role === 'ADMIN') return true;
  return (VIEWER_TRANSITIONS[from] ?? []).includes(to);
}

/* ------------------------------ ใช้ใน API Route ------------------------------
   import { cookies } from 'next/headers';
   const role = await verifyRole((await cookies()).get(COOKIE)?.value);
   if (!role) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
   if (!can(role, 'task:delete')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
   if (!canTransition(role, task.status, to)) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
   Viewer ต้องแนบไฟล์ส่งงานก่อนส่งตรวจ และ Reject ต้องมีคอมเมนต์ (ตรวจที่ API เช่นเดียวกับ api-transition-route.ts เดิม)
------------------------------------------------------------------------------ */
