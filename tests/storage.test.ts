import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presignQuery } from '../lib/storage.ts';

// ตัวอย่างทางการจากเอกสาร AWS "Authenticating Requests: Using Query Parameters (AWS Signature V4)"
test('SigV4 presign ตรงกับตัวอย่างของ AWS', () => {
  const q = presignQuery({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expires: 86400,
    now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(q, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});
