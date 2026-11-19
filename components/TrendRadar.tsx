'use client';
// components/TrendRadar.tsx — Admin: คีย์เวิร์ด + การ์ดเทรนด์เบเกอรี่/เครื่องดื่ม 7 วันล่าสุด + "เซฟเป็นเรฟ"
import { useCallback, useEffect, useState } from 'react';

type Cat = 'ALL' | 'bakery' | 'drink';
interface Clip {
  videoId: string; url: string; author: string | null; caption: string | null; coverUrl: string | null;
  category: 'bakery' | 'drink'; views: number; er: number | null; viral: boolean; postedAt: string; saved: boolean;
}
interface Idea { videoId: string; url: string; author: string | null; caption: string | null; coverUrl: string | null; views: number }

const nf = new Intl.NumberFormat('th-TH');
const CATS: [Cat, string][] = [['ALL', 'ทั้งหมด'], ['bakery', '🥐 เบเกอรี่'], ['drink', '🧋 เครื่องดื่ม']];
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'วันนี้' : `${d} วันก่อน`;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? 'ทำรายการไม่สำเร็จ');
  return data as T;
}

function Cover({ src }: { src: string | null }) {
  const [bad, setBad] = useState(false);
  // ลิงก์ภาพปกของ TikTok หมดอายุได้ → ภาพสำรองแทนภาพแตก
  if (!src || bad) return <div className="flex h-full w-full items-center justify-center bg-surface-2 text-4xl" aria-hidden>🎬</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />;
}

