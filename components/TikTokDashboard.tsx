'use client';
// components/TikTokDashboard.tsx — หน้า Admin: การ์ดสรุป + ตารางสถิติรายคลิป + ป้าย "🔥 แมสแตก!"
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TikTokPostDTO } from '@/lib/tiktok-service';
import { VIRAL_BADGE, VIRAL_MIN_ER_PCT, VIRAL_MIN_VIEWS } from '@/lib/metrics';
import TikTokSubmitForm from './TikTokSubmitForm';

type Filter = 'ALL' | 'VIRAL' | 'WAIT' | 'FAILED';
type SortKey = 'submittedAt' | 'views' | 'er';

const full = new Intl.NumberFormat('th-TH');
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });
const dt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const n = (v: number | null) => (v == null ? '–' : compact.format(v));

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-brand border border-line bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function StatusChip({ p }: { p: TikTokPostDTO }) {
  if (p.status === 'OK') return null;
  const map = {
    PENDING: ['รอดึงข้อมูล', 'bg-surface-2 text-muted'],
    FETCHING: ['กำลังดึง...', 'bg-surface-2 text-muted'],
    FAILED: ['ดึงไม่สำเร็จ', 'bg-red-100 text-red-700'],
  } as const;
  const [label, cls] = map[p.status as keyof typeof map];
  return (
    <span title={p.error ?? undefined} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function TikTokDashboard() {
  const [posts, setPosts] = useState<TikTokPostDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'submittedAt', dir: -1 });
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tiktok/posts', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) throw new Error('ไม่มีสิทธิ์ดูหน้านี้');
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      setPosts((await res.json()).posts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // มีคลิปที่ยังรอ/กำลังดึง → โหลดซ้ำทุก 8 วินาทีจนครบ (หยุดเมื่อไม่มีแล้ว)
  const working = posts?.some((p) => p.status === 'PENDING' || p.status === 'FETCHING') ?? false;
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [working, load]);

  async function refresh(id: string) {
    setNote(null);
    const res = await fetch(`/api/tiktok/posts/${id}/refresh`, { method: 'POST' });
    if (res.status === 429) setNote((await res.json()).message ?? 'รอสักครู่แล้วลองใหม่');
    else if (!res.ok) setNote('สั่งอัปเดตไม่สำเร็จ');
    load();
  }

  const stats = useMemo(() => {
    const ok = (posts ?? []).filter((p) => p.status === 'OK');
    const ers = ok.map((p) => p.er).filter((x): x is number => x != null);
    return {
      total: posts?.length ?? 0,
      viral: ok.filter((p) => p.viral).length,
      views: ok.reduce((s, p) => s + (p.views ?? 0), 0),
      avgEr: ers.length ? ers.reduce((s, x) => s + x, 0) / ers.length : null,
    };
  }, [posts]);

  const rows = useMemo(() => {
    const list = (posts ?? []).filter((p) =>
      filter === 'ALL' ? true : filter === 'VIRAL' ? p.viral : filter === 'WAIT' ? p.status === 'PENDING' || p.status === 'FETCHING' : p.status === 'FAILED',
    );
    const val = (p: TikTokPostDTO) => (sort.key === 'submittedAt' ? Date.parse(p.submittedAt) : sort.key === 'views' ? p.views : p.er);
    // ค่าว่าง (ยังไม่มียอด) ไปท้ายเสมอ ไม่ว่าเรียงขึ้นหรือลง
    return [...list].sort((a, b) => {
      const x = val(a),
        y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * sort.dir;
    });
  }, [posts, filter, sort]);

  const th = (key: SortKey, label: string, right = true) => (
    <th scope="col" className={`px-3 py-2 font-medium ${right ? 'text-right' : 'text-left'}`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-1 hover:text-fg">
        {label}
        <span aria-hidden className="text-[10px]">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  const chips: [Filter, string][] = [
    ['ALL', 'ทั้งหมด'],
    ['VIRAL', '🔥 แมสแตก'],
    ['WAIT', 'รอดึง'],
    ['FAILED', 'ดึงไม่สำเร็จ'],
  ];

  return (
    <section className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 text-fg">
      <header>
        <h1 className="font-head text-2xl font-semibold">สถิติคลิป TikTok</h1>
        <p className="mt-1 text-sm text-muted">
          ติดป้าย {VIRAL_BADGE} เมื่อ ER ≥ {VIRAL_MIN_ER_PCT}% และยอดวิว ≥ {full.format(VIRAL_MIN_VIEWS)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="คลิปทั้งหมด" value={full.format(stats.total)} />
        <Stat label="🔥 แมสแตก" value={full.format(stats.viral)} />
        <Stat label="ยอดวิวรวม" value={compact.format(stats.views)} />
        <Stat label="ER เฉลี่ยต่อคลิป" value={stats.avgEr == null ? '–' : `${stats.avgEr.toFixed(2)}%`} />
      </div>

      <div className="rounded-brand border border-line bg-surface p-4">
        <TikTokSubmitForm onSubmitted={load} />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="กรองรายการ">
        {chips.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === k ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-fg hover:bg-surface-2'}`}
          >
            {label}
          </button>
        ))}
        {note && (
          <span role="status" className="text-sm text-muted">
            {note}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-brand border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-brand border border-line bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">คลิป</th>
              {th('views', 'วิว')}
              <th scope="col" className="px-3 py-2 text-right font-medium">ไลก์</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">คอมเมนต์</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">แชร์</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">เซฟ</th>
              {th('er', 'ER')}
              <th scope="col" className="px-3 py-2 text-left font-medium">สถานะ</th>
              {th('submittedAt', 'ส่งเมื่อ', false)}
              <th scope="col" className="px-3 py-2"><span className="sr-only">อัปเดต</span></th>
            </tr>
          </thead>
          <tbody>
            {posts === null && !error && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted">กำลังโหลด...</td></tr>
            )}
            {posts !== null && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted">{posts.length === 0 ? 'ยังไม่มีคลิป วางลิงก์ TikTok ในช่องด้านบนได้เลย' : 'ไม่มีรายการในตัวกรองนี้'}</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 align-top">
                <td className="max-w-[260px] px-3 py-2.5">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-accent hover:underline">
                    {p.authorHandle ? `@${p.authorHandle.replace(/^@/, '')}` : 'เปิดคลิป'}
                  </a>
                  {p.caption && <p className="truncate text-xs text-muted" title={p.caption}>{p.caption}</p>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums" title={p.views == null ? undefined : full.format(p.views)}>{n(p.views)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(p.likes)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(p.comments)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(p.shares)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(p.saves)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" title={p.erPartial ? 'ผู้ให้บริการไม่ส่งยอดเซฟมา ER จึงต่ำกว่าจริง' : undefined}>
                  {p.er == null ? '–' : `${p.erPartial ? '~' : ''}${p.er.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2.5">
                  {p.viral ? (
                    <span className="inline-block whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-fg">{VIRAL_BADGE}</span>
                  ) : (
                    <StatusChip p={p} />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{dt.format(new Date(p.submittedAt))}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => refresh(p.id)}
                    disabled={p.status === 'FETCHING'}
                    className="rounded-brand border border-line px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                    aria-label="อัปเดตสถิติคลิปนี้"
                  >
                    อัปเดต
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
