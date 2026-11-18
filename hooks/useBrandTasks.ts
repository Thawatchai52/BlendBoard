// hooks/useBrandTasks.ts
// Content Isolation: ข้อมูลของแต่ละแบรนด์เป็นคนละ cache และคนละ request
// สลับแบรนด์ = queryKey เปลี่ยน → ไม่มีทางเห็นการ์ดของอีกฝั่งค้างอยู่
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useBrand, useBrandFilters } from '@/lib/brand-store';

export function useBrandTasks(month: Date) {
  const brand = useBrand();
  const { statuses, platforms } = useBrandFilters();
  const ym = format(month, 'yyyy-MM');

  const query = useQuery({
    // brand อยู่ใน key เสมอ
    queryKey: ['tasks', brand, ym],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?brand=${brand}&month=${ym}`);
      if (!res.ok) throw new Error('load failed');
      return res.json() as Promise<import('@/lib/types').ContentTask[]>;
    },
    // เปลี่ยนเดือนในแบรนด์เดิมให้ลื่น แต่ห้ามเอาข้อมูลแบรนด์ก่อนหน้ามาค้าง
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === brand ? prev : undefined,
  });

  // ตัวกรองสถานะ/แพลตฟอร์มทำฝั่ง client หลังได้ข้อมูลของแบรนด์นั้นแล้ว
  const tasks = (query.data ?? []).filter(
    (t) =>
      (!statuses.length || statuses.includes(t.status)) &&
      (!platforms.length || t.platforms.some((p) => platforms.includes(p))),
  );

  return { ...query, tasks };
}

/*
  ฝั่ง server (app/api/tasks/route.ts) ต้องบังคับแยกข้อมูลซ้ำอีกชั้น
  ห้ามเชื่อ query string อย่างเดียว:

    const brand = searchParams.get('brand');
    if (!user.brands.includes(brand)) return new Response('Forbidden', { status: 403 });
    prisma.contentTask.findMany({ where: { brand: { code: brand }, publishDate: { gte, lt } } });

  แล้วให้ Mutation (สร้าง/แก้/ลบ) ตรวจ brandId ตามสิทธิ์ผู้ใช้เช่นกัน
*/
