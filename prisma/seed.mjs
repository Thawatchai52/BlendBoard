// รัน:  npx prisma db seed   — สร้าง 2 แบรนด์ (ใช้ upsert รันซ้ำได้ ไม่ซ้ำ)
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const brands = [
  { code: 'KS', name: 'Kudsan', color: '#F76707' },
  { code: 'BL', name: "Bellinee's", color: '#8B5A2B' },
];
for (const b of brands) {
  await prisma.brand.upsert({ where: { code: b.code }, update: { name: b.name, color: b.color }, create: b });
}
console.log('seeded brands:', brands.map((b) => b.code).join(', '));
await prisma.$disconnect();
