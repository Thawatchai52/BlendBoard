// lib/task-dto.ts — แปลงแถว DB → JSON ที่หน้าเว็บใช้ (ออก URL ชั่วคราวของไฟล์ตอนอ่าน)
import type { Prisma } from '@prisma/client';
import { presignedUrl } from '@/lib/storage';

export const taskInclude = {
  brand: true,
  attachments: { orderBy: { uploadedAt: 'asc' } },
} satisfies Prisma.ContentTaskInclude;

export const taskIncludeWithHistory = {
  ...taskInclude,
  history: { orderBy: { changedAt: 'desc' }, take: 30 },
} satisfies Prisma.ContentTaskInclude;

type TaskRow = Prisma.ContentTaskGetPayload<{ include: typeof taskInclude }> & {
  history?: Prisma.StatusHistoryGetPayload<object>[];
};

const FILE_URL_TTL = 60 * 60; // 1 ชั่วโมง

export function toTaskDTO(t: TaskRow) {
  return {
    id: t.id,
    title: t.title,
    caption: t.caption,
    status: t.status,
    ctype: t.ctype,
    platforms: t.platforms,
    publishDate: t.publishDate.toISOString(),
    briefDueAt: t.briefDueAt?.toISOString() ?? null,
    brandId: t.brandId,
    brand: { id: t.brand.id, code: t.brand.code, name: t.brand.name, color: t.brand.color },
    revisionNote: t.revisionNote,
    revisionRound: t.revisionRound,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    attachments: t.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      purpose: a.purpose,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      key: a.key ?? '',
      url: a.kind === 'LINK' ? (a.url ?? '') : a.key ? (presignedUrl('GET', a.key, FILE_URL_TTL) ?? '') : '',
    })),
    ...(t.history
      ? { history: t.history.map((h) => ({ from: h.fromStatus, to: h.toStatus, by: h.actorRole, comment: h.comment, at: h.changedAt.toISOString() })) }
      : {}),
  };
}
export type TaskDTO = ReturnType<typeof toTaskDTO>;
