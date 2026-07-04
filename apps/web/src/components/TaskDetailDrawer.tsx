"use client";

// ============================================================
// components/TaskDetailDrawer.tsx — 任务详情抽屉（C.2-c）
// 替代 TaskEditModal：右侧 380px 滑入，create / edit 双模式
// 新增字段：status / tags / priority
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import {
  X, Trash2, Users, Link2, FolderOpen, Upload,
  FileText, Image as ImageIcon, File as FileIcon, BookOpen, Unlink,
} from "lucide-react";
import type { DdlItem, DdlAttachment, TaskStatus, TaskPriority, Note } from "@/lib/types";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT, type TFunc } from "@/lib/i18n";

export type EditingTarget =
  | { mode: "create"; presetDate?: string; presetTime?: string; presetTags?: string[] }
  | { mode: "edit"; item: DdlItem };

export interface FormPayload {
  taskName: string;
  dueDate: string;
  dueTime: string;
  weight: number | null;
  description: string;
  isGroupWork: boolean;
  notes: string;
  attachments: DdlAttachment[];
  status: TaskStatus;
  tags: string[];
  priority?: TaskPriority;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props {
  target: EditingTarget;
  onCancel: () => void;
  onSubmit: (data: FormPayload) => void;
  onDelete?: (id: string) => void;
  // B1 跨面板联动
  /** 当前任务关联的 Note（已 lookup 好）；只在 edit 模式 + DdlItem.noteId 有值时传 */
  linkedNote?: Note | null;
  /** 创建空笔记并立即关联到当前 task,然后跳 Notes Tab */
  onCreateLinkedNote?: (taskId: string) => void;
  /** 跳到 Notes Tab 并打开指定 note */
  onJumpToNote?: (noteId: string) => void;
  /** 解除关联（DdlItem.noteId 置空） */
  onUnlinkNote?: (taskId: string) => void;
}

const STATUS_OPTIONS: { v: TaskStatus; labelKey: string; color: string }[] = [
  { v: "todo", labelKey: "td.status.todo", color: "var(--color-text-muted)" },
  { v: "in_progress", labelKey: "td.status.inProgress", color: "var(--color-warning)" },
  { v: "done", labelKey: "td.status.done", color: "var(--color-success)" },
];

const PRIORITY_OPTIONS: { v: TaskPriority; labelKey: string; color: string }[] = [
  { v: "low", labelKey: "tasks.priority.low", color: "var(--color-info)" },
  { v: "med", labelKey: "tasks.priority.med", color: "var(--color-warning)" },
  { v: "high", labelKey: "tasks.priority.high", color: "var(--color-danger)" },
];

// Epic 5.3 任务快捷模板:常用学生场景一键预填（description 走 i18n descKey）
interface TaskTemplate {
  id: string;
  label: string;
  emoji: string;
  descKey: string;
  patch: () => Partial<FormPayload>;
}
const TASK_TEMPLATES: TaskTemplate[] = [
  { id: "quiz", label: "Quiz", emoji: "📝", descKey: "td.tpl.quiz.desc", patch: () => ({ weight: 10, priority: "med", tags: ["quiz"] }) },
  { id: "paper", label: "Paper", emoji: "📄", descKey: "td.tpl.paper.desc", patch: () => ({ weight: 30, priority: "high", tags: ["paper"] }) },
  { id: "project", label: "Project", emoji: "🚀", descKey: "td.tpl.project.desc", patch: () => ({ weight: 25, priority: "high", tags: ["project"], isGroupWork: true }) },
  { id: "reading", label: "Reading", emoji: "📖", descKey: "td.tpl.reading.desc", patch: () => ({ weight: null, priority: "low", tags: ["reading"] }) },
];

export default function TaskDetailDrawer({
  target, onCancel, onSubmit, onDelete,
  linkedNote, onCreateLinkedNote, onJumpToNote, onUnlinkNote,
}: Props) {
  const isEdit = target.mode === "edit";
  const init = isEdit ? target.item : null;
  const initialDate = isEdit ? target.item.dueDate : (target.presetDate ?? todayIso());
  const initialTime = isEdit
    ? target.item.dueTime
    : (target.mode === "create" && target.presetTime) || "23:59";

  const isMobile = useIsMobile();
  const { t } = useT();
  const [taskName, setTaskName] = useState(init?.taskName ?? "");
  const [dueDate, setDueDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState(initialTime);
  const [weight, setWeight] = useState<string>(init?.weight != null ? String(init.weight) : "");
  const [description, setDescription] = useState(init?.description ?? "");
  const [isGroupWork, setIsGroupWork] = useState<boolean>(init?.isGroupWork ?? false);
  const [notes, setNotes] = useState(init?.notes ?? "");
  const [attachments, setAttachments] = useState<DdlAttachment[]>(init?.attachments ?? []);
  // 新字段
  const [status, setStatus] = useState<TaskStatus>(
    init?.status ?? (init?.completed ? "done" : "todo"),
  );
  const initialTags = isEdit ? (init?.tags ?? []) : (target.presetTags ?? []);
  const [tagsInput, setTagsInput] = useState(initialTags.join(", "));
  const [priority, setPriority] = useState<TaskPriority | "">(init?.priority ?? "");

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canSubmit = taskName.trim().length > 0 && (dueDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(dueDate));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const w = weight.trim() === "" ? null : Number(weight);
    const tags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onSubmit({
      taskName: taskName.trim(),
      dueDate,
      dueTime: dueTime || "23:59",
      weight: w !== null && Number.isFinite(w) ? Math.max(0, Math.min(100, w)) : null,
      description: description.trim(),
      isGroupWork,
      notes: notes.trim(),
      attachments,
      status,
      tags,
      priority: priority || undefined,
    });
  };

  return (
    <>
      {/* 半透明遮罩（点击关闭） */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 70,
          animation: "drawer-fade 0.18s ease-out",
        }}
      />
      {/* 居中圆角浮层（观察.txt #18：子面板放屏幕中间）*/}
      <aside
        style={{
          position: "fixed",
          ...(isMobile
            ? {
                // 手机：底部 sheet（贴底全宽，顶部圆角，上滑入场）
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "90vh",
                borderRadius: "20px 20px 0 0",
                animation: "sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : {
                // 桌面：居中圆角浮层
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 460,
                maxWidth: "94vw",
                maxHeight: "88vh",
                borderRadius: "var(--radius-modal)",
                animation: "modal-pop 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
              }),
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)",
          zIndex: 71,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* Header */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
              {isEdit ? t("td.title.edit") : t("td.title.create")}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t("td.close")}
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none",
                background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <X size={16} />
            </button>
          </header>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Epic 5.3 任务快捷模板(仅新建模式) */}
            {!isEdit && (
              <div>
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
                    letterSpacing: 0.4, display: "block", marginBottom: 6,
                  }}
                >
                  {t("td.tpl.label")}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TASK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        const p = tpl.patch();
                        if (p.weight !== undefined) setWeight(p.weight === null ? "" : String(p.weight));
                        if (p.priority !== undefined) setPriority((p.priority as TaskPriority) ?? "");
                        if (p.tags !== undefined) setTagsInput((p.tags ?? []).join(", "));
                        setDescription(t(tpl.descKey));
                        if (p.isGroupWork !== undefined) setIsGroupWork(!!p.isGroupWork);
                        if (!taskName) nameRef.current?.focus();
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-bg)",
                        color: "var(--color-text)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = "var(--color-primary)";
                        el.style.background = "var(--color-primary-soft)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = "var(--color-border)";
                        el.style.background = "var(--color-bg)";
                      }}
                    >
                      <span>{tpl.emoji}</span>
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label={t("td.field.name")}>
              <input
                ref={nameRef}
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder={t("td.ph.name")}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px", gap: 8 }}>
              <Field label={t("td.field.date")}>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
              </Field>
              <Field label={t("td.field.time")}>
                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={inputStyle} />
              </Field>
              <Field label={t("td.field.weight")}>
                <input
                  type="number" min={0} max={100} step={1}
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  placeholder="—"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* 状态 + 优先级（同一行 segmented） */}
            <Field label={t("td.field.status")}>
              <SegmentedRadio
                options={STATUS_OPTIONS.map((s) => ({ value: s.v, label: t(s.labelKey), color: s.color }))}
                value={status}
                onChange={(v) => setStatus(v as TaskStatus)}
              />
            </Field>

            <Field label={t("td.field.priority")}>
              <SegmentedRadio
                options={[
                  { value: "", label: t("td.priority.none"), color: "var(--color-text-faint)" },
                  ...PRIORITY_OPTIONS.map((p) => ({ value: p.v, label: t(p.labelKey), color: p.color })),
                ]}
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority | "")}
              />
            </Field>

            <Field label={t("td.field.tags")}>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder={t("td.ph.tags")}
                style={inputStyle}
              />
              {tagsInput.trim() && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {tagsInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "var(--color-text)", cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={isGroupWork}
                onChange={(e) => setIsGroupWork(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
              <Users size={14} color="var(--color-info)" />
              {t("td.groupwork")}
            </label>

            <Field label={t("td.field.desc")}>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t("td.ph.desc")}
                rows={2}
                style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
              />
            </Field>

            <Field label={t("td.field.notes")}>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t("td.ph.notes")}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              />
            </Field>

            <AttachmentsEditor attachments={attachments} setAttachments={setAttachments} />

            {/* B1 关联笔记（仅 edit 模式 + 父组件传入 callbacks 时显示） */}
            {isEdit && init && (onCreateLinkedNote || linkedNote) && (
              <Field label={t("td.field.linkedNote")}>
                {linkedNote ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--color-primary-soft)",
                      border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                    }}
                  >
                    <BookOpen size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: "var(--color-text)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {linkedNote.title || t("td.note.untitled")}
                    </span>
                    {onJumpToNote && (
                      <button
                        type="button"
                        onClick={() => onJumpToNote(linkedNote.id)}
                        title={t("td.note.openTitle")}
                        style={smallBtnStyle()}
                      >
                        {t("td.note.open")}
                      </button>
                    )}
                    {onUnlinkNote && (
                      <button
                        type="button"
                        onClick={() => onUnlinkNote(init.id)}
                        title={t("td.note.unlinkTitle")}
                        style={smallBtnStyle(true)}
                      >
                        <Unlink size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  onCreateLinkedNote && (
                    <button
                      type="button"
                      onClick={() => onCreateLinkedNote(init.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px dashed var(--color-border)",
                        background: "var(--color-surface)",
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        width: "100%",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = "var(--color-primary)";
                        el.style.color = "var(--color-primary)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = "var(--color-border)";
                        el.style.color = "var(--color-text-muted)";
                      }}
                    >
                      <BookOpen size={13} /> {t("td.note.create")}
                    </button>
                  )
                )}
              </Field>
            )}
          </div>

          {/* Footer */}
          <footer
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderTop: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              flexShrink: 0,
            }}
          >
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (init && confirm(t("tasks.deleteConfirm", { name: init.taskName }))) onDelete(init.id);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "6px 10px", borderRadius: 6,
                    border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
                    background: "transparent", color: "var(--color-danger)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <Trash2 size={12} /> {t("td.delete")}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: "7px 14px", borderRadius: 6,
                  border: "1px solid var(--color-border)", background: "var(--color-bg)",
                  fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: "7px 16px", borderRadius: 6, border: "none",
                  background: canSubmit ? "var(--color-primary)" : "var(--color-border)",
                  color: "white", fontSize: 13, fontWeight: 500,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {isEdit ? t("td.save") : t("td.create")}
              </button>
            </div>
          </footer>
        </form>
      </aside>

      <style>{`
        @keyframes drawer-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes sheet-up {
          from { transform: translateY(100%); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ============================================================
// Segmented Radio
// ============================================================
function SegmentedRadio<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; color: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 4,
              border: "none",
              background: isActive ? "var(--color-bg)" : "transparent",
              color: isActive ? o.color : "var(--color-text-muted)",
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.12s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 基础组件
// ============================================================
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--color-text)",
  outline: "none",
  fontFamily: "inherit",
  background: "var(--color-bg)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

// ============================================================
// AttachmentsEditor —— 附件列表 + 3 个添加入口（与 TaskEditModal 一致）
// ============================================================
function AttachmentsEditor({
  attachments, setAttachments,
}: {
  attachments: DdlAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<DdlAttachment[]>>;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState<null | "url" | "filepath">(null);
  const [input, setInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addUrlOrPath = () => {
    if (!input.trim() || !adding) return;
    let label = labelInput.trim();
    if (!label) {
      label = adding === "url"
        ? (() => { try { return new URL(input).hostname; } catch { return input.slice(0, 40); } })()
        : input.split(/[\\\/]/).pop() ?? input;
    }
    setAttachments((prev) => [
      ...prev,
      { id: uid(), kind: adding, label, ref: input.trim() },
    ]);
    setInput("");
    setLabelInput("");
    setAdding(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { saveBlob } = await import("@/lib/blobs");
      const newOnes: DdlAttachment[] = [];
      for (const f of Array.from(files)) {
        const rec = await saveBlob(f);
        newOnes.push({
          id: uid(), kind: "blob", label: rec.name,
          ref: rec.id, mime: rec.mime, size: rec.data.size,
        });
      }
      setAttachments((prev) => [...prev, ...newOnes]);
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  const remove = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <span
        style={{
          fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
          letterSpacing: 0.4, display: "block", marginBottom: 6,
        }}
      >
        {t("td.field.attachments")}
      </span>

      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {attachments.map((a) => <AttChip key={a.id} att={a} onRemove={() => remove(a.id)} />)}
        </div>
      )}

      {adding && (
        <div
          style={{
            display: "flex", gap: 6, marginBottom: 8, alignItems: "center",
            padding: 8, borderRadius: 6,
            background: "var(--color-primary-soft)",
            border: "1px solid var(--color-primary)",
          }}
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addUrlOrPath(); }
            }}
            placeholder={adding === "url" ? "https://..." : "C:\\Users\\..."}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={addUrlOrPath} style={smallBtn(true)}>+</button>
          <button type="button" onClick={() => { setAdding(null); setInput(""); setLabelInput(""); }} style={smallBtn(false)}>×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <AddBtn icon={<Link2 size={11} />} label={t("td.att.link")} onClick={() => setAdding("url")} />
        <AddBtn icon={<FolderOpen size={11} />} label={t("td.att.path")} onClick={() => setAdding("filepath")} />
        <AddBtn icon={<Upload size={11} />} label={uploading ? t("td.att.uploading") : t("td.att.upload")} onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={handleUpload} />
      </div>
    </div>
  );
}

function AttChip({ att, onRemove }: { att: DdlAttachment; onRemove: () => void }) {
  const { t } = useT();
  const Icon = att.kind === "url" ? Link2 : att.kind === "filepath" ? FolderOpen : pickBlobIcon(att);
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 4px 4px 8px", borderRadius: 6,
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        fontSize: 11, color: "var(--color-text)", maxWidth: 200,
      }}
    >
      <Icon size={12} color="var(--color-primary)" style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {att.label}
      </span>
      <button
        type="button" onClick={onRemove} aria-label={t("td.att.remove")}
        style={{
          width: 16, height: 16, borderRadius: 4, border: "none", padding: 0,
          background: "transparent", cursor: "pointer", color: "var(--color-text-faint)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function pickBlobIcon(a: DdlAttachment) {
  const m = a.mime || "";
  if (m.startsWith("image/")) return ImageIcon;
  if (m === "application/pdf" || a.label.toLowerCase().endsWith(".pdf")) return FileText;
  return FileIcon;
}

function AddBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "5px 10px", borderRadius: 6,
        border: "1px dashed var(--color-primary)",
        background: h ? "var(--color-primary-soft)" : "transparent",
        color: "var(--color-primary)", fontSize: 11, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {icon} + {label}
    </button>
  );
}

function smallBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "5px 10px", borderRadius: 4, border: "none",
    background: primary ? "var(--color-primary)" : "var(--color-surface)",
    color: primary ? "white" : "var(--color-text-muted)",
    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
    flexShrink: 0,
  };
}

// B1 关联笔记内联小按钮
function smallBtnStyle(danger?: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 5,
    border: `1px solid ${danger ? "var(--color-danger)" : "var(--color-primary)"}`,
    background: "var(--color-bg)",
    color: danger ? "var(--color-danger)" : "var(--color-primary)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
  };
}
