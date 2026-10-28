"use client";

// ============================================================
// components/layout/ChatRail.tsx
// LeftRail @ Chat Tab：+ New Chat + Recent Chats（取代 SessionListPanel）
// ============================================================

import React, { useState } from "react";
import { Plus, MessageSquare } from "lucide-react";
import type { ChatSession } from "@/lib/types";
import { RailPrimaryBtn, RailGroupTitle, RailItem } from "./LeftRail";
import { EmptyButlerTray } from "@/components/EmptyIllustrations";
import { useT } from "@/lib/i18n";

const RECENT_LIMIT = 12;

interface ChatRailProps {
  sessions: ChatSession[]; // 已按 updatedAt desc 排序
  activeId: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function ChatRail({
  sessions,
  activeId,
  onCreate,
  onSelect,
  onRename,
  onDelete,
}: ChatRailProps) {
  const { t } = useT();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const recent = sessions.slice(0, RECENT_LIMIT);
  const hasMore = sessions.length > RECENT_LIMIT;

  const commitRename = () => {
    if (renamingId) {
      const v = renameVal.trim();
      if (v) onRename(renamingId, v);
      setRenamingId(null);
    }
  };

  return (
    <>
      <RailPrimaryBtn icon={<Plus size={14} />} label="New Chat" onClick={onCreate} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflow: "hidden" }}>
        <RailGroupTitle>Recent Chats</RailGroupTitle>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.length === 0 && (
            <div style={{ padding: "20px 8px", textAlign: "center", color: "var(--color-text-faint)" }}>
              {/* [068] 管家化空态：白手套呈递空托盘 */}
              <EmptyButlerTray size={120} />
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>{t("rail.chat.empty1")}<br />{t("rail.chat.empty2")}</p>
            </div>
          )}

          {recent.map((s) => {
            const isActive = s.id === activeId;
            const isRenaming = renamingId === s.id;

            if (isRenaming) {
              return (
                <div
                  key={s.id}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-primary)",
                  }}
                >
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      else if (e.key === "Escape") setRenamingId(null);
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              );
            }

            return (
              <div key={s.id} style={{ position: "relative" }}>
                <RailItem
                  icon={<MessageSquare size={14} />}
                  label={s.title || t("rail.chat.untitled")}
                  active={isActive}
                  onClick={() => onSelect(s.id)}
                  onMenuClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
                />
                {menuOpenId === s.id && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 40 }}
                      onClick={() => setMenuOpenId(null)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        zIndex: 50,
                        width: 140,
                        background: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <MiniMenuBtn
                        label={t("rail.chat.rename")}
                        onClick={() => {
                          setRenamingId(s.id);
                          setRenameVal(s.title);
                          setMenuOpenId(null);
                        }}
                      />
                      <MiniMenuBtn
                        label={t("rail.chat.delete")}
                        danger
                        onClick={() => {
                          if (confirm(t("rail.chat.deleteConfirm", { title: s.title }))) {
                            onDelete(s.id);
                          }
                          setMenuOpenId(null);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px 8px",
                textAlign: "left",
              }}
            >
              View all ({sessions.length})
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function MiniMenuBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 12px",
        fontSize: 13,
        background: hov ? "var(--color-surface)" : "transparent",
        color: danger ? "var(--color-danger)" : "var(--color-text)",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
