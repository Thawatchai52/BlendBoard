-- ตั้งค่าฐานข้อมูลกลางให้ทุกคนเห็นข้อมูลตรงกัน (Supabase)
-- วิธีใช้: Supabase → SQL Editor → วางทั้งไฟล์นี้ → Run (รันซ้ำได้ ไม่พัง)

create table if not exists public.items (
  kind       text        not null,            -- tasks | stock | saved | manual
  id         text        not null,
  data       jsonb       not null default '{}',
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists items_kind_updated on public.items (kind, updated_at);

create or replace function public.items_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

alter table public.items enable row level security;

-- ผู้ใช้เว็บ (anon key) อ่าน / เพิ่ม / แก้ได้ · ไม่ให้ลบจริง (ลบ = ติดธง deleted)
drop policy if exists items_read   on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
create policy items_read   on public.items for select to anon using (true);
create policy items_insert on public.items for insert to anon with check (true);
create policy items_update on public.items for update to anon using (true) with check (true);
