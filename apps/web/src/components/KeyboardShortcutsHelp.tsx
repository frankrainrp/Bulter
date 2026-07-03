"use client";

// ============================================================
// components/KeyboardShortcutsHelp.tsx — 快捷键帮助 modal
//
// 按 ? 弹出（非输入框聚焦时）；Esc 关闭
// ============================================================

import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  groupKey: string;
  items: { keys: string[]; descKey: string }[];
}

const SHORTCUTS: ShortcutItem[] = [
  {
    groupKey: "kbd.group.global",
    items: [
      { keys: ["Ctrl", "K"], descKey: "kbd.d.search" },
      { keys: ["Ctrl", "N"], descKey: "kbd.d.new" },
      { keys: ["Esc"],      descKey: "kbd.d.esc" },
      { keys: ["?"],        descKey: "kbd.d.help" },
    ],
  },
  {
    groupKey: "kbd.group.tasks",
    items: [
      { keys: ["↑", "↓"],   descKey: "kbd.d.move" },
      { keys: ["Enter"],     descKey: "kbd.d.edit" },
      { keys: ["Space"],     descKey: "kbd.d.toggle" },
    ],
  },
  {
    groupKey: "kbd.group.chat",
    items: [
      { keys: ["Enter"],     descKey: "kbd.d.send" },
      { keys: ["Shift", "Enter"], descKey: "kbd.d.newline" },
      { keys: ["IME"],       descKey: "kbd.d.ime" },
    ],
  },
];

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 90,
          animation: "fade-in 0.18s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={t("kbd.title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          maxWidth: "92vw",
          maxHeight: "82vh",
          overflowY: "auto",
          background: "var(--color-bg)",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          border: "1px solid var(--color-border)",
          zIndex: 91,
          animation: "modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "16px 18px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Keyboard size={16} color="var(--color-primary)" />
          <h2 style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            {t("kbd.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", cursor: "pointer",
              color: "var(--color-text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          {SHORTCUTS.map((g) => (
            <section key={g.groupKey}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  margin: "0 0 8px",
                }}
              >
                {t(g.groupKey)}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {g.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "6px 0",
                    }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {it.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: "ui-monospace, monospace",
                            color: "var(--color-text)",
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 4,
                            minWidth: 22,
                            textAlign: "center",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                      {t(it.descKey)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            fontSize: 11,
            color: "var(--color-text-faint)",
            textAlign: "center",
          }}
        >
          {t("kbd.footer")}
        </footer>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
