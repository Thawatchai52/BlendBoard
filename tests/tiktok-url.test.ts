import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTikTokHost, parseTikTokUrl } from '../lib/tiktok-url.ts';

test('ลิงก์คลิปปกติ ตัด query/hash และได้ videoId', () => {
  const r = parseTikTokUrl('https://www.tiktok.com/@kudsan/video/7301234567890123456?is_from_webapp=1&sender_device=pc#x');
  assert.deepEqual(r, { ok: true, url: 'https://www.tiktok.com/@kudsan/video/7301234567890123456', videoId: '7301234567890123456' });
});

test('ไม่มี https:// และไม่มี www ก็ normalize เป็นรูปเดียวกัน (กันส่งซ้ำ)', () => {
  const a = parseTikTokUrl('tiktok.com/@kudsan/video/7301234567890123456');
  const b = parseTikTokUrl('https://m.tiktok.com/@kudsan/video/7301234567890123456/');
  assert.ok(a.ok && b.ok && a.url === b.url);
});

test('ลิงก์แชร์แบบสั้น vm./vt. ใช้ได้ ไม่มี videoId', () => {
  const r = parseTikTokUrl('https://vm.tiktok.com/ZMabc123/');
  assert.deepEqual(r, { ok: true, url: 'https://vm.tiktok.com/ZMabc123', videoId: null });
  assert.ok(parseTikTokUrl('https://www.tiktok.com/t/ZTabc123/').ok);
});

test('โดเมนปลอม / โดเมนที่แค่ลงท้ายคล้าย tiktok.com ถูกปฏิเสธ', () => {
  for (const u of [
    'https://evil.com/@a/video/7301234567890123456',
    'https://tiktok.com.evil.com/@a/video/7301234567890123456',
    'https://nottiktok.com/@a/video/7301234567890123456',
    'https://tiktok.com@evil.com/@a/video/7301234567890123456',
    'http://127.0.0.1/video/7301234567890123456',
  ]) {
    assert.equal(parseTikTokUrl(u).ok, false, u);
  }
});

test('ไม่ใช่ลิงก์คลิป (โปรไฟล์ / หน้าแรก) และโปรโตคอลแปลก ๆ ถูกปฏิเสธ', () => {
  assert.equal(parseTikTokUrl('https://www.tiktok.com/@kudsan').ok, false);
  assert.equal(parseTikTokUrl('https://www.tiktok.com/').ok, false);
  assert.equal(parseTikTokUrl('javascript:alert(1)').ok, false);
  assert.equal(parseTikTokUrl('').ok, false);
});

test('isTikTokHost แยกลิงก์ TikTok ออกจากลิงก์ส่งงานทั่วไป (โดเมนปลอมไม่ผ่าน)', () => {
  assert.equal(isTikTokHost('https://www.tiktok.com/@a/video/7301234567890123456'), true);
  assert.equal(isTikTokHost('https://vm.tiktok.com/ZSabc/'), true);
  assert.equal(isTikTokHost('https://drive.google.com/file/d/1'), false);
  assert.equal(isTikTokHost('https://tiktok.com.evil.com/@a/video/7301234567890123456'), false);
  assert.equal(isTikTokHost('not a url'), false);
});
