"use client";
// components/dashboard/TaskModal.tsx
// deps: react-hook-form, zod, @hookform/resolvers, @tanstack/react-query, date-fns, lucide-react
// ใช้ <dialog> ปกติเพื่อให้ตัวอย่างรันได้เลย (ถ้าใช้ shadcn/ui ให้สลับเป็น <Dialog> ได้)
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { FileText, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { usePermissions } from "@/components/role-store";
import {
  Attachment, AttachmentKind, Brand, ContentTask, PLATFORMS, PLATFORM_META, STATUSES, STATUS_META,
} from "@/lib/types";

/* ------------------------------ validation ------------------------------ */
const formSchema = z.object({
  title: z.string().min(1, "กรุณาใส่หัวข้อคอนเทนต์").max(150),
  caption: z.string().max(5000).optional(),
  brandId: z.string().min(1, "เลือกแบรนด์"),
  platforms: z.array(z.enum(PLATFORMS)).min(1, "เลือกอย่างน้อย 1 แพลตฟอร์ม"),
  status: z.enum(STATUSES),
  publishDate: z.string().min(1, "เลือกวัน-เวลาที่จะโพสต์"), // datetime-local
  briefDueAt: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const MAX_FILE_MB = 200;
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

const kindOf = (mime: string): AttachmentKind =>
  mime.startsWith("image/") ? "IMAGE" : mime.startsWith("video/") ? "VIDEO" : "DOCUMENT";

/* ------------------------------ component ------------------------------ */
interface Props {
  open: boolean;
  task?: ContentTask;      // มี = แก้ไข, ไม่มี = สร้างใหม่
  defaultDate?: Date;      // กดจากช่องวันที่ในปฏิทิน
  brands: Brand[];
  onClose: () => void;
}

export function TaskModal({ open, task, defaultDate, brands, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const qc = useQueryClient();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { can } = usePermissions();
  const readOnly = !can("task:edit"); // Viewer = อ่านอย่างเดียว (ตัวบังคับจริงคือ API)

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  // เปิด/ปิด dialog + เติมค่าเริ่มต้น
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    if (open) {
      const base = defaultDate ? new Date(defaultDate.setHours(10, 0, 0, 0)) : new Date();
      reset({
        title: task?.title ?? "",
        caption: task?.caption ?? "",
        brandId: task?.brandId ?? brands[0]?.id ?? "",
        platforms: task?.platforms ?? [],
        status: task?.status ?? "DRAFT",
        publishDate: toLocalInput(task ? parseISO(task.publishDate) : base),
        briefDueAt: task?.briefDueAt ? toLocalInput(parseISO(task.briefDueAt)) : "",
      });
      setAttachments(task?.attachments ?? []);
    }
  }, [open, task, defaultDate, brands, reset]);

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        ...v,
        publishDate: new Date(v.publishDate).toISOString(),
        briefDueAt: v.briefDueAt ? new Date(v.briefDueAt).toISOString() : null,
        attachments, // server จะ sync ตาราง Attachment ให้
      };
      const res = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!task || !confirm("ลบคอนเทนต์นี้?")) return;
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const status = watch("status");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(960px,95vw)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="flex max-h-[90vh] flex-col">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">{readOnly ? "บรีฟคอนเทนต์" : task ? "แก้ไขคอนเทนต์" : "สร้างคอนเทนต์ใหม่"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="ปิด">
            <X size={18} />
          </button>
        </header>

        <fieldset disabled={readOnly} className="grid min-w-0 flex-1 gap-6 overflow-y-auto border-0 p-5 md:grid-cols-2">
          {/* ---------- ซ้าย: ข้อมูลบรีฟ ---------- */}
          <div className="space-y-4">
            <Field label="หัวข้อคอนเทนต์" error={errors.title?.message}>
              <input {...register("title")} className="input" placeholder="เช่น โปรโมชันสงกรานต์ — โพสต์ทีเซอร์" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="แบรนด์" error={errors.brandId?.message}>
                <select {...register("brandId")} className="input">
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </Field>
              <Field label="สถานะ">
                <select {...register("status")} className="input">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="แพลตฟอร์มเป้าหมาย" error={errors.platforms?.message as string | undefined}>
              <Controller
                control={control}
                name="platforms"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const on = field.value?.includes(p);
                      return (
                        <button
                          type="button"
                          key={p}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== p) : [...(field.value ?? []), p])}
                          className={`rounded-full border px-3 py-1 text-sm ${on ? "border-slate-900 bg-slate-900 text-white" : "hover:bg-slate-100"}`}
                        >
                          {PLATFORM_META[p].label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="วัน-เวลาโพสต์" error={errors.publishDate?.message}>
                <input type="datetime-local" {...register("publishDate")} className="input" />
              </Field>
              <Field label="กำหนดส่งบรีฟ/งาน">
                <input type="datetime-local" {...register("briefDueAt")} className="input" />
              </Field>
            </div>

            <Field label="Caption / Copywriting">
              <textarea {...register("caption")} rows={8} className="input resize-y" placeholder="พิมพ์แคปชั่น, แฮชแท็ก, CTA..." />
              <CharCount control={control} />
            </Field>
          </div>

          {/* ---------- ขวา: ไฟล์แนบ ---------- */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">ไฟล์แนบ (Artwork / วิดีโอ / Reference)</h3>
            {!readOnly && <FileUploader brandId={watch("brandId")} taskId={task?.id} onUploaded={(a) => setAttachments((prev) => [...prev, a])} />}
            <ul className="grid grid-cols-2 gap-3">
              {attachments.map((a) => (
                <AttachmentPreview key={a.id} a={a} onRemove={readOnly ? undefined : () => setAttachments((p) => p.filter((x) => x.id !== a.id))} />
              ))}
            </ul>
            {status === "REVISION" && (
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                สถานะ "ให้แก้" — อย่าลืมระบุสิ่งที่ต้องแก้ในคอมเมนต์ (เฟส 2)
              </p>
            )}
          </div>
        </fieldset>

        <footer className="flex items-center justify-between border-t px-5 py-3">
          {task && !readOnly ? (
            <button type="button" onClick={() => remove.mutate()} className="flex items-center gap-1 text-sm text-rose-600 hover:underline">
              <Trash2 size={15} /> ลบ
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {save.isError && <span className="text-sm text-rose-600">บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง</span>}
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">{readOnly ? "ปิด" : "ยกเลิก"}</button>
            {!readOnly && (
            <button type="submit" disabled={save.isPending} className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {save.isPending && <Loader2 size={14} className="animate-spin" />} บันทึก
            </button>
            )}
          </div>
        </footer>
      </form>

      {/* class .input ใส่ใน globals.css:  @apply w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 */}
    </dialog>
  );
}

/* ------------------------------ small pieces ------------------------------ */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function CharCount({ control }: { control: any }) {
  return (
    <Controller
      control={control}
      name="caption"
      render={({ field }) => <span className="block text-right text-xs text-slate-400">{field.value?.length ?? 0} ตัวอักษร</span>}
    />
  );
}

/* ------------------------------ upload (presigned URL) ------------------------------ */
function FileUploader({ brandId, taskId, onUploaded }: { brandId: string; taskId?: string; onUploaded: (a: Attachment) => void }) {
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`${file.name} ใหญ่เกิน ${MAX_FILE_MB} MB`);
      return;
    }
    setBusy((b) => [...b, file.name]);
    try {
      // 1) ขอ presigned URL จาก server
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size, purpose: "REFERENCE", taskId, brandId }),
      });
      if (!sign.ok) {
        const e = await sign.json().catch(() => ({}));
        throw new Error(e.reason ?? "sign failed");
      }
      const { uploadUrl, publicUrl, key } = await sign.json();

      // 2) อัปโหลดตรงไป storage (ไม่ผ่านเซิร์ฟเวอร์เรา)
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("upload failed");

      onUploaded({
        id: crypto.randomUUID(),
        purpose: "REFERENCE",
        kind: kindOf(file.type),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        key,
        url: publicUrl,
      });
    } catch (e) {
      setError(`อัปโหลด ${file.name} ไม่สำเร็จ${e instanceof Error && e.message !== "sign failed" && e.message !== "upload failed" ? ` (${e.message})` : ""}`);
    } finally {
      setBusy((b) => b.filter((n) => n !== file.name));
    }
  }

  const handleFiles = (files: FileList | null) => {
    setError(null);
    Array.from(files ?? []).forEach(upload);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center text-sm text-slate-500 hover:bg-slate-50"
      >
        <UploadCloud />
        <span>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
        <span className="text-xs">รูป, วิดีโอ, PDF/Doc — สูงสุด {MAX_FILE_MB} MB/ไฟล์</span>
        <input ref={inputRef} type="file" multiple hidden accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx" onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {busy.map((n) => (
        <p key={n} className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> กำลังอัปโหลด {n}</p>
      ))}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function AttachmentPreview({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  return (
    <li className="group relative overflow-hidden rounded-lg border bg-slate-50">
      {a.kind === "IMAGE" && (
        <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.fileName} className="h-32 w-full object-cover" /></a>
      )}
      {a.kind === "VIDEO" && <video src={a.url} controls preload="metadata" className="h-32 w-full bg-black object-contain" />}
      {a.kind === "LINK" && (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex h-32 flex-col items-center justify-center gap-1 text-slate-600 hover:bg-slate-100">
          <FileText size={28} /> <span className="text-xs">เปิดลิงก์</span>
        </a>
      )}
      {a.kind === "DOCUMENT" && (
        <a href={a.url} target="_blank" rel="noreferrer" className="flex h-32 flex-col items-center justify-center gap-1 text-slate-600 hover:bg-slate-100">
          <FileText size={28} /> <span className="text-xs">เปิดไฟล์</span>
        </a>
      )}
      <p className="truncate px-2 py-1 text-xs text-slate-600">{a.fileName}</p>
      {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-600 opacity-0 shadow hover:text-rose-600 group-hover:opacity-100"
        aria-label="ลบไฟล์"
      >
        <X size={14} />
      </button>
      )}
    </li>
  );
}
