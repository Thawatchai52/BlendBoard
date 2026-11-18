'use client';
// components/brand/BrandSwitch.tsx
// ปุ่มสลับแบรนด์สไตล์ Day/Night ในเกม + wipe เปลี่ยนโลกเต็มจอ
// สถานะทั้งหมดอยู่บน attribute data-brand ของปุ่ม แล้วใช้ Tailwind `group-data-[brand=BL]:` สั่งแอนิเมชัน
import { useCallback, useRef } from 'react';
import { BRANDS, BrandId, useBrandStore } from '@/lib/brand-store';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** เล่น wipe วงกลมขยายจากตำแหน่งปุ่ม → สลับธีมตอนจอถูกคลุม → จางออก */
async function playWipe(next: BrandId, origin: { x: number; y: number }, commit: () => void) {
  if (prefersReduced() || !document.body.animate) return commit();

  const ov = document.createElement('div');
  ov.className = `fixed inset-0 z-[60] grid place-content-center text-center bs-wipe-${next}`;
  ov.innerHTML = `<span class="font-semibold text-5xl md:text-7xl tracking-wide">${BRANDS[next].name}</span>
                  <small class="mt-1 text-sm uppercase tracking-widest font-semibold">${BRANDS[next].tagline}</small>`;
  document.body.appendChild(ov);

  const { x, y } = origin;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
  try {
    await ov.animate(
      [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }],
      { duration: 560, delay: 180, easing: 'cubic-bezier(.6,.05,.3,1)', fill: 'both' },
    ).finished;
    commit();                                         // จอถูกคลุมแล้ว สลับธีม + ข้อมูลได้เนียน
    await new Promise((r) => setTimeout(r, 260));
    await ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' }).finished;
  } finally {
    ov.remove();
  }
}

export function BrandSwitch() {
  const brand = useBrandStore((s) => s.brand);
  const switching = useBrandStore((s) => s.switching);
  const { commitBrand, setSwitching } = useBrandStore.getState();
  const ref = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    async (next: BrandId) => {
      const st = useBrandStore.getState();
      if (next === st.brand || st.switching) return;
      const r = ref.current!.getBoundingClientRect();
      setSwitching(true);
      document.body.classList.add('switching');       // ยกปุ่มให้อยู่เหนือ wipe (.switching z-index ใน CSS ของหน้า)
      await playWipe(next, { x: next === 'BL' ? r.right - 36 : r.left + 36, y: r.top + r.height / 2 }, () => commitBrand(next));
      document.body.classList.remove('switching');
      setSwitching(false);
    },
    [commitBrand, setSwitching],
  );

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={brand === 'BL'}
      aria-label={`สลับแบรนด์ ตอนนี้คือ ${BRANDS[brand].name}`}
      data-brand={brand}
      disabled={switching}
      onClick={(e) => {
        if (e.detail === 0) return go(brand === 'KS' ? 'BL' : 'KS'); // คีย์บอร์ด Space/Enter
        const r = e.currentTarget.getBoundingClientRect();
        go(e.clientX < r.left + r.width / 2 ? 'KS' : 'BL');           // คลิกฝั่งที่ต้องการ
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go('KS'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go('BL'); }
      }}
      className="group relative block h-[72px] w-[292px] max-w-full rounded-full drop-shadow-[0_6px_14px_rgba(0,0,0,.28)]
                 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-hero-fg"
    >
      {/* ราง: 2 เลเยอร์ไล่สี crossfade (gradient เปลี่ยนด้วย transition ตรง ๆ ไม่ได้) */}
      <span className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_3px_8px_rgba(0,0,0,.3),0_0_0_3px_rgba(255,255,255,.4)]">
        <span className="bs-ks absolute inset-0" />
        <span className="bs-bl absolute inset-0 opacity-0 transition-opacity duration-[600ms] group-data-[brand=BL]:opacity-100" />
      </span>

      {/* ชื่อแบรนด์ที่ active อยู่ฝั่งตรงข้ามลูกบิด */}
      <span className="pointer-events-none absolute inset-y-0 left-[82px] flex flex-col justify-center text-[#2B1708]
                       transition duration-500 group-data-[brand=BL]:translate-x-4 group-data-[brand=BL]:opacity-0">
        <b className="font-semibold tracking-[.07em] text-[19px] leading-none">KUDSAN</b>
        <small className="text-[11px] font-medium">Energetic</small>
      </span>
      <span className="pointer-events-none absolute inset-y-0 right-[82px] flex -translate-x-4 flex-col justify-center text-right
                       text-[#FFF3E6] opacity-0 transition duration-500 group-data-[brand=BL]:translate-x-0 group-data-[brand=BL]:opacity-100">
        <b className="font-semibold tracking-[.07em] text-[19px] leading-none">BELLINEE'S</b>
        <small className="text-[11px] font-medium">Premium</small>
      </span>

      {/* ลูกบิด: สปริง overshoot + ดวงอาทิตย์ ↔ เมล็ดกาแฟ หมุนสลับ */}
      <span
        className="absolute left-2 top-2 h-14 w-14 rounded-full bg-[#FFF6D6] shadow-[0_5px_12px_rgba(0,0,0,.4)]
                   transition-[left,background-color,scale] duration-700 ease-[cubic-bezier(.34,1.56,.64,1)]
                   group-active:scale-x-110 group-active:scale-y-95
                   group-data-[brand=BL]:left-[calc(100%-4rem)] group-data-[brand=BL]:bg-[#3B2416] group-data-[brand=BL]:ring-2 group-data-[brand=BL]:ring-[#D2A679]"
      >
        <span className="absolute inset-0 grid place-items-center transition duration-700 ease-[cubic-bezier(.34,1.56,.64,1)]
                         group-data-[brand=BL]:rotate-[140deg] group-data-[brand=BL]:scale-50 group-data-[brand=BL]:opacity-0">
          <span className="bs-sun-rays absolute inset-px rounded-full" />
          <i className="bs-sun h-[34px] w-[34px] rounded-full" />
        </span>
        <span className="absolute inset-0 grid -rotate-[140deg] scale-50 place-items-center opacity-0 transition duration-700
                         ease-[cubic-bezier(.34,1.56,.64,1)] group-data-[brand=BL]:-rotate-[24deg] group-data-[brand=BL]:scale-100 group-data-[brand=BL]:opacity-100">
          <i className="bs-bean h-[37px] w-7 rounded-full" />
        </span>
      </span>
    </button>
  );
}
