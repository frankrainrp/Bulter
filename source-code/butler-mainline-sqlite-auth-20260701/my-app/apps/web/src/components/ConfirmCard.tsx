"use client";

// ============================================================
// components/ConfirmCard.tsx — AI 写操作的"核实卡"
// 一键全收 + 逐条 ✕ 删除；拒绝整批
// ============================================================

import React from "react";
import { Plus, Pencil, Trash2, X, Check, BookOpen, LayoutGrid } from "lucide-react";
import type { PendingBatch, PendingChange } from "@/lib/pending";
import { useT, type TFunc } from "@/lib/i18n";

interface ConfirmCardProps {
  batch: PendingBatch;
  onAccept: (batchId: string) => void;
  onReject: (batchId: string) => void;
  /** 单独移除某条 change（保留其他） */
  onDropChange: (batchId: string, changeId: string) => void;
}

export default function ConfirmCard({ batch, onAccept, onReject, onDropChange }: ConfirmCardProps) {
  const { t } = useT();
  const isPending = batch.status === "pending";
  const isAccepted = batch.status === "accepted";
  const isRejected = batch.status === "rejected";
  const remaining = batch.changes.length;

  const borderColor = isPending ? "var(--color-primary)" : "var(--color-border)";
  return (
    // 漫画对话气泡：去掉残留 AI 头像，做成「管家发起的任务创建询问」（观察.txt #4）
    <div style={{ width: "100%", maxWidth: 460, minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "relative",
            background: "var(--color-surface)",
            border: `1.5px solid ${borderColor}`,
            borderRadius: "var(--radius-card)",
            padding: 14,
            boxShadow: isPending ? "var(--shadow-card-hover)" : "var(--shadow-card)",
            opacity: isRejected ? 0.55 : 1,
          }}
        >
          {/* 顶部：intro + 状态徽章 */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
            <p
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--color-text)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {batch.intro}
            </p>
            {isAccepted && <StatusBadge label={t("cc.accepted")} color="var(--color-success)" />}
            {isRejected && <StatusBadge label={t("cc.cancelled")} color="var(--color-text-faint)" />}
            {isPending && <StatusBadge label={t("cc.pending", { n: remaining })} color="var(--color-primary)" />}
          </div>

          {/* changes 列表 */}
          {remaining > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                borderTop: "1px solid var(--color-border-soft)",
                paddingTop: 12,
              }}
            >
              {batch.changes.map((ch) => (
                <ChangeRow
                  key={ch.id}
                  change={ch}
                  canDrop={isPending}
                  onDrop={() => onDropChange(batch.id, ch.id)}
                />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: 0 }}>
              {t("cc.allRemoved")}
            </p>
          )}

          {/* 操作区 */}
          {isPending && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid var(--color-border-soft)",
              }}
            >
              <button
                onClick={() => onAccept(batch.id)}
                disabled={remaining === 0}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  background: remaining === 0 ? "var(--color-border)" : "var(--color-primary)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: remaining === 0 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Check size={14} />
                {t("cc.accept")} {remaining > 0 && `(${remaining})`}
              </button>
              <button
                onClick={() => onReject(batch.id)}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg)",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {t("cc.rejectAll")}
              </button>
            </div>
          )}
        </div>
        {/* 向下尾巴：指向下方的管家，强调「管家在向你确认」 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: -9,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `9px solid ${borderColor}`,
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: -6,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "7px solid var(--color-surface)",
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 500,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        padding: "2px 8px",
        borderRadius: 12,
      }}
    >
      {label}
    </span>
  );
}

function ChangeRow({
  change,
  canDrop,
  onDrop,
}: {
  change: PendingChange;
  canDrop: boolean;
  onDrop: () => void;
}) {
  const { t } = useT();
  const meta = describeChange(change, t);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        borderRadius: 6,
        background: "var(--color-bg)",
        border: "1px solid var(--color-border-soft)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: meta.bg,
          color: meta.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {meta.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {change.summary}
        </p>
        {meta.subline && (
          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
            {meta.subline}
          </p>
        )}
      </div>
      {canDrop && (
        <button
          aria-label={t("cc.removeOne")}
          onClick={onDrop}
          style={{
            width: 22,
            height: 22,
            border: "none",
            borderRadius: 4,
            background: "transparent",
            cursor: "pointer",
            color: "var(--color-text-faint)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--color-danger-soft)";
            el.style.color = "var(--color-danger)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "transparent";
            el.style.color = "var(--color-text-faint)";
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function describeChange(ch: PendingChange, t: TFunc): {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  subline?: string;
} {
  if (ch.kind === "create") {
    const d = ch.draft;
    const date = d.dueDate || t("tasks.date.tbd");
    return {
      icon: <Plus size={13} />,
      bg: "rgba(45,122,77,0.12)",
      fg: "var(--color-success)",
      subline: `${date}${d.dueTime ? " " + d.dueTime : ""}${d.weight != null ? ` · ${d.weight}%` : ""}`,
    };
  }
  if (ch.kind === "update") {
    const patched = Object.keys(ch.patch).filter((k) => k !== "id");
    return {
      icon: <Pencil size={13} />,
      bg: "rgba(59,130,246,0.12)",
      fg: "var(--color-info)",
      subline: patched.length > 0 ? t("cc.update", { fields: patched.join(" · ") }) : undefined,
    };
  }
  if (ch.kind === "create-note") {
    const n = ch.noteDraft;
    const preview = n.content.replace(/\s+/g, " ").slice(0, 60);
    return {
      icon: <BookOpen size={13} />,
      bg: "rgba(168,85,247,0.12)", // 紫色区别于 task（绿）
      fg: "#9333ea",
      subline: `${t("cc.note")} · ${t("cc.charsN", { n: n.content.length })}${n.tags?.length ? ` · #${n.tags.join(" #")}` : ""}${preview ? ` · ${preview}…` : ""}`,
    };
  }
  if (ch.kind === "create-custom-panel") {
    const p = ch.panelDraft;
    const isIframe = p.kind === "iframe";
    return {
      icon: <LayoutGrid size={13} />,
      bg: "rgba(245,158,11,0.14)", // 琥珀黄区别于 task/note
      fg: "#B45309",
      subline: `${isIframe ? t("cc.embed") : t("cc.panel")} · ${p.emoji} ${p.label}${isIframe ? ` · ${p.url}` : p.content ? ` · ${t("cc.charsN", { n: p.content.length })}` : ""}`,
    };
  }
  return {
    icon: <Trash2 size={13} />,
    bg: "rgba(220,38,38,0.1)",
    fg: "var(--color-danger)",
    subline: `${ch.before.dueDate || t("tasks.date.tbd")}`,
  };
}
