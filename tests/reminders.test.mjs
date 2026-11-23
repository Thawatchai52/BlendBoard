import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReminders, buildMessage, bangkokToday, dayDiff } from '../scripts/reminders.mjs';

const T = (id, date, extra = {}) => ({ id, title: 'งาน ' + id, publishDate: date + 'T10:00', attachments: [], ...extra });
const link = { kind: 'LINK', purpose: 'DELIVERABLE', url: 'https://www.tiktok.com/@a/video/1' };

test('bangkokToday uses Thai date near midnight UTC', () => {
  assert.equal(bangkokToday(new Date('2026-11-23T18:30:00Z')), '2026-11-24'); // 01:30 ICT
  assert.equal(bangkokToday(new Date('2026-11-23T02:00:00Z')), '2026-11-23');
});
test('dayDiff across month end', () => { assert.equal(dayDiff('2026-12-01', '2026-11-30'), 1); assert.equal(dayDiff('2026-11-23', '2026-11-23'), 0); });
test('only 1 and 2 days ahead, only not-done, not-posted', () => {
  const today = '2026-11-23';
  const r = computeReminders([
    T('a', '2026-11-24'), T('b', '2026-11-25'), T('c', '2026-11-26'), T('d', '2026-11-23'), T('e', '2026-11-22'),
    T('f', '2026-11-24', { done: true }), T('g', '2026-11-25', { attachments: [link] }),
  ], today);
  assert.deepEqual(r[1].map(t => t.id), ['a']);
  assert.deepEqual(r[2].map(t => t.id), ['b']);
});
test('message text and truncation', () => {
  const rem = { 1: ['1', '2', '3', '4', '5'].map(i => T(i, 'x')), 2: [T('z', 'x')] };
  const m = buildMessage(rem);
  assert.match(m.title, /6 งาน/);
  assert.match(m.body, /พรุ่งนี้ 5 งาน: งาน 1, งาน 2, งาน 3 \+2/);
  assert.match(m.body, /อีก 2 วัน 1 งาน: งาน z/);
  assert.equal(buildMessage({ 1: [], 2: [] }), null);
});
