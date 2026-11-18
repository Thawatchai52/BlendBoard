// lib/brand-store.ts
// Global State สลับ "โลก" ของแบรนด์ด้วย Zustand
// ครอบคลุม: ธีมสี (data-brand บน <html>), แยกตัวกรองรายแบรนด์, จังหวะ transition, จำค่าที่เลือกไว้
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BrandId = 'KS' | 'BL';
export type Status = 'DRAFT' | 'IN_REVIEW' | 'REVISION' | 'APPROVED' | 'POSTED';
export type Platform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'LINE_OA' | 'X';

export const BRANDS: Record<BrandId, { name: string; tagline: string }> = {
  KS: { name: 'Kudsan', tagline: 'สดใส เต็มพลัง ปล่อยคอนเทนต์ให้ปัง' },
  BL: { name: "Bellinee's", tagline: 'อบอุ่น พรีเมียม ใส่ใจทุกรายละเอียด' },
};

interface Filters {
  statuses: Status[];
  platforms: Platform[];
}
const emptyFilters = (): Filters => ({ statuses: [], platforms: [] });

interface BrandState {
  brand: BrandId;
  /** true ระหว่างเล่นแอนิเมชัน wipe — กันกดซ้ำ */
  switching: boolean;
  /** ตัวกรองแยกรายโลก: สลับไปมาแล้วตัวกรองของแต่ละแบรนด์ยังอยู่ครบ */
  filters: Record<BrandId, Filters>;

  /** commit การสลับจริง (เรียกกลางแอนิเมชัน) */
  commitBrand: (b: BrandId) => void;
  setSwitching: (v: boolean) => void;
  toggleStatus: (s: Status) => void;
  togglePlatform: (p: Platform) => void;
  clearFilters: () => void;
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export const useBrandStore = create<BrandState>()(
  persist(
    (set) => ({
      brand: 'KS',
      switching: false,
      filters: { KS: emptyFilters(), BL: emptyFilters() },

      commitBrand: (brand) => {
        // ธีมทั้งเว็บเปลี่ยนที่จุดเดียว: attribute บน <html> (ดู globals.css)
        document.documentElement.dataset.brand = brand;
        set({ brand });
      },
      setSwitching: (switching) => set({ switching }),

      toggleStatus: (s) =>
        set((st) => ({
          filters: { ...st.filters, [st.brand]: { ...st.filters[st.brand], statuses: toggle(st.filters[st.brand].statuses, s) } },
        })),
      togglePlatform: (p) =>
        set((st) => ({
          filters: { ...st.filters, [st.brand]: { ...st.filters[st.brand], platforms: toggle(st.filters[st.brand].platforms, p) } },
        })),
      clearFilters: () =>
        set((st) => ({ filters: { ...st.filters, [st.brand]: emptyFilters() } })),
    }),
    {
      name: 'content-calendar-brand',
      partialize: (s) => ({ brand: s.brand, filters: s.filters }), // switching ไม่ต้องจำ
      // รีโหลดหน้าแล้วคืนธีมที่เคยเลือก
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.dataset.brand = state.brand;
      },
    },
  ),
);

/* selector เล็ก ๆ ให้คอมโพเนนต์ subscribe เฉพาะที่ใช้ ลด re-render */
export const useBrand = () => useBrandStore((s) => s.brand);
export const useBrandFilters = () => useBrandStore((s) => s.filters[s.brand]);
