"use client";

// ============================================================
// components/AchievementsRoom.tsx — 成就收藏室（观察.txt #3）
// 陈列全部成就（已解锁高亮 / 未解锁灰锁），复用 lib/streak 的
// ACHIEVEMENTS 定义 + getUnlockedSet + 当前 ctx 即时判定。
// 由 page.tsx 在 <Portal> 内渲染。
// ============================================================

import React, { useMemo } from "react";
import { X, Trophy, Lock } from "lucide-react";
import { ACHIEVEMENTS, getUnlockedSet, type AchievementCtx } from "@/lib/streak";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  ctx: AchievementCtx;
}

export default function AchievementsRoom({ open, onClose, ctx }: Props) {
  const { t } = useT();
  // 已解锁 = 持久化记录里有 OR 当前条件已满足（双保险，避免漏弹的成就显示为锁定）
  const unlockedSet = useMemo(() => (open ? getUnlockedSet() : new Set<string>()), [open]);
  const rows = useMemo(
    () =>
      ACHIEVEMENTS.map((a) => ({
        ...a,
        unlocked: unlockedSet.has(a.id) || a.check(ctx),
      })),
    [unlockedSet, ctx],
  );
  const unlockedCount = rows.filter((r) => r.unlocked).length;

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 88,
          animation: "fade-in 0.18s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={t("achv.title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520,
          maxWidth: "94vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
          zIndex: 89,
          animation: "ach-pop 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
          color: "var(--color-text)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 18px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "var(--color-primary-soft)", color: "var(--color-primary)",
            }}
          >
            <Trophy size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              {t("achv.title")}
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
              {t("achv.unlocked", { n: unlockedCount, total: rows.length })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={15} />
          </button>
        </header>

        {/* 成就网格 */}
        <div
          style={{
            padding: 18,
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {rows.map((a) => (
            <div
              key={a.id}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 6,
                padding: "16px 12px",
                borderRadius: "var(--radius-card)",
                border: `1px solid ${a.unlocked ? "color-mix(in srgb, var(--color-primary) 45%, transparent)" : "var(--color-border)"}`,
                background: a.unlocked ? "var(--color-primary-soft)" : "var(--color-bg)",
                opacity: a.unlocked ? 1 : 0.7,
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1, filter: a.unlocked ? "none" : "grayscale(1)" }}>
                {a.emoji}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: a.unlocked ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                {a.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                {a.desc}
              </span>
              {!a.unlocked && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute", top: 8, right: 8,
                    color: "var(--color-text-faint)",
                    display: "inline-flex",
                  }}
                >
                  <Lock size={12} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ach-pop {
          from { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
