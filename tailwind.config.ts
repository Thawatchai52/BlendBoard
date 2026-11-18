// tailwind.config.ts
// ผูก utility ของ Tailwind เข้ากับ CSS variables ที่เปลี่ยนตามแบรนด์
// ใช้ได้เลย เช่น bg-surface, text-fg, border-line, bg-accent, rounded-brand, font-head
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: 'var(--line)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        accent: { DEFAULT: 'var(--accent)', fg: 'var(--on-accent)' },
        brand: 'var(--brand)',
        hero: { a: 'var(--hero-a)', b: 'var(--hero-b)', fg: 'var(--hero-fg)' },
      },
      borderRadius: { brand: 'var(--r)' },
      fontFamily: {
        head: 'var(--f-head)',
        body: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
