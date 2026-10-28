"use client";

// ============================================================
// components/CalendarPanel.tsx — 「日历」面板
// 双视图：
//   - month（默认）：月网格，点空白日期 → 进入 day；点事件 pill → 编辑 modal
//   - day（深度）：返回按钮 + 时间轴 + 右侧 widgets（Upcoming / Tasks / Focus）
// Stage D：墨绿设计 + 双视图
// ============================================================

import React, { useMemo, useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, ArrowLeft, Plus, Clock, ListChecks, LayoutGrid,
} from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT, type TFunc } from "@/lib/i18n";

interface Props {
  ddls: DdlItem[];
  onRequestCreate: (presetDate?: string, presetTime?: string) => void;
  onRequestEdit: (ddl: DdlItem) => void;
  /** C1 CalendarRail 迷你月历跳转:prop 变化时切到 day view */
  jumpToDay?: string | null;
  /** C4 拖动事件改时间 */
  onMoveEvent?: (id: string, newDate: string, newTime: string) => void;
}

const WEEK_KEYS = ["cal.week.mon", "cal.week.tue", "cal.week.wed", "cal.week.thu", "cal.week.fri", "cal.week.sat", "cal.week.sun"];

type ViewMode = "month" | "week" | "day";

export default function CalendarPanel({ ddls, onRequestCreate, onRequestEdit, jumpToDay, onMoveEvent }: Props) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<string>(isoDate(new Date()));

  // C1 外部跳转:jumpToDay 变化时切到 day
  useEffect(() => {
    if (jumpToDay) {
      setSelectedDate(jumpToDay);
      setView("day");
    }
  }, [jumpToDay]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const ddlMap = useMemo(() => {
    const m = new Map<string, DdlItem[]>();
    for (const d of ddls) {
      if (!d.dueDate) continue;
      const arr = m.get(d.dueDate) ?? [];
      arr.push(d);
      m.set(d.dueDate, arr);
    }
    return m;
  }, [ddls]);

  const enterDay = (iso: string) => {
    setSelectedDate(iso);
    setView("day");
  };

  if (view === "day") {
    return (
      <DayView
        date={selectedDate}
        allDdls={ddls}
        dayDdls={ddlMap.get(selectedDate) ?? []}
        onBack={() => setView("month")}
        onCreate={() => onRequestCreate(selectedDate)}
        onEdit={onRequestEdit}
        onCreateAt={(iso, hour) => onRequestCreate(iso, `${String(hour).padStart(2, "0")}:00`)}
        onMoveEvent={onMoveEvent}
      />
    );
  }

  if (view === "week") {
    return (
      <WeekView
        date={selectedDate}
        ddls={ddls}
        ddlMap={ddlMap}
        onBack={() => setView("month")}
        onEnterDay={enterDay}
        onCreate={() => onRequestCreate(selectedDate)}
        onCreateAt={(iso, hour) => onRequestCreate(iso, `${String(hour).padStart(2, "0")}:00`)}
        onEditEvent={onRequestEdit}
        onMoveEvent={onMoveEvent}
      />
    );
  }

  return (
    <MonthView
      ddls={ddls}
      ddlMap={ddlMap}
      cursor={cursor}
      onCursorChange={setCursor}
      onEnterDay={enterDay}
      onEnterWeek={(iso: string) => { setSelectedDate(iso); setView("week"); }}
      onCreate={() => onRequestCreate()}
      onEditEvent={onRequestEdit}
    />
  );
}

