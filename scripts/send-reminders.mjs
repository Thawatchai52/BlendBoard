// ส่ง Web Push แจ้งเตือนงานที่ยังไม่ทำ (1 วัน / 2 วันก่อนกำหนด) ไปยังทุกเครื่องที่กด "เปิดแจ้งเตือน"
// รันโดย GitHub Actions ทุกวัน 09:00 (เวลาไทย) · ต้องมี env: SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
import webpush from 'web-push';
import { bangkokToday, computeReminders, buildMessage } from './reminders.mjs';

const { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY })) {
  if (!v) { console.error('missing env ' + k); process.exit(1); }
}
const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/';
const H = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
if (!SUPABASE_KEY.startsWith('sb_')) H.Authorization = 'Bearer ' + SUPABASE_KEY;

async function rows(kind) {
  const r = await fetch(`${base}items?kind=eq.${kind}&deleted=eq.false&select=id,data`, { headers: H });
  if (!r.ok) throw new Error(`read ${kind}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

webpush.setVapidDetails('https://thawatchai52.github.io/BlendBoard/', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const today = bangkokToday();
const tasks = (await rows('tasks')).map(r => r.data);
const msg = buildMessage(computeReminders(tasks, today));
console.log(`today ${today} · tasks ${tasks.length} · ` + (msg ? msg.title : 'nothing to remind'));
if (!msg) process.exit(0);

const subs = await rows('push');
let ok = 0, gone = 0, fail = 0;
for (const s of subs) {
  try {
    await webpush.sendNotification(s.data, JSON.stringify(msg), { TTL: 6 * 3600 });
    ok++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      gone++;
      await fetch(`${base}items?on_conflict=kind,id`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ kind: 'push', id: s.id, data: {}, deleted: true }]) });
    } else { fail++; console.error('push failed', e.statusCode || '', String(e.body || e.message).slice(0, 120)); }
  }
}
console.log(`sent ${ok} · expired removed ${gone} · failed ${fail} · devices ${subs.length}`);
if (subs.length && !ok && fail) process.exit(1);
