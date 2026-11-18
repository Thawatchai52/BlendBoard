// lib/providers/types.ts — สัญญากลางของ "ตัวดึงสถิติ" สลับผู้ให้บริการได้โดยไม่แตะส่วนอื่น
export interface RawStats {
  videoId: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** null = ผู้ให้บริการไม่มีฟิลด์นี้ (ต่างจาก 0) */
  saves: number | null;
  authorHandle: string | null;
  caption: string | null;
  postedAt: Date | null;
}

export class ProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = retryable;
  }
}

export interface StatsProvider {
  fetchStats(url: string): Promise<RawStats>;
}
