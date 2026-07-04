"use client";

// ============================================================
// components/NotesPreview.tsx — 任务备注 Markdown 预览 modal
// 点 Task 行的「📝 备注」chip → 弹此组件
// ============================================================

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import ObsidianMarkdown from "@/components/ObsidianMarkdown";

interface Props {
  title: string;          // 任务名
  notes: string;          // markdown 内容
  onClose: () => void;
}

export default function NotesPreview({ title, notes, onClose }: Props) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15, 23, 42, 0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "preview-fade 0.15s ease-out",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 600, maxHeight: "80vh",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)",
              letterSpacing: 0.5, textTransform: "uppercase", margin: 0,
            }}>
              {t("notes.notesLabel")}
            </p>
            <h2 style={{
              fontSize: 14, fontWeight: 600, color: "var(--color-text)",
              margin: "2px 0 0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose} aria-label={t("common.close")}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            flex: 1, overflowY: "auto",
            padding: "16px 20px",
            fontSize: 14, lineHeight: 1.7, color: "var(--color-text)",
          }}
        >
          <ObsidianMarkdown content={notes} emptyText={t("notes.notesEmpty")} />
        </div>
      </div>

      <style>{`
        @keyframes preview-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