// ============================================================
// Month View
// ============================================================
function MonthView({
  ddls, ddlMap, cursor, onCursorChange, onEnterDay, onEnterWeek, onCreate, onEditEvent,
}: {
  ddls: DdlItem[];
  ddlMap: Map<string, DdlItem[]>;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  onEnterDay: (iso: string) => void;
  onEnterWeek?: (iso: string) => void;
  onCreate: () => void;
  onEditEvent: (d: DdlItem) => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const { cells, monthLabel } = useMemo(() => buildMonth(cursor), [cursor]);
  const todayIso = isoDate(new Date());

  const goPrev = () => {
    const n = new Date(cursor);
    n.setMonth(n.getMonth() - 1);
    onCursorChange(n);
  };
  const goNext = () => {
    const n = new Date(cursor);
    n.setMonth(n.getMonth() + 1);
    onCursorChange(n);
  };
  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    onCursorChange(d);
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: isMobile ? "16px 12px 24px" : "28px 32px 40px", background: "transparent" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--color-text)",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              {monthLabel}
            </h1>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              本月 {countMonthEvents(ddls, cursor)} 件待办 · 点空白日期查看时间轴
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* 上一月 / 今天 / 下一月 合成一组分段控件，"今天"不再是突兀的独立深色块 */}
            <NavCluster onPrev={goPrev} onToday={goToday} onNext={goNext} />
            {/* C2 Week View 入口 */}
            {onEnterWeek && (
              <button
                onClick={() => onEnterWeek(todayIso)}
                title={t("cal.toWeekView")}
                style={{
                  padding: "7px 12px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <LayoutGrid size={13} /> Week
              </button>
            )}
            <PrimaryBtn onClick={onCreate} icon={<Plus size={14} />} label="New Event" />
          </div>
        </header>

        {ddls.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {/* 周标题行 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              {WEEK_KEYS.map((w) => (
                <div
                  key={w}
                  style={{
                    padding: "10px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    letterSpacing: 0.5,
                  }}
                >
                  {t(w)}
                </div>
              ))}
            </div>
            {/* 网格 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gridAutoRows: "minmax(108px, auto)",
              }}
            >
              {cells.map((cell) => {
                const events = ddlMap.get(cell.iso) ?? [];
                const isToday = cell.iso === todayIso;
                const isHovered = hoverDay === cell.iso;
                return (
                  <div
                    key={cell.iso}
                    onMouseEnter={() => setHoverDay(cell.iso)}
                    onMouseLeave={() => setHoverDay(null)}
                    onClick={() => {
                      if (cell.inMonth) onEnterDay(cell.iso);
                    }}
                    title={cell.inMonth ? t("cal.cellTip") : ""}
                    style={{
                      borderRight: "1px solid var(--color-border-soft)",
                      borderBottom: "1px solid var(--color-border-soft)",
                      padding: 8,
                      background: !cell.inMonth
                        ? "var(--color-surface)"
                        : isHovered
                        ? "var(--color-primary-soft)"
                        : "transparent",
                      transition: "background 0.12s",
                      minHeight: 108,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      cursor: cell.inMonth ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isToday ? 700 : 500,
                          color: !cell.inMonth
                            ? "var(--color-text-faint)"
                            : isToday
                            ? "white"
                            : "var(--color-text)",
                          background: isToday ? "var(--color-primary)" : "transparent",
                          width: isToday ? 22 : "auto",
                          height: isToday ? 22 : "auto",
                          borderRadius: isToday ? "50%" : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {cell.day}
                      </span>
                      {events.length > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-faint)",
                            fontWeight: 600,
                          }}
                        >
                          {events.length}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
                      {events.slice(0, 3).map((ev) => (
                        <EventPill
                          key={ev.id}
                          event={ev}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(ev);
                          }}
                        />
                      ))}
                      {events.length > 3 && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--color-primary)",
                            fontWeight: 600,
                            padding: "1px 4px",
                          }}
                        >
                          +{events.length - 3} 更多
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Day View — 时间轴 + 右侧 widgets
// ============================================================
function DayView({
  date, allDdls, dayDdls, onBack, onCreate, onEdit, onCreateAt, onMoveEvent,
}: {
  date: string;
  allDdls: DdlItem[];
  dayDdls: DdlItem[];
  onBack: () => void;
  onCreate: () => void;
  onEdit: (d: DdlItem) => void;
  /** [054] D.1 点空白时间格创建（带 hour 预填） */
  onCreateAt?: (iso: string, hour: number) => void;
  /** [054] D.1 拖动事件改时间 */
  onMoveEvent?: (id: string, newDate: string, newTime: string) => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const dateObj = new Date(date);
  const isToday = date === isoDate(new Date());

  // 时间轴 6AM-11PM（18 行）
  const HOUR_START = 6;
  const HOUR_END = 23;
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START);

  // 按小时分桶
  const byHour = useMemo(() => {
    const m = new Map<number, DdlItem[]>();
    for (const d of dayDdls) {
      const h = parseInt(d.dueTime.split(":")[0] || "23", 10);
      const arr = m.get(h) ?? [];
      arr.push(d);
      m.set(h, arr);
    }
    return m;
  }, [dayDdls]);

  // 不在时间轴范围内的（早于 6 AM 或没时间）
  const outOfRange = dayDdls.filter((d) => {
    const h = parseInt(d.dueTime.split(":")[0] || "23", 10);
    return h < HOUR_START || h > HOUR_END;
  });

  // 右侧 widgets 数据
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allDdls
      .filter((d) => !d.completed && d.dueDate && new Date(d.dueDate) >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [allDdls]);

  const todos = useMemo(
    () => allDdls.filter((d) => !d.completed).slice(0, 5),
    [allDdls],
  );

  return (
    <div style={{ height: "100%", overflow: "auto", padding: isMobile ? "16px 12px 24px" : "28px 32px 40px", background: "transparent" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onBack}
              aria-label={t("cal.backToMonth")}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg)",
                cursor: "pointer",
                color: "var(--color-text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                  letterSpacing: "-0.3px",
                }}
              >
                {t("cal.dateYMD", { y: dateObj.getFullYear(), m: dateObj.getMonth() + 1, d: dateObj.getDate() })}
                {isToday && (
                  <span
                    style={{
                      fontSize: 12,
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "var(--color-primary)",
                      color: "white",
                      fontWeight: 500,
                      verticalAlign: "middle",
                    }}
                  >
                    {t("tasks.date.today")}
                  </span>
                )}
              </h1>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
                {t("cal.dowCount", { dow: t(`cal.dow.${dateObj.getDay()}`), n: dayDdls.length })}
              </p>
            </div>
          </div>
          <PrimaryBtn onClick={onCreate} icon={<Plus size={14} />} label="New Event" />
        </header>

        {/* 两栏：时间轴 + 右 widgets */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* 时间轴主区 */}
          <div
            style={{
              flex: 1,
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            {hours.map((h) => {
              const slotItems = byHour.get(h) ?? [];
              return (
                <div
                  key={h}
                  style={{
                    display: "flex",
                    minHeight: 44,
                    borderBottom: "1px solid var(--color-border-soft)",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      flexShrink: 0,
                      padding: "10px 12px",
                      fontSize: 11,
                      color: "var(--color-text-faint)",
                      fontWeight: 500,
                      borderRight: "1px solid var(--color-border-soft)",
                      textAlign: "right",
                    }}
                  >
                    {formatHour(h)}
                  </div>
                  <div
                    onClick={(ev) => {
                      // [054] D.1 点空白处（不是 pill）→ 用 hour 预填创建；否则保留旧的简单 onCreate
                      if ((ev.target as HTMLElement).tagName === "DIV" && onCreateAt) {
                        onCreateAt(date, h);
                      } else if ((ev.target as HTMLElement).tagName === "DIV") {
                        onCreate();
                      }
                    }}
                    onDragOver={(ev) => {
                      if (!onMoveEvent) return;
                      if (!ev.dataTransfer.types.includes("text/butler-calendar-event")) return;
                      ev.preventDefault();
                      (ev.currentTarget as HTMLDivElement).style.background = "var(--color-primary-soft)";
                    }}
                    onDragLeave={(ev) => {
                      (ev.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                    onDrop={(ev) => {
                      if (!onMoveEvent) return;
                      ev.preventDefault();
                      (ev.currentTarget as HTMLDivElement).style.background = "transparent";
                      const id = ev.dataTransfer.getData("text/butler-calendar-event");
                      if (id) onMoveEvent(id, date, `${String(h).padStart(2, "0")}:00`);
                    }}
                    style={{
                      flex: 1,
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      cursor: onCreateAt ? "cell" : "pointer",
                      minHeight: 44,
                      transition: "background 0.12s",
                    }}
                    title={onCreateAt ? t("cal.createAt", { time: `${String(h).padStart(2, "0")}:00` }) : t("cal.createEvent")}
                  >
                    {slotItems.map((it) => (
                      <TimelinePill
                        key={it.id}
                        event={it}
                        draggable={!!onMoveEvent}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(it);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {outOfRange.length > 0 && (
              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--color-surface)",
                  borderTop: "1px solid var(--color-border-soft)",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    fontWeight: 600,
                    margin: "0 0 6px",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {t("cal.otherTimes")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {outOfRange.map((it) => (
                    <TimelinePill key={it.id} event={it} onClick={() => onEdit(it)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧 widgets */}
          <aside
            style={{
              width: 280,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <WidgetCard title="Upcoming Events" icon={<Clock size={13} />}>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: 0 }}>{t("cal.noUpcoming")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {upcoming.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onEdit(d)}
                      style={{
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: "4px 0",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-text)", margin: 0 }}>
                        {d.taskName}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                        {d.dueDate} · {d.dueTime}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </WidgetCard>

            <WidgetCard title="Tasks" icon={<ListChecks size={13} />}>
              {todos.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: 0 }}>{t("cal.noTodo")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {todos.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          border: "1.5px solid var(--color-border)",
                          flexShrink: 0,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12.5,
                          color: "var(--color-text)",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.taskName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </WidgetCard>

          </aside>
        </div>
      </div>
    </div>
  );
}

function WidgetCard({
  title, icon, children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          color: "var(--color-text-muted)",
        }}
      >
        {icon}
        <h3
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            margin: 0,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// 时间轴里的事件 pill
function TimelinePill({ event, onClick, draggable }: { event: DdlItem; onClick: (e: React.MouseEvent) => void; draggable?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={(ev) => {
        if (!draggable) return;
        ev.dataTransfer.setData("text/butler-calendar-event", event.id);
        ev.dataTransfer.effectAllowed = "move";
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: hov ? "var(--color-primary-soft)" : "color-mix(in srgb, var(--color-primary-soft) 60%, transparent)",
        border: `1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)`,
        borderLeft: "3px solid var(--color-primary)",
        cursor: draggable ? "grab" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.12s",
        minWidth: 0,
      }}
      title={draggable ? `${event.taskName}（可拖到其他时段）` : event.taskName}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--color-primary)",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {event.dueTime}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--color-text)",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.taskName}
      </span>
      {event.weight != null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-primary)",
            background: "var(--color-bg)",
            padding: "1px 5px",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          {event.weight}%
        </span>
      )}
    </button>
  );
}

// ============================================================
// 月视图小组件
// ============================================================
function EventPill({ event, onClick }: { event: DdlItem; onClick: (e: React.MouseEvent) => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${event.taskName} · ${event.dueTime}${event.weight ? ` · ${event.weight}%` : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 4,
        background: hov ? "var(--color-primary-soft)" : "color-mix(in srgb, var(--color-primary-soft) 50%, transparent)",
        borderLeft: "2px solid var(--color-primary)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "background 0.12s",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text)",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {event.taskName}
      </span>
    </div>
  );
}

// 分段导航控件：‹ 今天 › 合为一体，共用边框 + 细分隔线，内段透明仅 hover 提亮
function NavCluster({
  onPrev, onToday, onNext,
}: {
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  const { t } = useT();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <SegBtn onClick={onPrev} aria={t("rail.cal.prevMonth")}><ChevronLeft size={16} /></SegBtn>
      <span style={{ width: 1, background: "var(--color-border)" }} aria-hidden />
      <SegBtn onClick={onToday} aria={t("cal.backToToday")} wide>{t("tasks.date.today")}</SegBtn>
      <span style={{ width: 1, background: "var(--color-border)" }} aria-hidden />
      <SegBtn onClick={onNext} aria={t("rail.cal.nextMonth")}><ChevronRight size={16} /></SegBtn>
    </div>
  );
}

function SegBtn({
  children, onClick, aria, wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  aria: string;
  wide?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 32,
        minWidth: 32,
        padding: wide ? "0 14px" : 0,
        border: "none",
        background: hov ? "var(--color-surface)" : "transparent",
        cursor: "pointer",
        color: hov ? "var(--color-text)" : "var(--color-text-muted)",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({
  icon, label, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 8,
        border: "none",
        background: h ? "var(--color-primary-hover)" : "var(--color-primary)",
        color: "white",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px dashed var(--color-border)",
        borderRadius: 12,
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "var(--color-primary-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <CalendarDays size={22} color="var(--color-primary)" />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", margin: "0 0 6px" }}>
        日历空空如也
      </p>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
        告诉 Butler 你的安排、上传课件，或点下方按钮手动创建
      </p>
      <PrimaryBtn onClick={onCreate} icon={<Plus size={14} />} label="New Event" />
    </div>
  );
}

// ============================================================
// 工具函数
// ============================================================
interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildMonth(cursor: Date): { cells: Cell[]; monthLabel: string } {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const totalDays = last.getDate();

  const cells: Cell[] = [];
  if (firstWeekday > 0) {
    const prevLast = new Date(year, month, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i);
      cells.push({ iso: isoDate(d), day: d.getDate(), inMonth: false });
    }
  }
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month, d);
    cells.push({ iso: isoDate(dt), day: d, inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    if (!last) break;
    const dt = new Date(last.iso);
    dt.setDate(dt.getDate() + 1);
    cells.push({ iso: isoDate(dt), day: dt.getDate(), inMonth: false });
  }

  const monthLabel = `${year} 年 ${month + 1} 月`;
  return { cells, monthLabel };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countMonthEvents(ddls: DdlItem[], cursor: Date): number {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  return ddls.filter((d) => {
    if (!d.dueDate) return false;
    const dt = new Date(d.dueDate);
    return dt.getFullYear() === y && dt.getMonth() === m;
  }).length;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ============================================================
// C2 Week View — 7 列 × 24h 时间轴
// ============================================================
function WeekView({
  date, ddls, ddlMap, onBack, onEnterDay, onCreate, onCreateAt, onEditEvent, onMoveEvent,
}: {
  date: string;
  ddls: DdlItem[];
  ddlMap: Map<string, DdlItem[]>;
  onBack: () => void;
  onEnterDay: (iso: string) => void;
  onCreate: () => void;
  /** C3 点空时段创建带 presetDate + presetTime */
  onCreateAt?: (iso: string, hour: number) => void;
  onEditEvent: (d: DdlItem) => void;
  /** C4 拖动事件改时间 */
  onMoveEvent?: (id: string, newDate: string, newTime: string) => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useT();
  // 计算所选日期所在周的 7 天（周一开始）
  const weekDays = useMemo(() => {
    const d = new Date(date);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const days: { iso: string; day: number; weekday: string; month: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      days.push({
        iso: isoDate(dt),
        day: dt.getDate(),
        weekday: t(WEEK_KEYS[i]),
        month: dt.getMonth() + 1,
      });
    }
    return days;
  }, [date, t]);

  const todayIso = isoDate(new Date());
  const HOUR_START = 6;
  const HOUR_END = 24; // 6 AM-11 PM,18 行
  const ROW_HEIGHT = 36;

  const weekLabel = `${weekDays[0].iso} → ${weekDays[6].iso}`;
  const eventsInWeek = weekDays.flatMap((d) => ddlMap.get(d.iso) ?? []);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: isMobile ? "14px 10px 24px" : "24px 24px 40px", background: "transparent" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onBack}
              style={{
                width: 32, height: 32, borderRadius: 6, border: "1px solid var(--color-border)",
                background: "var(--color-bg)", cursor: "pointer", color: "var(--color-text-muted)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label={t("cal.backToMonth")}
            >
              <ArrowLeft size={14} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                Week View
              </h1>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                {weekLabel} · 共 {eventsInWeek.length} 件事
              </p>
            </div>
          </div>
          <button
            onClick={onCreate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "var(--color-primary)", color: "white",
              fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus size={14} /> New Event
          </button>
        </header>

        {/* 7 列 × 时间轴网格 */}
        <div
          style={{
            display: "grid",
            // 手机：列加最小宽 + 网格整体 minWidth → 父容器横滚（7 天可左右滑，不挤成条）
            gridTemplateColumns: isMobile ? "40px repeat(7, minmax(64px, 1fr))" : "48px repeat(7, 1fr)",
            minWidth: isMobile ? 488 : undefined,
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            overflow: "hidden",
            background: "var(--color-bg)",
          }}
        >
          {/* 表头:空角 + 7 个日期 */}
          <div style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }} />
          {weekDays.map((d) => {
            const isToday = d.iso === todayIso;
            return (
              <button
                key={d.iso}
                onClick={() => onEnterDay(d.iso)}
                style={{
                  background: "var(--color-surface)",
                  border: "none",
                  borderLeft: "1px solid var(--color-border-soft)",
                  borderBottom: "1px solid var(--color-border)",
                  padding: "10px 8px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  textAlign: "center",
                }}
                title={t("cal.enterDayView")}
              >
                <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 2 }}>
                  星期{d.weekday}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28, height: 28,
                    borderRadius: "50%",
                    background: isToday ? "var(--color-primary)" : "transparent",
                    color: isToday ? "white" : "var(--color-text)",
                    fontWeight: isToday ? 700 : 600,
                    fontSize: 14,
                  }}
                >
                  {d.day}
                </div>
              </button>
            );
          })}

          {/* 时间轴行 */}
          {Array.from({ length: HOUR_END - HOUR_START }).map((_, idx) => {
            const hour = HOUR_START + idx;
            return (
              <React.Fragment key={hour}>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-faint)",
                    padding: "4px 6px",
                    textAlign: "right",
                    borderBottom: "1px solid var(--color-border-soft)",
                    height: ROW_HEIGHT,
                    background: "var(--color-surface)",
                  }}
                >
                  {formatHour(hour)}
                </div>
                {weekDays.map((d) => {
                  // 取该日该小时内的事件
                  const cellEvents = (ddlMap.get(d.iso) ?? []).filter((e) => {
                    const t = e.dueTime || "23:59";
                    const eh = parseInt(t.split(":")[0], 10);
                    return eh === hour;
                  });
                  return (
                    <div
                      key={`${d.iso}-${hour}`}
                      // C3 空格点击创建
                      onClick={(ev) => {
                        // 只有点中"空白"区域(非事件按钮)才创建
                        if ((ev.target as HTMLElement).tagName === "DIV" && onCreateAt) {
                          onCreateAt(d.iso, hour);
                        }
                      }}
                      // C4 接收拖入事件
                      onDragOver={(ev) => {
                        if (onMoveEvent) {
                          ev.preventDefault();
                          (ev.currentTarget as HTMLDivElement).style.background = "var(--color-primary-soft)";
                        }
                      }}
                      onDragLeave={(ev) => {
                        (ev.currentTarget as HTMLDivElement).style.background =
                          d.iso === todayIso ? "color-mix(in srgb, var(--color-primary) 3%, transparent)" : "transparent";
                      }}
                      onDrop={(ev) => {
                        if (!onMoveEvent) return;
                        ev.preventDefault();
                        (ev.currentTarget as HTMLDivElement).style.background =
                          d.iso === todayIso ? "color-mix(in srgb, var(--color-primary) 3%, transparent)" : "transparent";
                        const id = ev.dataTransfer.getData("text/plain");
                        if (id) onMoveEvent(id, d.iso, `${String(hour).padStart(2, "0")}:00`);
                      }}
                      style={{
                        borderLeft: "1px solid var(--color-border-soft)",
                        borderBottom: "1px solid var(--color-border-soft)",
                        height: ROW_HEIGHT,
                        padding: 2,
                        position: "relative",
                        background: d.iso === todayIso ? "color-mix(in srgb, var(--color-primary) 3%, transparent)" : "transparent",
                        cursor: onCreateAt ? "cell" : "default",
                      }}
                      title={onCreateAt ? `点击创建 · ${d.iso} ${String(hour).padStart(2, "0")}:00` : ""}
                    >
                      {cellEvents.map((e) => (
                        <button
                          key={e.id}
                          // C4 事件可拖动
                          draggable={!!onMoveEvent}
                          onDragStart={(ev) => {
                            ev.dataTransfer.setData("text/plain", e.id);
                            ev.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(ev) => { ev.stopPropagation(); onEditEvent(e); }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "2px 5px",
                            borderRadius: 4,
                            border: "none",
                            borderLeft: `3px solid ${
                              e.completed
                                ? "var(--color-text-faint)"
                                : "var(--color-primary)"
                            }`,
                            background: "var(--color-primary-soft)",
                            color: "var(--color-primary)",
                            fontSize: 10,
                            fontWeight: 500,
                            cursor: onMoveEvent ? "grab" : "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            opacity: e.completed ? 0.5 : 1,
                            textDecoration: e.completed ? "line-through" : "none",
                          }}
                          title={`${e.taskName} · ${e.dueTime || "23:59"}${onMoveEvent ? t("cal.eventDrag") : ""}`}
                        >
                          {e.dueTime} {e.taskName}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
