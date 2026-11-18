'use client';
// components/TikTokSubmitForm.tsx — ฝั่งคนส่งงาน: ช่องเดียว แปะลิงก์ TikTok แล้วกดส่ง
import { FormEvent, useState } from 'react';

type Msg = { kind: 'ok' | 'dup' | 'err'; text: string };

export default function TikTokSubmitForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tiktok/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) setMsg({ kind: 'err', text: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าใหม่' });
      else if (!res.ok) setMsg({ kind: 'err', text: data.message ?? 'ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง' });
      else if (data.duplicate) setMsg({ kind: 'dup', text: 'ลิงก์นี้เคยส่งแล้ว ไม่ต้องส่งซ้ำ' });
      else {
        setMsg({ kind: 'ok', text: 'ส่งลิงก์แล้ว ระบบกำลังดึงสถิติ' });
        setUrl('');
        onSubmitted?.();
      }
    } catch {
      setMsg({ kind: 'err', text: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="tt-url" className="text-sm font-medium text-fg">
        ลิงก์ TikTok
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="tt-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setMsg(null);
          }}
          placeholder="https://www.tiktok.com/@ชื่อช่อง/video/..."
          className="min-w-0 flex-1 rounded-brand border border-line bg-surface px-3 py-2.5 text-base text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-brand bg-accent px-5 py-2.5 text-base font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'กำลังส่ง...' : 'ส่ง'}
        </button>
      </div>
      <p
        role={msg?.kind === 'err' ? 'alert' : 'status'}
        className={`min-h-5 text-sm ${msg?.kind === 'err' ? 'text-red-600' : msg?.kind === 'ok' ? 'text-green-700' : 'text-muted'}`}
      >
        {msg?.text}
      </p>
    </form>
  );
}
