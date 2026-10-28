"use client";

// ============================================================
// components/layout/GlobalSearch.tsx — TopBar 全局搜索
//
// 搜：任务名/描述/备注/标签、笔记标题/内容、AI 历史对话内容
// 下拉浮层显示结果，点击跳转对应 Tab + 加 highlight（暂留高亮，仅切 tab）
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ListChecks, FileText, MessageSquare } from "lucide-react";
import type { DdlItem, Note, ChatMessage, NavId } from "@/lib/types";
import { EmptySearch } from "@/components/EmptyIllustrations";
import { useT } from "@/lib/i18n";

interface SearchResult {
  kind: "task" | "note" | "message";
  id: string;
  title: string;
  preview: string;
  navTarget: NavId;
  /** 用于跳转后定位（暂未实现高亮，留位） */
  refId?: string;
}

interface Props {
  ddls: DdlItem[];
  notes: Note[];
  messages: ChatMessage[];
  onJump: (target: NavId, refId?: string) => void;
  /** 手机：搜索框 flex 自适应缩窄（不固定 240）*/
  isMobile?: boolean;
}

const MAX_RESULTS = 24;

export default function GlobalSearch({ ddls, notes, messages, onJump, isMobile = false }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K 聚焦
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all: SearchResult[] = [];

    for (const d of ddls) {
      const hay = [d.taskName, d.description, d.notes ?? "", (d.tags ?? []).join(" ")].join(" ").toLowerCase();
      if (hay.includes(q)) {
        all.push({
          kind: "task",
          id: d.id,
          title: d.taskName,
          preview: `${d.dueDate || t("tasks.date.tbd")}${d.dueTime ? " " + d.dueTime : ""}${d.description ? " · " + d.description : ""}`.slice(0, 80),
          navTarget: "tasks",
          refId: d.id,
        });
      }
    }

    for (const n of notes) {
      const hay = `${n.title} ${n.content} ${(n.tags ?? []).join(" ")}`.toLowerCase();
      if (hay.includes(q)) {
        all.push({
          kind: "note",
          id: n.id,
          title: n.title || t("td.note.untitled"),
          preview: (n.content || "").replace(/[#*`>\-_\[\]()]/g, "").slice(0, 80),
          navTarget: "notes",
          refId: n.id,
        });
      }
    }

    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (!m.content) continue;
      if (m.content.toLowerCase().includes(q)) {
        all.push({
          kind: "message",
          id: m.id,
          title: m.role === "user" ? t("search.youSaid") : t("search.butlerSaid"),
          preview: m.content.slice(0, 80),
          navTarget: "chat",
          refId: m.sessionId,
        });
      }
    }

    return all.slice(0, MAX_RESULTS);
  }, [query, ddls, notes, messages, t]);

  const handleResultClick = (r: SearchResult) => {
    onJump(r.navTarget, r.refId);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div style={{ position: "relative", ...(isMobile ? { flex: 1, minWidth: 0 } : { width: 240 }) }}>
      <div
        style={{
          width: "100%", height: 32,
          background: "var(--color-surface)",
          border: `1px solid ${focused || open ? "var(--color-primary)" : "var(--color-border)"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center",
          padding: "0 10px", gap: 8,
          transition: "border-color 0.15s",
        }}
      >
        <Search size={14} color="var(--color-text-faint)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder="Search tasks / notes / chats..."
          style={{
            flex: 1, border: "none", background: "transparent",
            outline: "none", fontSize: 13, color: "var(--color-text)",
            width: 0, fontFamily: "inherit",
          }}
        />
        <span
          style={{
            fontSize: 10, fontWeight: 500,
            color: "var(--color-text-faint)",
            border: "1px solid var(--color-border)",
            borderRadius: 4, padding: "1px 5px",
            background: "var(--color-bg)",
          }}
        >
          ⌘K
        </span>
      </div>

      {open && query.trim() && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0, right: 0,
              maxHeight: 480,
              overflowY: "auto",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              zIndex: 50,
            }}
          >
            {results.length === 0 ? (
              <div style={{
                padding: "16px 14px 20px", textAlign: "center",
                color: "var(--color-text-faint)", fontSize: 12,
              }}>
                {/* [056] 插画 */}
                <div style={{ marginBottom: 6 }}><EmptySearch size={100} /></div>
                {t("search.noMatch")}
              </div>
            ) : (
              <>
                <ResultGroup
                  label={t("nav.tasks")}
                  icon={<ListChecks size={11} />}
                  items={results.filter((r) => r.kind === "task")}
                  onClick={handleResultClick}
                />
                <ResultGroup
                  label={t("nav.notes")}
                  icon={<FileText size={11} />}
                  items={results.filter((r) => r.kind === "note")}
                  onClick={handleResultClick}
                />
                <ResultGroup
                  label={t("nav.chat")}
                  icon={<MessageSquare size={11} />}
                  items={results.filter((r) => r.kind === "message")}
                  onClick={handleResultClick}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ResultGroup({
  label, icon, items, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  items: SearchResult[];
  onClick: (r: SearchResult) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div
        style={{
          padding: "8px 14px 4px",
          fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 5,
          borderTop: "1px solid var(--color-border-soft)",
        }}
      >
        {icon} {label} <span style={{ color: "var(--color-text-faint)" }}>· {items.length}</span>
      </div>
      {items.map((r) => (
        <ResultRow key={`${r.kind}-${r.id}`} result={r} onClick={() => onClick(r)} />
      ))}
    </div>
  );
}

function ResultRow({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "block", width: "100%",
        padding: "8px 14px",
        textAlign: "left", border: "none",
        background: hov ? "var(--color-surface)" : "transparent",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <p style={{
        fontSize: 13, fontWeight: 500, color: "var(--color-text)",
        margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {result.title}
      </p>
      <p style={{
        fontSize: 11, color: "var(--color-text-muted)",
        margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {result.preview}
      </p>
    </button>
  );
}
