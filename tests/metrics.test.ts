// รัน:  node --experimental-strip-types --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engagementRate, isViral, isErPartial, interactions } from '../lib/metrics.ts';

const c = (views: number | null, likes = 0, comments = 0, shares = 0, saves: number | null = 0) => ({ views, likes, comments, shares, saves });

test('ER = (likes+comments+shares+saves)/views*100', () => {
  assert.equal(interactions(c(1000, 50, 20, 10, 20)), 100);
  assert.equal(engagementRate(c(1000, 50, 20, 10, 20)), 10);
  assert.equal(engagementRate(c(3, 1)), 33.33);
});

test('views เป็น 0 / null → ER null ไม่หารศูนย์', () => {
  assert.equal(engagementRate(c(0, 5)), null);
  assert.equal(engagementRate(c(null, 5)), null);
});

test('ขอบเขตป้ายแมส: ER 10% เป๊ะ + views 50,000 เป๊ะ = ติด', () => {
  assert.equal(isViral(c(50_000, 5_000)), true);
});

test('views 49,999 ไม่ติด แม้ ER สูง', () => {
  assert.equal(isViral(c(49_999, 40_000)), false);
});

test('ER 9.99% ไม่ติด แม้ views เยอะ', () => {
  assert.equal(isViral(c(100_000, 9_990)), false);
  assert.equal(isViral(c(100_000, 10_000)), true);
});

test('ไม่ใช้ทศนิยมตัดสิน: ER ใกล้ 10 ที่ float อาจปัดผิด', () => {
  // 3 / 30 * 100 ใน float = 10.000000000000002 / 7/70 ก็ใกล้เคียง; เทียบด้วยจำนวนเต็มต้องติด
  assert.equal(isViral(c(70_000, 7_000)), true);
  assert.equal(isViral(c(70_000, 6_999)), false);
});

test('views null → ไม่ติด, saves null → ER บางส่วน', () => {
  assert.equal(isViral(c(null, 10)), false);
  assert.equal(isErPartial(c(1000, 1, 1, 1, null)), true);
  assert.equal(isErPartial(c(1000, 1, 1, 1, 0)), false);
});
