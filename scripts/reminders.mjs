// คำนวณว่าวันนี้ต้องเตือนงานไหนบ้าง: งานที่ "ยังไม่ทำ" (ไม่ได้ติ๊กทำแล้ว และยังไม่มีลิงก์ TikTok) เหลืออีก 1 วัน / 2 วัน
export function bangkokToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // YYYY-MM-DD
}
export function dayDiff(dateIso, today) {
  const a = Date.UTC(+dateIso.slice(0, 4), +dateIso.slice(5, 7) - 1, +dateIso.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((a - b) / 86400000);
}
export function hasTikTokLink(t) {
  return (t.attachments || []).some(a => a && a.kind === 'LINK' && a.purpose === 'DELIVERABLE' && /(^|\.)tiktok\.com\//i.test(String(a.url || '').replace(/^https?:\/\//i, '')));
}
export function pending(t) { return !t.done && !hasTikTokLink(t); }
export function computeReminders(tasks, today) {
  const out = { 1: [], 2: [] };
  for (const t of tasks) {
    if (!t || !t.publishDate || !pending(t)) continue;
    const d = dayDiff(String(t.publishDate).slice(0, 10), today);
    if (d === 1 || d === 2) out[d].push(t);
  }
  return out;
}
const short = (arr) => arr.slice(0, 3).map(t => t.title).join(', ') + (arr.length > 3 ? ` +${arr.length - 3}` : '');
export function buildMessage(rem) {
  const n1 = rem[1].length, n2 = rem[2].length;
  if (!n1 && !n2) return null;
  const lines = [];
  if (n1) lines.push(`พรุ่งนี้ ${n1} งาน: ${short(rem[1])}`);
  if (n2) lines.push(`อีก 2 วัน ${n2} งาน: ${short(rem[2])}`);
  return { title: `🔔 ยังไม่ได้ทำคอนเทนต์ ${n1 + n2} งาน`, body: lines.join('\n'), tag: 'cc-reminder', url: './' };
}
