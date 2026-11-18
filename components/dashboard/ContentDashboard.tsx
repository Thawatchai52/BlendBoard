"use client";
// components/dashboard/ContentDashboard.tsx
// deps: @dnd-kit/core, @tanstack/react-query, date-fns, lucide-react, tailwindcss
import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { th } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Plus } from "lucide-react";
import {
  Brand, ContentTask, Filters, PLATFORMS, PLATFORM_META, Platform, STATUSES, STATUS_META, Status,
} from "@/lib/types";
import { usePermissions } from "@/components/role-store";
import { TaskModal } from "./TaskModal";

type View = "calendar" | "kanban";

/* ------------------------------ data hooks ------------------------------ */
function useTasks(month: Date, filters: Filters) {
  const from = startOfWeek(startOfMonth(month)).toISOString();
  const to = endOfWeek(endOfMonth(month)).toISOString();
  return useQuery<ContentTask[]>({
    queryKey: ["tasks", from, to],
    queryFn: async () => (await fetch(`/api/tasks?from=${from}&to=${to}`)).json(),
  });
}

function usePatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<ContentTask, "status" | "publishDate">>) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("update failed");
      return res.json();
    },
    // Optimistic update: การ์ดย้ายทันทีที่วาง ถ้า error จะ rollback
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<ContentTask[]>({ queryKey: ["tasks"] });
      qc.setQueriesData<ContentTask[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/* ------------------------------ main component ------------------------------ */
export function ContentDashboard({ brands }: { brands: Brand[] }) {
  const [view, setView] = useState<View>("calendar");
  const [month, setMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<Filters>({ brandIds: [], statuses: [], platforms: [] });
  const [modal, setModal] = useState<{ open: boolean; task?: ContentTask; defaultDate?: Date }>({ open: false });
  const [dragging, setDragging] = useState<ContentTask | null>(null);
  const { can } = usePermissions();
  const canCreate = can("task:create");
  const canMove = can("task:reschedule");

  const { data: all = [], isLoading } = useTasks(month, filters);
  const patch = usePatchTask();

  // Filter ฝั่ง client — ว่าง = ไม่กรอง (เปลี่ยน Filter แล้วไม่ต้องโหลดใหม่ ไม่ต้องสลับหน้า)
  const tasks = useMemo(
    () =>
      all.filter(
        (t) =>
          (!filters.brandIds.length || filters.brandIds.includes(t.brandId)) &&
          (!filters.statuses.length || filters.statuses.includes(t.status)) &&
          (!filters.platforms.length || t.platforms.some((p) => filters.platforms.includes(p)))
      ),
    [all, filters]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => canMove && setDragging(tasks.find((t) => t.id === e.active.id) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!canMove) return;
    const task = tasks.find((t) => t.id === e.active.id);
    const overId = e.over?.id?.toString();
    if (!task || !overId) return;

    if (overId.startsWith("day:")) {
      // เลื่อนวัน — คงเวลาเดิมไว้
      const target = parseISO(overId.slice(4));
      const old = parseISO(task.publishDate);
      if (isSameDay(target, old)) return;
      target.setHours(old.getHours(), old.getMinutes());
      patch.mutate({ id: task.id, publishDate: target.toISOString() });
    } else if (overId.startsWith("status:")) {
      const status = overId.slice(7) as Status;
      if (status !== task.status) patch.mutate({ id: task.id, status });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Content Calendar</h1>

        <div className="ml-4 flex items-center gap-1">
          <button className="rounded p-1.5 hover:bg-slate-100" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="เดือนก่อนหน้า">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-36 text-center font-medium">{format(month, "LLLL yyyy", { locale: th })}</span>
          <button className="rounded p-1.5 hover:bg-slate-100" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="เดือนถัดไป">
            <ChevronRight size={18} />
          </button>
          <button className="ml-2 rounded border px-2 py-1 text-sm hover:bg-slate-100" onClick={() => setMonth(new Date())}>
            วันนี้
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border bg-slate-100 p-0.5 text-sm">
            <ViewBtn active={view === "calendar"} onClick={() => setView("calendar")} icon={<CalendarDays size={15} />} label="ปฏิทิน" />
            <ViewBtn active={view === "kanban"} onClick={() => setView("kanban")} icon={<Columns3 size={15} />} label="Kanban" />
          </div>
          {canCreate && (
            <button
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={() => setModal({ open: true })}
            >
              <Plus size={16} /> สร้างคอนเทนต์
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <FilterBar brands={brands} filters={filters} onChange={setFilters} />

        <main className="min-w-0 flex-1 overflow-auto p-4">
          {isLoading ? (
            <p className="text-slate-500">กำลังโหลด...</p>
          ) : (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              {view === "calendar" ? (
                <CalendarView
                  month={month}
                  tasks={tasks}
                  onOpen={(task) => setModal({ open: true, task })}
                  onCreate={(date) => setModal({ open: true, defaultDate: date })}
                />
              ) : (
                <KanbanBoard tasks={tasks} onOpen={(task) => setModal({ open: true, task })} />
              )}
              <DragOverlay>{dragging && <TaskCard task={dragging} overlay />}</DragOverlay>
            </DndContext>
          )}
        </main>
      </div>

      <TaskModal
        open={modal.open}
        task={modal.task}
        defaultDate={modal.defaultDate}
        brands={brands}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-3 py-1.5 ${active ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
    >
      {icon} {label}
    </button>
  );
}

/* ------------------------------ Filter bar ------------------------------ */
function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function FilterBar({ brands, filters, onChange }: { brands: Brand[]; filters: Filters; onChange: (f: Filters) => void }) {
  const active = filters.brandIds.length + filters.statuses.length + filters.platforms.length;
  return (
    <aside className="hidden w-56 shrink-0 space-y-5 overflow-y-auto border-r bg-white p-4 md:block">
      <FilterGroup title="แบรนด์">
        {brands.map((b) => (
          <Check
            key={b.id}
            checked={filters.brandIds.includes(b.id)}
            onChange={() => onChange({ ...filters, brandIds: toggle(filters.brandIds, b.id) })}
            label={`${b.name} (${b.code})`}
            dotStyle={{ backgroundColor: b.color }}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="สถานะ">
        {STATUSES.map((s) => (
          <Check
            key={s}
            checked={filters.statuses.includes(s)}
            onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
            label={STATUS_META[s].label}
            dotClass={STATUS_META[s].dot}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="แพลตฟอร์ม">
        {PLATFORMS.map((p) => (
          <Check
            key={p}
            checked={filters.platforms.includes(p)}
            onChange={() => onChange({ ...filters, platforms: toggle(filters.platforms, p) })}
            label={PLATFORM_META[p].label}
          />
        ))}
      </FilterGroup>

      {active > 0 && (
        <button className="text-sm text-rose-600 underline" onClick={() => onChange({ brandIds: [], statuses: [], platforms: [] })}>
          ล้างตัวกรอง ({active})
        </button>
      )}
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Check({
  checked, onChange, label, dotClass, dotStyle,
}: { checked: boolean; onChange: () => void; label: string; dotClass?: string; dotStyle?: React.CSSProperties }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded" />
      {(dotClass || dotStyle) && <span className={`h-2.5 w-2.5 rounded-full ${dotClass ?? ""}`} style={dotStyle} />}
      {label}
    </label>
  );
}

/* ------------------------------ Calendar view ------------------------------ */
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function CalendarView({
  month, tasks, onOpen, onCreate,
}: { month: Date; tasks: ContentTask[]; onOpen: (t: ContentTask) => void; onCreate: (d: Date) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="grid grid-cols-7 border-b bg-slate-50 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            muted={!isSameMonth(day, month)}
            tasks={tasks.filter((t) => isSameDay(parseISO(t.publishDate), day))}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day, muted, tasks, onOpen, onCreate,
}: { day: Date; muted: boolean; tasks: ContentTask[]; onOpen: (t: ContentTask) => void; onCreate: (d: Date) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${format(day, "yyyy-MM-dd")}` });
  const today = isSameDay(day, new Date());
  const { can } = usePermissions();
  return (
    <div
      ref={setNodeRef}
      className={`group min-h-28 border-b border-r p-1.5 ${muted ? "bg-slate-50/60" : ""} ${isOver ? "bg-sky-50 ring-2 ring-inset ring-sky-300" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-slate-900 font-semibold text-white" : muted ? "text-slate-400" : "text-slate-600"}`}>
          {format(day, "d")}
        </span>
        {can("task:create") && (
          <button
            className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
            onClick={() => onCreate(day)}
            aria-label="เพิ่มคอนเทนต์ในวันนี้"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="space-y-1">
        {tasks.map((t) => <TaskChip key={t.id} task={t} onOpen={() => onOpen(t)} />)}
      </div>
    </div>
  );
}

function TaskChip({ task, onOpen }: { task: ContentTask; onOpen: () => void }) {
  const { can } = usePermissions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !can("task:reschedule") });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={{ borderLeftColor: task.brand.color }}
      className={`flex w-full items-center gap-1 rounded border border-l-4 bg-white px-1.5 py-1 text-left text-xs shadow-sm hover:shadow ${isDragging ? "opacity-40" : ""}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[task.status].dot}`} />
      <span className="truncate">{task.title}</span>
    </button>
  );
}

/* ------------------------------ Kanban view ------------------------------ */
function KanbanBoard({ tasks, onOpen }: { tasks: ContentTask[]; onOpen: (t: ContentTask) => void }) {
  return (
    <div className="grid h-full min-w-[900px] grid-cols-5 gap-3">
      {STATUSES.map((s) => (
        <KanbanColumn key={s} status={s} tasks={tasks.filter((t) => t.status === s)} onOpen={onOpen} />
      ))}
    </div>
  );
}

function KanbanColumn({ status, tasks, onOpen }: { status: Status; tasks: ContentTask[]; onOpen: (t: ContentTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` });
  const meta = STATUS_META[status];
  return (
    <section ref={setNodeRef} className={`flex min-h-0 flex-col rounded-xl bg-slate-100 p-2 ${isOver ? "ring-2 ring-sky-300" : ""}`}>
      <header className="mb-2 flex items-center justify-between px-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
        <span className="text-xs text-slate-500">{tasks.length}</span>
      </header>
      <div className="space-y-2 overflow-y-auto">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} onOpen={() => onOpen(t)} />)}
      </div>
    </section>
  );
}

function DraggableCard({ task, onOpen }: { task: ContentTask; onOpen: () => void }) {
  const { can } = usePermissions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !can("task:reschedule") });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} className={isDragging ? "opacity-40" : ""}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, overlay }: { task: ContentTask; overlay?: boolean }) {
  const cover = task.attachments.find((a) => a.kind === "IMAGE");
  return (
    <article
      style={{ borderLeftColor: task.brand.color }}
      className={`cursor-grab overflow-hidden rounded-lg border border-l-4 bg-white text-sm shadow-sm ${overlay ? "rotate-2 shadow-lg" : ""}`}
    >
      {cover && <img src={cover.url} alt="" className="h-24 w-full object-cover" />}
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold" style={{ color: task.brand.color }}>{task.brand.code}</span>
          <span>{format(parseISO(task.publishDate), "d MMM HH:mm", { locale: th })}</span>
        </div>
        <p className="font-medium leading-snug">{task.title}</p>
        <div className="flex flex-wrap gap-1">
          {task.platforms.map((p: Platform) => (
            <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{PLATFORM_META[p].short}</span>
          ))}
          {task.attachments.length > 0 && (
            <span className="ml-auto text-[10px] text-slate-500">📎 {task.attachments.length}</span>
          )}
        </div>
      </div>
    </article>
  );
}
