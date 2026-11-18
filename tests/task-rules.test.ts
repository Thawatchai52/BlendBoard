import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canChangeAttachment, canTransition, checkTransition, isAllowedMime, isHttpsUrl, sanitizeFileName, validAttachmentKey } from '../lib/task-rules.ts';

test('Viewer เปลี่ยนสถานะได้เฉพาะ ส่งตรวจ / ถอนกลับ', () => {
  assert.equal(canTransition('VIEWER', 'DRAFT', 'IN_REVIEW'), true);
  assert.equal(canTransition('VIEWER', 'REVISION', 'IN_REVIEW'), true);
  assert.equal(canTransition('VIEWER', 'IN_REVIEW', 'DRAFT'), true);
  for (const [f, t] of [['IN_REVIEW', 'APPROVED'], ['IN_REVIEW', 'REVISION'], ['DRAFT', 'APPROVED'], ['APPROVED', 'POSTED'], ['APPROVED', 'DRAFT'], ['POSTED', 'DRAFT']] as const) {
    assert.equal(canTransition('VIEWER', f, t), false, `${f}->${t}`);
  }
});

test('Admin เปลี่ยนได้ทุกเส้นทาง ยกเว้นสถานะเดิม / ไม่ล็อกอิน', () => {
  assert.equal(canTransition('ADMIN', 'APPROVED', 'DRAFT'), true);
  assert.equal(canTransition('ADMIN', 'DRAFT', 'DRAFT'), false);
  assert.equal(canTransition(null, 'DRAFT', 'IN_REVIEW'), false);
});

test('ตีกลับต้องมีคอมเมนต์ (ช่องว่างล้วนไม่นับ)', () => {
  const base = { role: 'ADMIN', from: 'IN_REVIEW', to: 'REVISION', deliverableCount: 1 } as const;
  assert.deepEqual(checkTransition({ ...base }), { ok: false, http: 400, error: 'COMMENT_REQUIRED', reason: 'ตีกลับต้องระบุสิ่งที่ต้องแก้' });
  assert.equal(checkTransition({ ...base, comment: '   ' }).ok, false);
  assert.deepEqual(checkTransition({ ...base, comment: 'แก้สีโลโก้' }), { ok: true, reject: true });
});

test('ย้ายไป "ให้แก้" จากสถานะอื่นที่ไม่ใช่รอตรวจ ไม่นับเป็นการตีกลับ', () => {
  const r = checkTransition({ role: 'ADMIN', from: 'APPROVED', to: 'REVISION', deliverableCount: 0 });
  assert.deepEqual(r, { ok: true, reject: false });
});

test('ส่งตรวจต้องมีไฟล์/ลิงก์ส่งงานอย่างน้อย 1', () => {
  const r = checkTransition({ role: 'VIEWER', from: 'DRAFT', to: 'IN_REVIEW', deliverableCount: 0 });
  assert.ok(!r.ok && r.error === 'DELIVERABLE_REQUIRED' && r.http === 400);
  assert.deepEqual(checkTransition({ role: 'VIEWER', from: 'DRAFT', to: 'IN_REVIEW', deliverableCount: 1 }), { ok: true, reject: false });
});

test('Viewer ทำเกินสิทธิ์ได้ 403 (ก่อนเช็กเงื่อนไขอื่น)', () => {
  const r = checkTransition({ role: 'VIEWER', from: 'IN_REVIEW', to: 'APPROVED', deliverableCount: 1 });
  assert.ok(!r.ok && r.http === 403);
  const u = checkTransition({ role: null, from: 'DRAFT', to: 'IN_REVIEW', deliverableCount: 1 });
  assert.ok(!u.ok && u.http === 401);
});

test('สิทธิ์ไฟล์แนบ: Viewer แนบไฟล์ส่งงานได้เฉพาะ Draft/ให้แก้', () => {
  assert.equal(canChangeAttachment('VIEWER', 'DELIVERABLE', 'DRAFT'), true);
  assert.equal(canChangeAttachment('VIEWER', 'DELIVERABLE', 'REVISION'), true);
  assert.equal(canChangeAttachment('VIEWER', 'DELIVERABLE', 'IN_REVIEW'), false);
  assert.equal(canChangeAttachment('VIEWER', 'DELIVERABLE', 'APPROVED'), false);
  assert.equal(canChangeAttachment('VIEWER', 'REFERENCE', 'DRAFT'), false);
  assert.equal(canChangeAttachment('ADMIN', 'REFERENCE', 'POSTED'), true);
  assert.equal(canChangeAttachment(null, 'DELIVERABLE', 'DRAFT'), false);
});

test('key ของไฟล์ต้องอยู่ใต้โฟลเดอร์แบรนด์เดียวกัน', () => {
  assert.equal(validAttachmentKey('brandA/task1/uuid-a.png', 'brandA'), true);
  assert.equal(validAttachmentKey('brandB/task1/a.png', 'brandA'), false);
  assert.equal(validAttachmentKey('brandA/../brandB/a.png', 'brandA'), false);
  assert.equal(validAttachmentKey('brandA//a.png', 'brandA'), false);
  assert.equal(validAttachmentKey('brandAx/a.png', 'brandA'), false);
  assert.equal(validAttachmentKey('brandA/a b.png', 'brandA'), false);
});

test('ชื่อไฟล์ถูกทำความสะอาด ตัด path และอักขระแปลก', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFileName('C:\\x\\รูป โปรโมชัน.PNG'), '_.PNG');
  assert.match(sanitizeFileName('a b#c?.jpg'), /^[A-Za-z0-9._-]+$/);
  assert.equal(sanitizeFileName('.hidden'), 'hidden');
  assert.ok(sanitizeFileName('x'.repeat(500) + '.png').length <= 80);
});

test('ชนิดไฟล์ที่รับ และลิงก์ต้องเป็น https', () => {
  assert.equal(isAllowedMime('image/png'), true);
  assert.equal(isAllowedMime('video/mp4'), true);
  assert.equal(isAllowedMime('application/pdf'), true);
  assert.equal(isAllowedMime('text/html'), false);
  assert.equal(isAllowedMime('application/x-msdownload'), false);
  assert.equal(isHttpsUrl('https://www.tiktok.com/@a/video/123'), true);
  assert.equal(isHttpsUrl('http://x.com'), false);
  assert.equal(isHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isHttpsUrl('https://u:p@x.com'), false);
});
