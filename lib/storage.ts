// lib/storage.ts — ลงนาม URL (AWS SigV4 แบบ query) สำหรับ storage ที่เข้ากันได้กับ S3
// ใช้ได้กับ Cloudflare R2, Supabase Storage (S3), AWS S3, MinIO  ไม่ต้องพึ่ง SDK
//   env: S3_ENDPOINT  เช่น https://<account>.r2.cloudflarestorage.com  หรือ https://<ref>.supabase.co/storage/v1/s3
//        S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION (R2 ใช้ auto)
//   ใช้ URL แบบ path-style:  {endpoint}/{bucket}/{key}
import { createHash, createHmac } from 'node:crypto';

const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();

/** encodeURIComponent แบบเข้มตามที่ AWS กำหนด (เข้ารหัส ! ' ( ) * ด้วย) */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export interface PresignInput {
  method: 'GET' | 'PUT' | 'DELETE';
  host: string; // รวมพอร์ตถ้ามี
  path: string; // ขึ้นต้นด้วย "/" แต่ละ segment ยังไม่เข้ารหัส
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expires: number; // วินาที (สูงสุด 604800)
  now?: Date;
  service?: string;
}

/** คืน query string ที่ลงนามแล้ว (ต่อท้าย https://host + path ได้เลย) */
export function presignQuery(i: PresignInput): string {
  const service = i.service ?? 's3';
  const amzDate = (i.now ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${i.region}/${service}/aws4_request`;

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${i.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.min(Math.max(1, Math.floor(i.expires)), 604800)),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(params)
    .map((k) => [enc(k), enc(params[k])] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalPath = i.path.split('/').map(enc).join('/');
  const canonicalRequest = [i.method, canonicalPath, canonicalQuery, `host:${i.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac('AWS4' + i.secretAccessKey, date);
  const kRegion = hmac(kDate, i.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return `${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/* ------------------------------ ตัวห่อที่อ่านค่าจาก env ------------------------------ */
interface Cfg {
  base: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function config(): Cfg | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    base: new URL(S3_ENDPOINT),
    bucket: S3_BUCKET,
    region: S3_REGION || 'auto',
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

export const storageConfigured = () => config() !== null;

/** URL ชั่วคราวสำหรับ GET / PUT / DELETE ไฟล์ใน storage (null = ยังไม่ได้ตั้งค่า storage) */
export function presignedUrl(method: 'GET' | 'PUT' | 'DELETE', key: string, expires: number): string | null {
  const c = config();
  if (!c) return null;
  const path = `${c.base.pathname.replace(/\/+$/, '')}/${c.bucket}/${key}`;
  const q = presignQuery({ method, host: c.base.host, path, region: c.region, accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, expires });
  return `${c.base.protocol}//${c.base.host}${path.split('/').map(enc).join('/')}?${q}`;
}

/** ลบไฟล์จาก storage แบบ best-effort (ลบไม่สำเร็จไม่ทำให้คำสั่งหลักล้ม) */
export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key) return;
  const url = presignedUrl('DELETE', key, 60);
  if (!url) return;
  try {
    await fetch(url, { method: 'DELETE' });
  } catch {
    /* ปล่อยผ่าน: ไฟล์ค้างใน storage ไม่กระทบข้อมูลในระบบ */
  }
}
