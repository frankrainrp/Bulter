"use client";

// ============================================================
// components/TodayHero.tsx — Chat 欢迎屏「今日聚焦」概览卡
//
// 100% 本地数据派生(零 token,零 API):
//   - 今日日期 + 星期 + 时段
//   - 3 个统计 chip:今日 / 本周 / 总完成
//   - 最近 deadline + 倒计时色彩(<24h 红 / <72h 橙 / <7d 黄 / else 绿)
//   - 本周完成率环形进度
// ============================================================

import React from "react";
import { CalendarDays, Clock, Flame } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { useT, type TFunc } from "@/lib/i18n";

interface Props {
  ddls: DdlItem[];
  /** 点击 deadline 卡跳转 */
  onJumpToTask?: (taskId: string) => void;
  /** G2.1 连续学习天数 */
  streakDays?: number;
  /** G5.2 最佳学习时段(本地分析) */
  bestHourLabel?: string | null;
}

function effStatus(d: DdlItem): "todo" | "in_progress" | "done" {
  return d.status ?? (d.completed ? "done" : "todo");
}

function urgencyMeta(daysLeft: number, t: TFunc): { color: string; label: string; bg: string } {
  if (daysLeft < 0) return { color: "var(--color-danger)", bg: "rgba(220,38,38,0.10)", label: t("th.overdue") };
  if (daysLeft < 1) return { color: "var(--color-danger)", bg: "rgba(220,38,38,0.10)", label: t("tasks.urgency.today") };
  if (daysLeft < 3) return { color: "#ea580c",            bg: "rgba(234,88,12,0.10)",  label: t("th.within", { n: Math.ceil(daysLeft) }) };
  if (daysLeft < 7) return { color: "var(--color-warning)", bg: "rgba(245,158,11,0.10)", label: t("th.within", { n: Math.ceil(daysLeft) }) };
  return { color: "var(--color-success)", bg: "rgba(45,122,77,0.10)", label: t("th.after", { n: Math.ceil(daysLeft) }) };
}

export default function TodayHero({ ddls, onJumpToTask, streakDays = 0, bestHourLabel }: Props) {
  const { t } = useT();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const weekday = t(`cal.dow.${now.getDay()}`);

  const todo = ddls.filter((d) => effStatus(d) !== "done");
  const done = ddls.filter((d) => effStatus(d) === "done");

  // 今日截止
  const todayCount = todo.filter((d) => d.dueDate === isoToday).length;
  // 本周（7 天内）
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekCount = todo.filter((d) => {
    if (!d.dueDate) return false;
    const due = new Date(d.dueDate);
    return due >= today && due < weekEnd;
  }).length;

  // 本周完成率（最近 7 天内 done 的 / (todo 本周 + done 本周)）
  const weekDoneCount = done.filter((d) => {
    if (!d.dueDate) return false;
    const due = new Date(d.dueDate);
    return due >= today && due < weekEnd;
  }).length;
  const weekTotal = weekCount + weekDoneCount;
  const weekRatio = weekTotal > 0 ? Math.round((weekDoneCount / weekTotal) * 100) : 0;

  // 最近 deadline
  const sortedTodo = todo
    .filter((d) => d.dueDate)
    .map((d) => ({ ...d, ts: new Date(d.dueDate).getTime() }))
    .sort((a, b) => a.ts - b.ts);
  const nextDeadline = sortedTodo.find((d) => d.ts >= today.getTime()) ?? sortedTodo[0];
  const daysLeft = nextDeadline
    ? (nextDeadline.ts - today.getTime()) / (24 * 3600 * 1000)
    : null;
  const urgent = daysLeft !== null ? urgencyMeta(daysLeft, t) : null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "var(--shadow-card-hover)",
      }}
    >
      {/* 顶部:日期 + 星期 + streak chip + 最佳时段 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <CalendarDays size={16} color="var(--color-primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
          {isoToday}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {weekday}
        </span>
        {streakDays > 0 && (
          <span
            title={t("db.streakTitle", { n: streakDays })}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(245,158,11,0.12)",
              color: "var(--color-warning)",
            }}
          >
            <Flame size={11} /> {t("th.streak", { n: streakDays })}
          </span>
        )}
        {bestHourLabel && (
          <span
            title={t("th.bestHourTitle")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              marginLeft: streakDays > 0 ? 0 : "auto",
            }}
          >
            {t("th.bestHour", { label: bestHourLabel })}
          </span>
        )}
      </div>

      {/* 中部:3 个统计 chip + 环形完成率 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <StatChip label={t("tasks.urgency.today")} value={todayCount} accent={todayCount > 0 ? "var(--color-danger)" : undefined} />
        <StatChip label={t("th.weekTodo")} value={weekCount} />
        <StatChip label={t("th.totalDone")} value={done.length} accent="var(--color-success)" />
        <div style={{ marginLeft: "auto" }}>
          <RingProgress ratio={weekRatio} />
        </div>
      </div>

      {/* 底部:最近 deadline */}
      {nextDeadline && urgent ? (
        <button
          onClick={() => onJumpToTask?.(nextDeadline.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: urgent.bg,
            border: `1px solid color-mix(in srgb, ${urgent.color} 30%, transparent)`,
            cursor: onJumpToTask ? "pointer" : "default",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <Clock size={14} color={urgent.color} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text)",
                fontWeight: 500,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nextDeadline.taskName}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
              {nextDeadline.dueDate}
              {nextDeadline.dueTime ? ` ${nextDeadline.dueTime}` : ""}
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 12,
              background: urgent.color,
              color: "white",
              flexShrink: 0,
            }}
          >
            {urgent.label}
          </span>
        </button>
      ) : (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: "var(--color-surface)",
            fontSize: 12,
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          {t("th.noDeadline")}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const color = accent ?? "var(--color-text)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>{label}</span>
    </div>
  );
}

function RingProgress({ ratio }: { ratio: number }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - ratio / 100);
  const color =
    ratio >= 80 ? "var(--color-success)" :
    ratio >= 50 ? "var(--color-warning)" :
    ratio > 0   ? "var(--color-primary)" : "var(--color-border)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border-soft)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {ratio}%
      </span>
    </div>
  );
}
