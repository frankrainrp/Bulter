// ============================================================
// lib/panel-data.ts — [064] 面板模组：Butler 真实数据绑定
//
// 把模组的 metric/filter 解析成可渲染的数据，全部从 ddls/notes/streak
// 现场算（无持久化）。注：任务无「完成时间戳」，故时间序列用 dueDate 密度
// （反映任务负载）；将来给 DdlItem 加 completedAt 后可换成真实完成分布。
// ============================================================

import type { DdlItem, Note, PanelMetric } from "./types";

export interface PanelDataCtx {
  ddls: DdlItem[];
  notes: Note[];
  streakCurrent: number;
  streakLongest: number;
}

const effStatus = (d: DdlItem): string => d.status ?? (d.completed ? "done" : "todo");
const isDone = (d: DdlItem): boolean => effStatus(d) === "done";

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso(): string {
  return isoOf(new Date());
}

// ---- 统计大数字 ----
export function resolveStat(metric: PanelMetric | undefined, ctx: PanelDataCtx): { value: number; label: string } {
  const t = todayIso();
  switch (metric) {
    case "tasks-total": return { value: ctx.ddls.length, label: "任务总数" };
    case "tasks-done": return { value: ctx.ddls.filter(isDone).length, label: "已完成任务" };
    case "tasks-active": return { value: ctx.ddls.filter((d) => !isDone(d)).length, label: "待办任务" };
    case "tasks-today": return { value: ctx.ddls.filter((d) => d.dueDate === t && !isDone(d)).length, label: "今日到期" };
    case "notes-total": return { value: ctx.notes.length, label: "笔记数" };
    case "streak-current": return { value: ctx.streakCurrent, label: "连续天数" };
    case "streak-longest": return { value: ctx.streakLongest, label: "最长连续" };
    default: return { value: ctx.ddls.filter((d) => !isDone(d)).length, label: "待办任务" };
  }
}

// ---- 系列数据（pie / bar）----
const STATUS_LABEL: Record<string, string> = { todo: "待办", in_progress: "进行中", done: "已完成" };

export function resolveSeries(
  metric: PanelMetric | undefined,
  ctx: PanelDataCtx,
  fallback?: { label: string; value: number }[],
): { label: string; value: number }[] {
  switch (metric) {
    case "tasks-by-status": {
      const counts: Record<string, number> = { todo: 0, in_progress: 0, done: 0 };
      for (const d of ctx.ddls) counts[effStatus(d)] = (counts[effStatus(d)] ?? 0) + 1;
      return Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ label: STATUS_LABEL[k] ?? k, value: v }));
    }
    case "tasks-by-source": {
      const counts = new Map<string, number>();
      for (const d of ctx.ddls) {
        const key = d.source || "未分类";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
    }
    case "completion-7d": {
      // 近 7 日（含今天）每日到期任务数
      const out: { label: string; value: number }[] = [];
      const wd = ["日", "一", "二", "三", "四", "五", "六"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = isoOf(d);
        const value = ctx.ddls.filter((t) => t.dueDate === iso).length;
        out.push({ label: wd[d.getDay()], value });
      }
      return out;
    }
    default:
      return fallback && fallback.length > 0 ? fallback : [];
  }
}

// ---- 热力图（dueDate 密度，7 周窗口：今天前 5 周 + 后 2 周）----
export function resolveHeatmap(ctx: PanelDataCtx): { date: string; count: number; weekday: number }[] {
  const days: { date: string; count: number; weekday: number }[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 35);
  for (let i = 0; i < 49; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = isoOf(d);
    days.push({
      date: iso,
      count: ctx.ddls.filter((t) => t.dueDate === iso).length,
      weekday: d.getDay(),
    });
  }
  return days;
}

// ---- 任务清单 ----
export function resolveTasks(
  filter: "active" | "today" | "upcoming" | "completed" | "all" | undefined,
  ctx: PanelDataCtx,
  limit = 6,
): DdlItem[] {
  const t = todayIso();
  let list = ctx.ddls;
  switch (filter) {
    case "today": list = ctx.ddls.filter((d) => d.dueDate === t && !isDone(d)); break;
    case "upcoming": list = ctx.ddls.filter((d) => !isDone(d) && d.dueDate >= t); break;
    case "completed": list = ctx.ddls.filter(isDone); break;
    case "all": list = ctx.ddls; break;
    case "active":
    default: list = ctx.ddls.filter((d) => !isDone(d)); break;
  }
  return [...list]
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, limit);
}

// ---- 倒计时目标 ----
export function resolveCountdown(
  targetDate: string | undefined,
  ctx: PanelDataCtx,
): { date: string; label: string; days: number } | null {
  const t = todayIso();
  let date = targetDate;
  let label = "目标日期";
  if (!date) {
    // 最近的未完成 DDL
    const upcoming = ctx.ddls
      .filter((d) => !isDone(d) && d.dueDate && d.dueDate >= t)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (upcoming.length === 0) return null;
    date = upcoming[0].dueDate;
    label = upcoming[0].taskName;
  }
  const diff = Math.ceil((new Date(date + "T00:00:00").getTime() - new Date(t + "T00:00:00").getTime()) / 86400000);
  return { date, label, days: diff };
}
