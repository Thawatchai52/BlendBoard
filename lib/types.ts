// lib/types.ts
export const STATUSES = ["DRAFT", "IN_REVIEW", "REVISION", "APPROVED", "POSTED"] as const;
export type Status = (typeof STATUSES)[number];

export const CONTENT_TYPES = ["AW", "VDO", "LIFESTYLE", "TEXT", "SHARE", "PHOTO_ALBUM", "NPD", "DELIVERY", "SNACK_BOX"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
/** ป้ายตามที่ใช้ใน Excel เดิม */
export const CONTENT_TYPE_META: Record<ContentType, { label: string; desc: string; tag: string }> = {
  AW:          { label: "AW",          desc: "อาร์ตเวิร์ก/ภาพนิ่ง",     tag: "bg-orange-100 text-orange-800" },
  VDO:         { label: "VDO",         desc: "วิดีโอ/คลิปสั้น",         tag: "bg-pink-100 text-pink-800" },
  LIFESTYLE:   { label: "Lifestyle",   desc: "คอนเทนต์ไลฟ์สไตล์",       tag: "bg-green-100 text-green-800" },
  TEXT:        { label: "Text",        desc: "ข้อความล้วน",             tag: "bg-cyan-100 text-cyan-800" },
  SHARE:       { label: "Share",       desc: "แชร์/รีโพสต์",            tag: "bg-indigo-100 text-indigo-800" },
  PHOTO_ALBUM: { label: "Photo Album", desc: "อัลบั้มภาพ",              tag: "bg-yellow-100 text-yellow-800" },
  NPD:         { label: "NPD",         desc: "สินค้าใหม่",              tag: "bg-fuchsia-100 text-fuchsia-800" },
  DELIVERY:    { label: "Delivery",    desc: "เดลิเวอรี/ช่องทางสั่ง",   tag: "bg-sky-100 text-sky-800" },
  SNACK_BOX:   { label: "Snack Box",   desc: "สแน็กบ็อกซ์",             tag: "bg-lime-100 text-lime-800" },
};

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
  ctype?: ContentType | null;
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
  ctypes: ContentType[];
}
