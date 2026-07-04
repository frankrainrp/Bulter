"use client";

// ============================================================
// components/layout/CalendarRail.tsx
// LeftRail @ Calendar Tab — 含可交互迷你月历（C1）
// ============================================================

import React, { useMemo, useState } from "react";
import { Plus, CalendarDays, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { RailPrimaryBtn, RailGroupTitle, RailItem } from "./LeftRail";
import { useT } from "@/lib/i18n";

interface CalendarRailProps {
  onCreateEvent: () => void;
  /** C1 迷你月历:有事件的日期数据源 */
  ddls?: DdlItem[];
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  /** 点击迷你月历某天 → page.tsx 切 Calendar 进入 Day View */
  onJumpToDay?: (iso: string) => void;
}

const WEEK_KEYS = ["cal.week.mon", "cal.week.tue", "cal.week.wed", "cal.week.thu", "cal.week.fri", "cal.week.sat", "cal.week.sun"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMiniMonth(cursor: Date): { cells: { iso: string; day: number; isCurMonth: boolean }[]; label: string } {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  // 周一为首列：weekday 0=日 → 6, 1=一 → 0...
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - offset);
  const cells: { iso: string; day: number; isCurMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ iso: isoDate(d), day: d.getDate(), isCurMonth: d.getMonth() === m });
  }
  return { cells, label: `${y} · ${String(m + 1).padStart(2, "0")}` };
}

export default function CalendarRail({ onCreateEvent, ddls = [], selectedTag = null, onSelectTag, onJumpToDay }: CalendarRailProps) {
  const { t } = useT();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const { cells, label } = useMemo(() => buildMiniMonth(cursor), [cursor]);
  const todayIso = isoDate(new Date());
  const totalDatedCount = useMemo(() => ddls.filter((d) => d.dueDate).length, [ddls]);
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of ddls) {
      if (!d.dueDate) continue;
      for (const rawTag of d.tags ?? []) {
        const tag = rawTag.trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [ddls]);
  const visibleDdls = useMemo(() => {
    if (!selectedTag) return ddls;
    return ddls.filter((d) => (d.tags ?? []).some((tag) => tag === selectedTag));
  }, [ddls, selectedTag]);
  const ddlDateSet = useMemo(() => new Set(visibleDdls.filter((d) => d.dueDate).map((d) => d.dueDate)), [visibleDdls]);

  const prev = () => { const n = new Date(cursor); n.setMonth(n.getMonth() - 1); setCursor(n); };
  const next = () => { const n = new Date(cursor); n.setMonth(n.getMonth() + 1); setCursor(n); };

  return (
    <>
      {/* C1 迷你月历 */}
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: 8,
          fontFamily: "inherit",
        }}
      >
        {/* 月份切换 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
            padding: "0 2px",
          }}
        >
          <button
            onClick={prev}
            aria-label={t("rail.cal.prevMonth")}
            style={miniNavBtn()}
          >
            <ChevronLeft size={11} />
          </button>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text)" }}>{label}</span>
          <button
            onClick={next}
            aria-label={t("rail.cal.nextMonth")}
            style={miniNavBtn()}
          >
            <ChevronRight size={11} />
          </button>
        </header>

        {/* 周标题 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 0,
            marginBottom: 2,
          }}
        >
          {WEEK_KEYS.map((w) => (
            <div
              key={w}
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--color-text-faint)",
                textAlign: "center",
                padding: "2px 0",
              }}
            >
              {t(w)}
            </div>
          ))}
        </div>

        {/* 日期格 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
          {cells.map((c) => {
            const isToday = c.iso === todayIso;
            const hasEvent = ddlDateSet.has(c.iso);
            return (
              <button
                key={c.iso}
                onClick={() => onJumpToDay?.(c.iso)}
                title={c.iso + (hasEvent ? t("rail.cal.hasEvent") : "")}
                style={{
                  position: "relative",
                  fontSize: 10,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday
                    ? "white"
                    : c.isCurMonth
                    ? "var(--color-text)"
                    : "var(--color-text-faint)",
                  background: isToday ? "var(--color-primary)" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 0",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  if (!isToday) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!isToday) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {c.day}
                {hasEvent && !isToday && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 2,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <RailPrimaryBtn icon={<Plus size={14} />} label="New Event" onClick={onCreateEvent} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <RailGroupTitle>Calendars</RailGroupTitle>
        <RailItem
          icon={<CalendarDays size={14} />}
          label="My Calendar"
          active={!selectedTag}
          badge={<CountBadge count={totalDatedCount} />}
          onClick={() => onSelectTag?.(null)}
        />
        {tagStats.length > 0 && <RailGroupTitle>Tags</RailGroupTitle>}
        {tagStats.map(({ tag, count }) => (
          <RailItem
            key={tag}
            icon={<Tag size={14} />}
            label={`#${tag}`}
            active={selectedTag === tag}
            badge={<CountBadge count={count} />}
            onClick={() => onSelectTag?.(tag)}
          />
        ))}
      </div>
    </>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 999,
        background: "var(--color-surface)",
        color: "var(--color-text-faint)",
        border: "1px solid var(--color-border-soft)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  );
}

function miniNavBtn(): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "var(--color-text-muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    fontFamily: "inherit",
  };
}
