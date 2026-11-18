// lib/types.ts
export const STATUSES = ["DRAFT", "IN_REVIEW", "REVISION", "APPROVED", "POSTED"] as const;
export type Status = (typeof STATUSES)[number];

export const PLATFORMS = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE", "LINE_OA", "X"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  DRAFT:     { label: "Draft",    badge: "bg-slate-100 text-slate-700",   dot: "bg-slate-400" },
  IN_REVIEW: { label: "รอตรวจ",   badge: "bg-amber-100 text-amber-800",   dot: "bg-amber-500" },
  REVISION:  { label: "ให้แก้",    badge: "bg-rose-100 text-rose-800",     dot: "bg-rose-500" },
  APPROVED:  { label: "Approved", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  POSTED:    { label: "Posted",   badge: "bg-sky-100 text-sky-800",       dot: "bg-sky-500" },
};

export const PLATFORM_META: Record<Platform, { label: string; short: string }> = {
  FACEBOOK:  { label: "Facebook",  short: "FB" },
  INSTAGRAM: { label: "Instagram", short: "IG" },
  TIKTOK:    { label: "TikTok",    short: "TT" },
  YOUTUBE:   { label: "YouTube",   short: "YT" },
  LINE_OA:   { label: "LINE OA",   short: "LN" },
  X:         { label: "X",         short: "X" },
};

export interface Brand {
  id: string;
  code: string; // "KS" | "BL"
  name: string;
  color: string;
}

export type AttachmentKind = "IMAGE" | "VIDEO" | "DOCUMENT" | "LINK";
export type AttachmentPurpose = "REFERENCE" | "DELIVERABLE";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  purpose?: AttachmentPurpose; // REFERENCE = ไฟล์บรีฟ (Admin) | DELIVERABLE = ไฟล์/ลิงก์ส่งงาน
  fileName: string;
  mimeType: string;
  size: number;
  key: string;
  url: string;
}

export interface ContentTask {
  id: string;
  title: string;
  caption?: string | null;
  status: Status;
  platforms: Platform[];
  publishDate: string; // ISO string
  briefDueAt?: string | null;
  brandId: string;
  brand: Brand;
  revisionNote?: string | null; // สิ่งที่ต้องแก้ล่าสุด (จากการตีกลับ)
  revisionRound?: number;
  attachments: Attachment[];
}

export interface Filters {
  brandIds: string[];
  statuses: Status[];
  platforms: Platform[];
}
