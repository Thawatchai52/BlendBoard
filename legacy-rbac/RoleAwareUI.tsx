'use client';
// components/tasks/RoleAwareUI.tsx
// ตัวอย่างการปรับ UI ตาม role: ปุ่มหัวหน้า, ปุ่มของกราฟิก, แผงตรวจงาน, การ์ดที่ลากได้/ไม่ได้
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { Can, usePermissions } from '@/lib/session-store';
import type { Status } from '@/lib/permissions';

interface TaskView {
  id: string;
  title: string;
  brandId: string;
  assigneeId?: string | null;
  status: Status;
  lastReview?: { decision: 'APPROVED' | 'REJECTED'; comment?: string | null; roundNo: number } | null;
  attachments: { id: string; fileName: string; url: string; purpose: 'REFERENCE' | 'DELIVERABLE' }[];
}

/* --------------------------- เรียก API เปลี่ยนสถานะ --------------------------- */
function useTransition(taskId: string) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(to: Status, comment?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, comment }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(res.status === 403 ? 'ไม่มีสิทธิ์ทำรายการนี้' : j.reason ?? 'ทำรายการไม่สำเร็จ');
      }
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ['tasks'] }); // 403/409 ก็ refetch ให้ UI ตรงกับความจริง
    }
  }
  return { run, error, busy };
}

/* ------------------------------ ฝั่งกราฟิก (Viewer) ------------------------------ */
export function SubmitWorkPanel({ task }: { task: TaskView }) {
  const { can, transitionsFor } = usePermissions();
  const { run, error, busy } = useTransition(task.id);
  const next = transitionsFor(task);

  if (!can('status:submit', task)) return null; // ไม่ใช่งานของเรา → ไม่เห็นแผงนี้

  const deliverables = task.attachments.filter((a) => a.purpose === 'DELIVERABLE');

  return (
    <section className="space-y-3 rounded-brand border border-line bg-surface-2 p-3">
      <h3 className="font-head text-sm font-semibold">ส่งงานของคุณ</h3>

      {/* Reject ล่าสุด แสดงเด่นเพื่อให้รู้ว่าต้องแก้อะไร */}
      {task.status === 'REVISION' && task.lastReview?.decision === 'REJECTED' && (
        <div className="rounded-brand bg-red-100 p-3 text-sm text-red-900">
          <b>ผู้ตรวจให้แก้ (รอบที่ {task.lastReview.roundNo})</b>
          <p className="mt-1 whitespace-pre-wrap">{task.lastReview.comment}</p>
        </div>
      )}

      {/* อัปโหลดได้เฉพาะ DRAFT / REVISION ตรงกับกติกาที่ API ตรวจ */}
      {(task.status === 'DRAFT' || task.status === 'REVISION') && (
        <Can action="file:upload_deliverable" task={task}>
          {/* ใช้ <FileUploader purpose="DELIVERABLE" taskId={task.id} /> จาก TaskModal เดิม */}
          <p className="text-sm text-muted">ไฟล์ส่งงาน {deliverables.length} ไฟล์</p>
        </Can>
      )}

      <div className="flex flex-wrap gap-2">
        {next.includes('IN_REVIEW') && (
          <button
            disabled={busy || deliverables.length === 0}
            onClick={() => run('IN_REVIEW')}
            className="rounded-brand bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            ส่งงานตรวจ
          </button>
        )}
        {next.includes('DRAFT') && task.status === 'IN_REVIEW' && (
          <button disabled={busy} onClick={() => run('DRAFT')} className="rounded-brand border border-line px-4 py-2 text-sm">
            ถอนงานกลับมาแก้
          </button>
        )}
      </div>
      {deliverables.length === 0 && next.includes('IN_REVIEW') && (
        <p className="text-xs text-muted">แนบไฟล์ส่งงานอย่างน้อย 1 ไฟล์ก่อนจึงจะส่งตรวจได้</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

/* ------------------------------ ฝั่งหัวหน้า (Manager/Admin) ------------------------------ */
export function ReviewPanel({ task }: { task: TaskView }) {
  const { run, error, busy } = useTransition(task.id);
  const [comment, setComment] = useState('');
  const [needComment, setNeedComment] = useState(false);

  return (
    <Can action="status:review" task={task}>
      {task.status === 'IN_REVIEW' && (
        <section className="space-y-3 rounded-brand border border-line bg-surface-2 p-3">
          <h3 className="font-head text-sm font-semibold">ตรวจงาน</h3>

          <label className="block space-y-1">
            <span className="text-sm font-medium">คอมเมนต์ (บังคับเมื่อตีกลับ)</span>
            <textarea
              value={comment}
              onChange={(e) => { setComment(e.target.value); setNeedComment(false); }}
              rows={3}
              className="w-full rounded-brand border border-line bg-bg p-2 text-sm"
              placeholder="เช่น ปรับโทนสีให้อบอุ่นขึ้น และเปลี่ยนข้อความ CTA"
            />
          </label>
          {needComment && <p className="text-sm text-red-600">กรุณาระบุสิ่งที่ต้องแก้ก่อนตีกลับ</p>}

          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run('APPROVED', comment || undefined)}
              className="rounded-brand bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Approve
            </button>
            <button disabled={busy}
              onClick={() => (comment.trim() ? run('REVISION', comment) : setNeedComment(true))}
              className="rounded-brand bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Reject / ให้แก้
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      )}

      {task.status === 'APPROVED' && (
        <button disabled={busy} onClick={() => run('POSTED')}
          className="rounded-brand bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          ทำเครื่องหมายว่าโพสต์แล้ว
        </button>
      )}
    </Can>
  );
}

/* ------------------------------ การ์ด Drag & Drop ที่รู้จัก role ------------------------------ */
export function TaskCard({ task }: { task: TaskView }) {
  const { can, user } = usePermissions();
  const canMove = can('task:reschedule', task);
  const mine = task.assigneeId === user?.id;

  // Viewer: disabled → dnd-kit ไม่ผูก pointer listener เลย ลากไม่ได้ ไม่ใช่แค่ซ่อนเคอร์เซอร์
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canMove });

  return (
    <div
      ref={setNodeRef}
      {...(canMove ? listeners : {})}
      {...attributes}
      className={`rounded-brand border border-line bg-surface p-3 ${canMove ? 'cursor-grab' : 'cursor-pointer'} ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{task.title}</span>
        {mine && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg">งานของคุณ</span>}
      </div>
    </div>
  );
}

/* ------------------------------ ปุ่มระดับหน้า ------------------------------ */
export function DashboardToolbarActions() {
  return (
    <>
      <Can action="task:create">
        <button className="rounded-brand bg-accent px-4 py-2 font-semibold text-accent-fg">+ สร้างบรีฟ</button>
      </Can>
      {/* ตัวกรอง "เฉพาะงานของฉัน" มีประโยชน์กับ Viewer มากที่สุด */}
    </>
  );
}

/* ------------------------------ ลูกเล่นใน TaskModal ------------------------------
   <TaskModal task={task}>
     <Can action="task:edit" fallback={<BriefReadOnly task={task} />}>
       <BriefForm task={task} />                  // ฟอร์มแก้ไขเต็ม (Manager)
     </Can>
     <Attachments task={task} downloadOnly={!can('file:upload_reference')} />
     <SubmitWorkPanel task={task} />              // Viewer ของงานนี้
     <ReviewPanel task={task} />                  // Manager
     <Can action="task:delete" task={task}><DeleteButton /></Can>
   </TaskModal>
--------------------------------------------------------------------------------- */