export default function TrendRadar() {
  const [kw, setKw] = useState<string[]>([]);
  const [kwIn, setKwIn] = useState('');
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>('ALL');
  const [sort, setSort] = useState<'views' | 'er'>('views');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ sort, ...(cat !== 'ALL' ? { category: cat } : {}) });
      const d = await api<{ clips: Clip[]; fetchedAt: string | null }>(`/api/trends?${q}`);
      setClips(d.clips);
      setFetchedAt(d.fetchedAt);
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'โหลดไม่สำเร็จ', err: true });
    }
  }, [cat, sort]);
  const loadIdeas = useCallback(async () => setIdeas((await api<{ ideas: Idea[] }>('/api/trends/saved').catch(() => ({ ideas: [] }))).ideas), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadIdeas(); api<{ keywords: string[] }>('/api/trends/keywords').then((d) => setKw(d.keywords)).catch(() => {}); }, [loadIdeas]);

  async function saveKeywords(next: string[]) {
    try {
      const d = await api<{ keywords: string[] }>('/api/trends/keywords', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: next }) });
      setKw(d.keywords);
      setMsg(null);
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'บันทึกคีย์เวิร์ดไม่สำเร็จ', err: true });
    }
  }
  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ kept: number; dropped: number }>('/api/trends/refresh', { method: 'POST' });
      setMsg({ t: `ดึงแล้ว เก็บ ${r.kept} คลิป${r.dropped ? ` (ตัดที่ไม่เกี่ยวข้อง/เกิน 7 วัน ${r.dropped})` : ''}` });
      await load();
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'ดึงไม่สำเร็จ', err: true });
    } finally {
      setBusy(false);
    }
  }
  async function toggleSave(c: Clip) {
    try {
      if (c.saved) await api(`/api/trends/saved?videoId=${encodeURIComponent(c.videoId)}`, { method: 'DELETE' });
      else await api('/api/trends/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: c.videoId }) });
      await Promise.all([load(), loadIdeas()]);
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'เซฟไม่สำเร็จ', err: true });
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 py-6 text-fg">
      <header>
        <h1 className="font-head text-2xl font-semibold">Trend Radar</h1>
        <p className="mt-1 text-sm text-muted">คลิปเบเกอรี่และเครื่องดื่มที่กำลังมาแรงใน 7 วันล่าสุด เอาไว้ต่อยอดคิดคอนเทนต์</p>
      </header>

      <div className="flex flex-col gap-3 rounded-brand border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">คีย์เวิร์ด / แฮชแท็กที่ใช้ค้นหา</h2>
        <div className="flex flex-wrap items-center gap-2">
          {kw.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-sm">
              #{k}
              <button type="button" aria-label={`ลบ #${k}`} onClick={() => saveKeywords(kw.filter((x) => x !== k))} className="h-5 w-5 rounded-full text-muted hover:text-red-600">×</button>
            </span>
          ))}
          <input
            value={kwIn}
            maxLength={31}
            onChange={(e) => setKwIn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const t = kwIn.replace(/^[#\s]+/, '').trim();
              if (t && !kw.includes(t)) saveKeywords([...kw, t]);
              setKwIn('');
            }}
            placeholder="+ เพิ่มคีย์เวิร์ด แล้วกด Enter"
            aria-label="เพิ่มคีย์เวิร์ด"
            className="w-52 max-w-full rounded-full border border-line bg-bg px-3 py-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refresh} disabled={busy || !kw.length} className="rounded-brand bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60">
            {busy ? 'กำลังดึงเทรนด์...' : 'ดึงเทรนด์ล่าสุด'}
          </button>
          <span className="text-xs text-muted">{fetchedAt ? `อัปเดตล่าสุด ${new Date(fetchedAt).toLocaleString('th-TH')}` : 'ยังไม่เคยดึง'}</span>
          {msg && <span role="status" className={`text-sm ${msg.err ? 'text-red-600' : 'text-muted'}`}>{msg.t}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CATS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
            className={`rounded-full border px-3 py-1 text-sm ${cat === k ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface hover:bg-surface-2'}`}>{label}</button>
        ))}
        <span className="flex-1" />
        {([['views', 'ยอดวิว'], ['er', 'ความแมส (ER)']] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}
            className={`rounded-full border px-3 py-1 text-sm ${sort === k ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface hover:bg-surface-2'}`}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {clips === null && <p className="col-span-full py-8 text-center text-muted">กำลังโหลด...</p>}
        {clips?.length === 0 && <p className="col-span-full py-8 text-center text-muted">ยังไม่มีคลิป กด "ดึงเทรนด์ล่าสุด" เพื่อเริ่ม</p>}
        {clips?.map((c) => (
          <article key={c.videoId} className="flex min-w-0 flex-col overflow-hidden rounded-brand border border-line bg-surface">
            <div className="relative aspect-[4/5] bg-surface-2">
              <Cover src={c.coverUrl} />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">{c.category === 'bakery' ? '🥐 เบเกอรี่' : '🧋 เครื่องดื่ม'}</span>
              {c.viral && <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">🔥 แมส</span>}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <p className="text-xl font-semibold tabular-nums">{nf.format(c.views)} <span className="text-xs font-normal text-muted">วิว</span></p>
              <p className="text-xs text-muted">ER {c.er == null ? '–' : `${c.er.toFixed(2)}%`}{c.author ? ` · @${c.author}` : ''} · ลง{ago(c.postedAt)}</p>
              <p className="line-clamp-3 text-sm">{c.caption}</p>
              <div className="mt-auto flex gap-2 pt-1">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-brand border border-line px-2 py-1.5 text-center text-sm hover:bg-surface-2">ดูคลิปต้นทาง ↗</a>
                <button type="button" aria-pressed={c.saved} onClick={() => toggleSave(c)}
                  className={`flex-1 rounded-brand border px-2 py-1.5 text-sm ${c.saved ? 'border-accent bg-accent font-semibold text-accent-fg' : 'border-line hover:bg-surface-2'}`}>{c.saved ? '✓ เซฟแล้ว' : 'เซฟเป็นเรฟ'}</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-brand border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">คลังไอเดีย (เรฟที่เซฟไว้) {ideas.length}</h2>
        {ideas.length === 0 && <p className="text-sm text-muted">ยังไม่มีเรฟ กด "เซฟเป็นเรฟ" ที่การ์ดที่ถูกใจ</p>}
        <ul className="flex flex-col gap-2">
          {ideas.map((i) => (
            <li key={i.videoId} className="flex items-center gap-3 rounded-brand border border-line bg-bg p-2">
              <div className="h-14 w-11 flex-none overflow-hidden rounded"><Cover src={i.coverUrl} /></div>
              <div className="min-w-0 flex-1">
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">{i.caption ?? 'เปิดคลิป'}</a>
                <p className="text-xs text-muted">{nf.format(i.views)} วิว{i.author ? ` · @${i.author}` : ''}</p>
              </div>
              <button type="button" onClick={async () => { await api(`/api/trends/saved?videoId=${encodeURIComponent(i.videoId)}`, { method: 'DELETE' }).catch(() => {}); await Promise.all([load(), loadIdeas()]); }} className="rounded-brand border border-line px-2 py-1 text-xs hover:bg-surface-2">เอาออก</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
