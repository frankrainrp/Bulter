"use client";

// ============================================================
// components/NotesPreview.tsx — 任务备注 Markdown 预览 modal
// 点 Task 行的「📝 备注」chip → 弹此组件
// ============================================================

import React, { useEffect } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "@/lib/i18n";

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
          className="md-preview"
          style={{
            flex: 1, overflowY: "auto",
            padding: "16px 20px",
            fontSize: 14, lineHeight: 1.7, color: "var(--color-text)",
          }}
        >
          {notes.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
          ) : (
            <p style={{ color: "var(--color-text-faint)", margin: 0 }}>{t("notes.notesEmpty")}</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes preview-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .md-preview p { margin: 0 0 10px; }
        .md-preview p:last-child { margin-bottom: 0; }
        .md-preview ul, .md-preview ol { margin: 6px 0 10px; padding-left: 24px; }
        .md-preview li { margin: 3px 0; }
        .md-preview code {
          background: var(--color-primary-soft); padding: 1px 6px; border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 12.5px; color: var(--color-primary);
        }
        .md-preview pre {
          background: #1f2937; color: #f3f4f6; padding: 12px;
          border-radius: 8px; overflow-x: auto;
          font-size: 12.5px; line-height: 1.55; margin: 10px 0;
        }
        .md-preview pre code { background: transparent; color: inherit; padding: 0; }
        .md-preview a { color: var(--color-primary); text-decoration: underline; }
        .md-preview strong { font-weight: 600; }
        .md-preview h1, .md-preview h2, .md-preview h3 {
          font-weight: 700; margin: 14px 0 8px; line-height: 1.3;
        }
        .md-preview h1 { font-size: 18px; }
        .md-preview h2 { font-size: 16px; }
        .md-preview h3 { font-size: 14.5px; }
        .md-preview table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
        .md-preview th, .md-preview td {
          border: 1px solid var(--color-border); padding: 6px 10px; text-align: left;
        }
        .md-preview th { background: var(--color-surface); font-weight: 600; }
        .md-preview blockquote {
          border-left: 3px solid var(--color-primary);
          padding: 2px 12px; color: var(--color-text-muted);
          margin: 8px 0; background: var(--color-surface);
          border-radius: 0 6px 6px 0;
        }
      `}</style>
    </div>
  );
}
