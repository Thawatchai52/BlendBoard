// POST /api/uploads/sign  { fileName, mimeType, size, purpose?, taskId? | brandId? }
// ออก URL ชั่วคราวสำหรับ PUT ไฟล์ขึ้น storage ตรง ๆ (ไฟล์ไม่ผ่านเซิร์ฟเวอร์เรา) key อยู่ใต้โฟลเดอร์แบรนด์เสมอ
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { fail, json, requireRole } from '@/lib/api';
import { signBody } from '@/lib/task-schemas';
import { canChangeAttachment, isAllowedMime, sanitizeFileName } from '@/lib/task-rules';
import { presignedUrl, storageConfigured } from '@/lib/storage';

const UPLOAD_TTL = 10 * 60; // ต้องเริ่มอัปโหลดภายใน 10 นาที
const VIEW_TTL = 60 * 60;

export async function POST(req: Request) {
  const auth = await requireRole();
  if ('res' in auth) return auth.res;
  if (!storageConfigured()) return fail(501, 'STORAGE_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า storage (S3_ENDPOINT / S3_BUCKET / ...)');

  const parsed = signBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'INVALID', parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
  const d = parsed.data;
  if (!isAllowedMime(d.mimeType)) return fail(400, 'UNSUPPORTED_TYPE', 'รองรับเฉพาะรูป วิดีโอ PDF และเอกสาร Office');

  let brandId: string;
  let status: 'DRAFT' | 'IN_REVIEW' | 'REVISION' | 'APPROVED' | 'POSTED' = 'DRAFT';
  let taskPart = 'new';
  if (d.taskId) {
    const task = await prisma.contentTask.findUnique({ where: { id: d.taskId }, select: { brandId: true, status: true } });
    if (!task) return fail(404, 'NOT_FOUND');
    brandId = task.brandId;
    status = task.status;
    taskPart = d.taskId;
  } else {
    // งานที่ยังไม่ถูกสร้าง: Admin เท่านั้น และต้องบอกแบรนด์
    if (auth.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'ต้องระบุงานที่จะแนบไฟล์');
    const brand = d.brandId ? await prisma.brand.findUnique({ where: { id: d.brandId }, select: { id: true } }) : null;
    if (!brand) return fail(400, 'INVALID', 'ไม่พบแบรนด์');
    brandId = brand.id;
  }
  if (!canChangeAttachment(auth.role, d.purpose, status)) return fail(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แนบไฟล์ชนิดนี้ในสถานะปัจจุบัน');

  const key = `${brandId}/${taskPart}/${randomUUID()}-${sanitizeFileName(d.fileName)}`;
  const uploadUrl = presignedUrl('PUT', key, UPLOAD_TTL);
  const publicUrl = presignedUrl('GET', key, VIEW_TTL);
  if (!uploadUrl || !publicUrl) return fail(501, 'STORAGE_NOT_CONFIGURED');
  return json({ uploadUrl, publicUrl, key, expiresIn: UPLOAD_TTL });
}
