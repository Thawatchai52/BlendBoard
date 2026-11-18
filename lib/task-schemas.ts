// lib/task-schemas.ts — ตรวจข้อมูลขาเข้าของ API งาน
import { z } from 'zod';
import { MAX_FILE_BYTES, isHttpsUrl, validAttachmentKey } from '@/lib/task-rules';

export const STATUS = z.enum(['DRAFT', 'IN_REVIEW', 'REVISION', 'APPROVED', 'POSTED']);
const PLATFORM = z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'LINE_OA', 'X']);
const isoDate = z.string().datetime({ offset: true });

export const attachmentIn = z.object({
  id: z.string().max(60).optional(),
  kind: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'LINK']),
  purpose: z.enum(['REFERENCE', 'DELIVERABLE']).default('REFERENCE'),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(100).default(''),
  size: z.number().int().min(0).max(MAX_FILE_BYTES).default(0),
  key: z.string().max(300).nullish(),
  // ไฟล์ใน storage ส่ง URL ชั่วคราวยาว ๆ กลับมาด้วย (ไม่ได้ใช้) จึงเผื่อความยาว  ส่วนลิงก์ LINK ตรวจ ≤600 ใน isHttpsUrl
  url: z.string().max(3000).nullish(),
});
export type AttachmentIn = z.infer<typeof attachmentIn>;

export const createTask = z.object({
  title: z.string().trim().min(1).max(150),
  caption: z.string().max(5000).nullish(),
  brandId: z.string().min(1).max(60),
  platforms: z.array(PLATFORM).min(1).max(6),
  status: STATUS.default('DRAFT'),
  publishDate: isoDate,
  briefDueAt: isoDate.nullish(),
  attachments: z.array(attachmentIn).max(50).default([]),
});

/** .strict() = ปฏิเสธฟิลด์แปลกปลอม (เช่น revisionRound, submittedAt ที่ห้ามแก้ตรง ๆ) */
export const patchTask = z
  .object({
    title: z.string().trim().min(1).max(150),
    caption: z.string().max(5000).nullable(),
    brandId: z.string().min(1).max(60),
    platforms: z.array(PLATFORM).min(1).max(6),
    status: STATUS,
    comment: z.string().max(2000),
    publishDate: isoDate,
    briefDueAt: isoDate.nullable(),
    attachments: z.array(attachmentIn).max(50),
  })
  .partial()
  .strict();

export const transitionBody = z.object({ to: STATUS, comment: z.string().max(2000).optional() });

export const addAttachments = z.object({ attachments: z.array(attachmentIn).min(1).max(10) });

export const signBody = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  purpose: z.enum(['REFERENCE', 'DELIVERABLE']).default('REFERENCE'),
  taskId: z.string().max(60).optional(),
  brandId: z.string().max(60).optional(),
});

/** ตรวจไฟล์แนบก่อนบันทึก: LINK ต้อง https / ไฟล์ต้องมี key ใต้โฟลเดอร์แบรนด์ คืนข้อความ error หรือ null */
export function attachmentError(list: AttachmentIn[], brandId: string): string | null {
  for (const a of list) {
    if (a.kind === 'LINK') {
      if (!a.url || !isHttpsUrl(a.url)) return `ลิงก์ "${a.fileName}" ต้องขึ้นต้นด้วย https://`;
    } else if (!a.key || !validAttachmentKey(a.key, brandId)) {
      return `ไฟล์ "${a.fileName}" ไม่ถูกต้อง`;
    }
  }
  return null;
}

export const attachmentRow = (a: AttachmentIn, role: 'VIEWER' | 'ADMIN') => ({
  kind: a.kind,
  purpose: a.purpose,
  fileName: a.fileName,
  mimeType: a.kind === 'LINK' ? 'text/uri-list' : a.mimeType,
  size: a.kind === 'LINK' ? 0 : a.size,
  key: a.kind === 'LINK' ? null : (a.key ?? null),
  url: a.kind === 'LINK' ? (a.url ?? null) : null,
  uploadedByRole: role,
});
