'use client';
// app/page.tsx — หน้า Landing: 2 ประตูทางเข้า (มินิมอล: ไอคอน / หัวข้อ / ข้อความรอง / ปุ่ม)
// ใช้ Tailwind + token สีจาก globals.css / tailwind.config.ts ชุดเดิม (bg-surface, text-fg, bg-accent, from-hero-a ...)
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Door = 'VIEWER' | 'ADMIN';

const Icon = {
  eye: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.2" />
    </svg>
  ),
};

/** ทรงประตูโค้ง: ครึ่งวงรีด้านบน มุมล่างโค้งเล็กน้อย */
const ARCH = 'rounded-[50%_50%_14px_14px_/_130px_130px_14px_14px]';

function DoorCard(props: {
  variant: 'open' | 'locked';
  icon: React.ReactNode;
  title: string;
  cta: string;
  onClick: () => void;
}) {
  const open = props.variant === 'open';
  return (
    <article
      className={`relative flex min-w-0 flex-col items-center gap-3.5 px-6 pb-[34px] pt-[112px] text-center transition duration-200 hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:px-9 md:pb-10 md:pt-[116px] ${ARCH} ${
        open
          ? 'border-2 border-brand bg-gradient-to-b from-[color-mix(in_srgb,var(--brand)_20%,transparent)] to-surface to-60% text-fg'
          : 'border-2 border-transparent bg-gradient-to-br from-hero-a to-hero-b text-hero-fg'
      }`}
    >
      <div
        className={`absolute left-1/2 top-9 grid h-[58px] w-[58px] -translate-x-1/2 place-items-center rounded-full ${
          open ? 'bg-accent text-accent-fg' : 'bg-hero-fg text-hero-b'
        }`}
      >
        {props.icon}
      </div>

      <h2 className="text-balance font-head text-[clamp(24px,3.2vw,30px)] font-semibold leading-tight">{props.title}</h2>

      <button
        type="button"
        onClick={props.onClick}
        className={`mt-3.5 flex w-full max-w-[300px] items-center justify-center gap-2 rounded-brand px-[18px] py-3.5 text-base font-semibold hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? 'bg-accent text-accent-fg' : 'bg-hero-fg text-hero-b'
        }`}
      >
        {props.cta} <span aria-hidden>›</span>
      </button>
    </article>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // เรียก API ตั้ง cookie แล้วค่อยเข้า Dashboard (ตัวตัดสินสิทธิ์คือ cookie ที่เซิร์ฟเวอร์เซ็น ไม่ใช่ state ในหน้านี้)
  async function enter(role: Door, password?: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/auth/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, password }),
      });
      if (!res.ok) {
        setErr(res.status === 401 ? 'รหัสผ่านไม่ถูกต้อง ลองใหม่อีกครั้ง' : res.status === 429 ? 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่' : 'เข้าสู่ระบบไม่สำเร็จ');
        setPw('');
        input.current?.focus();
        return;
      }
      dlg.current?.close();
      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function openAdmin() {
    setPw('');
    setErr(null);
    setShow(false);
    dlg.current?.showModal();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    enter('ADMIN', pw.trim());
  }

  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[980px] flex-col items-center justify-center gap-10 px-4 py-8 text-fg">
      <header className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted">Kudsan · Bellinee&apos;s</p>
        <h1 className="text-balance font-head text-[clamp(34px,6.4vw,58px)] font-semibold leading-[1.08]">Content Calendar</h1>
      </header>

      <div className="grid w-full gap-7 md:grid-cols-2">
        <DoorCard
          variant="open"
          icon={Icon.eye}
          title="ตารางคอนเทนต์"
          cta="เข้าสู่ระบบ"
          onClick={() => enter('VIEWER')}
        />
        <DoorCard
          variant="locked"
          icon={Icon.lock}
          title="จัดการตาราง"
          cta="เข้าสู่ระบบ"
          onClick={openAdmin}
        />
      </div>

      {/* Modal รหัสผ่าน */}
      <dialog
        ref={dlg}
        aria-labelledby="pw-title"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        className="w-[min(400px,calc(100vw-24px))] rounded-brand bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3 p-[22px]">
          <h2 id="pw-title" className="font-head text-xl font-semibold">เข้าสู่ฝั่งจัดการตาราง</h2>
          <p className="text-[13px] text-muted">กรอกรหัสผ่านเพื่อเข้าใช้งานด้วยสิทธิ์ Admin</p>

          <label htmlFor="pw" className="text-[13px] font-medium">รหัสผ่าน</label>
          <div className="flex gap-2">
            <input
              id="pw"
              ref={input}
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              maxLength={32}
              value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(null); }}
              className="min-w-0 flex-1 rounded-brand border border-line bg-bg px-3 py-2 text-base tracking-[.18em] focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="rounded-brand border border-line px-3 text-sm hover:bg-surface-2">
              {show ? 'ซ่อน' : 'แสดง'}
            </button>
          </div>
          <p role="alert" className="min-h-5 text-xs text-red-600">{err}</p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dlg.current?.close()} className="rounded-brand border border-line px-4 py-2 text-sm hover:bg-surface-2">
              ยกเลิก
            </button>
            <button type="submit" disabled={busy || !pw.trim()} className="rounded-brand bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50">
              {busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
