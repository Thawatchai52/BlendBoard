"use client";
// components/dashboard/WorkflowPanel.tsx — ส่วน "ส่งงาน & ตรวจงาน" ในหน้าต่างงาน
// Viewer: แนบไฟล์/ลิงก์ส่งงาน (Draft/ให้แก้) → ส่งตรวจ / ถอนกลับ
// Admin: อนุมัติ / ตีกลับ (ต้องมีคอมเมนต์) / Posted / ย้อนสถานะ
// ทุกปุ่มเรียก API ที่ตรวจสิทธิ์ซ้ำที่เซิร์ฟเวอร์ — ซ่อนปุ่มตามสิทธิ์เป็นแค่ความสะดวก
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, Loader2, UploadCloud, X } from "lucide-react";
import { usePermissions } from "@/components/role-store";
import { Attachment, ContentTask, STATUS_META, Status } from "@/lib/types";

const MAX_FILE_MB = 200;
const kindOf = (m: string) => (m.startsWith("image/") ? "IMAGE" : m.startsWith("video/") ? "VIDEO" : "DOCUMENT");

async function call(url: string, method: string, body?: unknown): Promise<ContentTask> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason ?? data.message ?? "ทำรายการไม่สำเร็จ");
  return data;
}

export function WorkflowPanel({ task, onChanged }: { task: ContentTask; onChanged?: (t: ContentTask) => void }) {
  const qc = useQueryClient();
  const { role, canTransition } = usePermissions();
  const [cur, setCur] = useState(task);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCur(task), [task]);

  const isAdmin = role === "ADMIN";
  const deliverables = cur.attachments.filter((a) => a.purpose === "DELIVERABLE");
  const canEditFiles = isAdmin || (role === "VIEWER" && (cur.status === "DRAFT" || cur.status === "REVISION"));

  const apply = (t: ContentTask) => {
    setCur(t);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onChanged?.(t);
  };
  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  const addLink = () =>
    run("link", async () => {
      let u: URL;
      try {
        u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(link.trim()) ? link.trim() : `https://${link.trim()}`);
      } catch {
        throw new Error("รูปแบบลิงก์ไม่ถูกต้อง");
      }
      if (u.protocol !== "https:") throw new Error("รองรับเฉพาะลิงก์ https");
      const isTT = /(^|\.)tiktok\.com$/i.test(u.hostname);
      apply(await call(`/api/tasks/${cur.id}/attachments`, "POST", {
        attachments: [{ kind: "LINK", purpose: "DELIVERABLE", fileName: isTT ? "คลิปบน TikTok" : "ลิงก์งานส่ง", mimeType: "text/uri-list", size: 0, url: u.href }],
      }));
      setLink("");
    });

  const uploadFile = (file: File) =>
    run("file", async () => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} ใหญ่เกิน ${MAX_FILE_MB} MB`);
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, purpose: "DELIVERABLE", taskId: cur.id, brandId: cur.brandId }),
      });
      if (!sign.ok) {
        const e = await sign.json().catch(() => ({}));
        throw new Error(sign.status === 501 ? "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ (ส่งเป็นลิงก์แทนได้)" : (e.reason ?? "ขอสิทธิ์อัปโหลดไม่สำเร็จ"));
      }
      const { uploadUrl, key } = await sign.json();
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error("อัปโหลดไม่สำเร็จ");
      apply(await call(`/api/tasks/${cur.id}/attachments`, "POST", {
        attachments: [{ kind: kindOf(file.type), purpose: "DELIVERABLE", fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, key }],
      }));
    });

  const removeAtt = (a: Attachment) => run("rm" + a.id, async () => apply(await call(`/api/tasks/${cur.id}/attachments?id=${a.id}`, "DELETE")));

  const move = (to: Status, c?: string) =>
    run("to" + to, async () => {
      apply(await call(`/api/tasks/${cur.id}/transition`, "POST", { to, comment: c?.trim() || undefined }));
      setRejecting(false);
      setComment("");
    });

  const btn = "rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50";

  return (
    <section className="space-y-3 border-t bg-slate-50 px-5 py-4" aria-label="ส่งงานและตรวจงาน">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">ส่งงาน & ตรวจงาน</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[cur.status].badge}`}>{STATUS_META[cur.status].label}</span>
        {!!cur.revisionRound && <span className="text-xs text-slate-500">ตีกลับมาแล้ว {cur.revisionRound} รอบ</span>}
      </div>

      {cur.status === "REVISION" && cur.revisionNote && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><b>สิ่งที่ต้องแก้:</b> {cur.revisionNote}</p>
      )}

      <ul className="space-y-1">
        {deliverables.length === 0 && <li className="text-sm text-slate-500">ยังไม่มีไฟล์/ลิงก์ส่งงาน</li>}
        {deliverables.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded border bg-white px-2 py-1 text-sm">
            {a.kind === "LINK" ? <Link2 size={14} /> : <UploadCloud size={14} />}
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">{a.fileName}</a>
            <ExternalLink size={12} className="text-slate-400" />
            {canEditFiles && (
              <button type="button" onClick={() => removeAtt(a)} disabled={!!busy} aria-label={`ลบ ${a.fileName}`} className="text-slate-500 hover:text-rose-600">
                {busy === "rm" + a.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEditFiles && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (link.trim()) addLink(); } }} placeholder="วางลิงก์ TikTok หรือลิงก์งาน (https://...)" className="input min-w-0 flex-1" />
          <button type="button" onClick={addLink} disabled={!link.trim() || !!busy} className={`${btn} border bg-white hover:bg-slate-100`}>
            {busy === "link" ? <Loader2 size={14} className="inline animate-spin" /> : "เพิ่มลิงก์"}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className={`${btn} border bg-white hover:bg-slate-100`}>
            {busy === "file" ? <Loader2 size={14} className="inline animate-spin" /> : "แนบไฟล์"}
          </button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadFile(f); }} />
        </div>
      )}
      {canEditFiles && <p className="text-xs text-slate-500">ลิงก์ TikTok ที่วางตรงนี้ ระบบหลังบ้านจะดึงยอดและคำนวณ ER ให้อัตโนมัติ</p>}

      <div className="flex flex-wrap items-center gap-2">
        {canTransition(cur.status, "IN_REVIEW") && cur.status !== "IN_REVIEW" && (
          <button type="button" onClick={() => move("IN_REVIEW")} disabled={!!busy} className={`${btn} bg-amber-500 text-white hover:bg-amber-600`}>ส่งตรวจ</button>
        )}
        {!isAdmin && cur.status === "IN_REVIEW" && canTransition("IN_REVIEW", "DRAFT") && (
          <button type="button" onClick={() => move("DRAFT")} disabled={!!busy} className={`${btn} border bg-white hover:bg-slate-100`}>ถอนกลับมาแก้</button>
        )}
        {isAdmin && cur.status === "IN_REVIEW" && (
          <>
            <button type="button" onClick={() => move("APPROVED")} disabled={!!busy} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>อนุมัติ</button>
            <button type="button" onClick={() => setRejecting((v) => !v)} disabled={!!busy} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>ตีกลับให้แก้</button>
          </>
        )}
        {isAdmin && cur.status === "APPROVED" && (
          <button type="button" onClick={() => move("POSTED")} disabled={!!busy} className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}>ทำเครื่องหมายว่าโพสต์แล้ว</button>
        )}
        {isAdmin && (cur.status === "APPROVED" || cur.status === "POSTED") && (
          <button type="button" onClick={() => move("IN_REVIEW")} disabled={!!busy} className={`${btn} border bg-white hover:bg-slate-100`}>ย้อนกลับไปรอตรวจ</button>
        )}
        {busy?.startsWith("to") && <Loader2 size={14} className="animate-spin" />}
      </div>

      {isAdmin && rejecting && cur.status === "IN_REVIEW" && (
        <div className="space-y-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="ระบุสิ่งที่ต้องแก้ (จำเป็น)" className="input resize-y" />
          <button type="button" onClick={() => move("REVISION", comment)} disabled={!comment.trim() || !!busy} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>ยืนยันตีกลับ</button>
        </div>
      )}

      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
    </section>
  );
}
