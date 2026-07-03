"use client";

// ============================================================
// components/mini-apps/StatsApp.tsx — 学习统计 Mini App
//
// 显示:
//   - 本周完成 vs 待办 双数字
//   - 7 天完成趋势条形图（纯 SVG，零依赖）
//   - Top 3 标签 + 完成率
// 数据源:任务 state(通过 props 传入 by MiniAppsDrawer host)
// 设计:占满 320px 抽屉宽度,纵向滚动
// ============================================================

import React, { useMemo } from "react";
import { TrendingUp, CheckCircle2, Clock } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  ddls: DdlItem[];
}

function effStatus(d: DdlItem): "todo" | "in_progress" | "done" {
  return d.status ?? (d.completed ? "done" : "todo");
}

export default function StatsApp({ ddls }: Props) {
  const { t } = useT();
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6); // 含今天往前 7 天

    // 7 天每天的 done 数（基于 dueDate）
    const days: { label: string; iso: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = t(`dow.${d.getDay()}`);
      const count = ddls.filter((it) => effStatus(it) === "done" && it.dueDate === iso).length;
      days.push({ label, iso, count });
    }
    const max = Math.max(1, ...days.map((d) => d.count));

    const totalDone = ddls.filter((d) => effStatus(d) === "done").length;
    const totalTodo = ddls.filter((d) => effStatus(d) !== "done").length;

    // Top 3 tags
    const tagCounts: Record<string, { total: number; done: number }> = {};
    for (const d of ddls) {
      for (const t of d.tags ?? []) {
        if (!tagCounts[t]) tagCounts[t] = { total: 0, done: 0 };
        tagCounts[t].total++;
        if (effStatus(d) === "done") tagCounts[t].done++;
      }
    }
    const topTags = Object.entries(tagCounts)
      .map(([tag, s]) => ({ tag, ...s, ratio: s.total > 0 ? s.done / s.total : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return { days, max, totalDone, totalTodo, topTags };
  }, [ddls, t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 顶部:大数字双 chip */}
      <div style={{ display: "flex", gap: 10 }}>
        <BigChip icon={<CheckCircle2 size={14} />} label={t("stats.totalDone")} value={stats.totalDone} color="var(--color-success)" />
        <BigChip icon={<Clock size={14} />} label={t("stats.todo")} value={stats.totalTodo} color="var(--color-warning)" />
      </div>

      {/* 7 天趋势 */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          <TrendingUp size={11} /> {t("stats.trend7")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 4,
            height: 80,
            padding: "6px 4px",
            background: "var(--color-surface)",
            borderRadius: 8,
          }}
        >
          {stats.days.map((d) => {
            const h = (d.count / stats.max) * 60;
            return (
              <div key={d.iso} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: "var(--color-text-faint)" }}>
                  {d.count || ""}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 18,
                    height: Math.max(2, h),
                    borderRadius: 3,
                    background: d.count > 0 ? "var(--color-primary)" : "var(--color-border)",
                    transition: "height 0.3s",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 3 tag */}
      {stats.topTags.length > 0 ? (
        <div>
          <div
            style={{
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {t("stats.topTags")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.topTags.map((t) => (
              <div
                key={t.tag}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "var(--color-surface)",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                  #{t.tag}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--color-border)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 0, left: 0, height: "100%",
                      width: `${t.ratio * 100}%`,
                      background: t.ratio === 1 ? "var(--color-success)" : "var(--color-primary)",
                    }}
                  />
                </span>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {t.done}/{t.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 10,
            background: "var(--color-surface)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          {t("stats.noTags")}
        </div>
      )}
    </div>
  );
}

function BigChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, color, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>{label.toUpperCase()}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
