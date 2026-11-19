import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyClip, normalizeKeyword, windowStart, TREND_WINDOW_DAYS } from '../lib/trend-classify.ts';

test('จัดหมวดจากแคปชัน/แฮชแท็ก', () => {
  assert.equal(classifyClip('ครัวซองต์ชาไทยกรอบนอกนุ่มใน #เบเกอรี่'), 'bakery');
  assert.equal(classifyClip('ชานมไข่มุก ร้านนี้คนต่อคิวยาว #เครื่องดื่ม'), 'drink');
  assert.equal(classifyClip('Best matcha LATTE in town'), 'drink');
});
test('ไม่เกี่ยวเบเกอรี่/เครื่องดื่ม = ตัดทิ้ง (null)', () => {
  assert.equal(classifyClip('เคล็ดลับจัดห้องให้เป็นระเบียบ #อร่อยบอกต่อ'), null);
  assert.equal(classifyClip(null), null);
});
test('มีทั้งสองหมวด: หมวดที่คำตรงมากกว่าชนะ เท่ากันเป็นเบเกอรี่', () => {
  assert.equal(classifyClip('เค้ก ขนมปัง โดนัท คู่กับกาแฟ'), 'bakery');
  assert.equal(classifyClip('ชานม กาแฟ โกโก้ กับเค้ก'), 'drink');
  assert.equal(classifyClip('เค้กกับกาแฟ'), 'bakery');
});
test('normalizeKeyword: ตัด # ช่องว่าง และกันอักขระแปลก', () => {
  assert.deepEqual(normalizeKeyword('#เบเกอรี่ '), { ok: true, term: 'เบเกอรี่' });
  assert.deepEqual(normalizeKeyword('  ## ขนม ปัง'), { ok: true, term: 'ขนมปัง' });
  assert.equal(normalizeKeyword('').ok, false);
  assert.equal(normalizeKeyword('a<b>').ok, false);
  assert.equal(normalizeKeyword('x'.repeat(31)).ok, false);
});
test('หน้าต่าง 7 วัน', () => {
  const now = Date.UTC(2026, 10, 19);
  assert.equal(windowStart(now).getTime(), now - TREND_WINDOW_DAYS * 86_400_000);
});
