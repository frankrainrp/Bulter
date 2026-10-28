"use client";

// ============================================================
// lib/recurring.ts — 周期任务（重复任务模板）[079]
//
// 管家的「额外可触发逻辑」：每到新周期自动把周期任务生成成具体实例。
//   - 周期 cadence：daily / weekly / monthly
//   - timesPerPeriod：每周期生成几个（如每周去健身房 4 次）
//   - materializeDue：扫描所有 active 模板，当期未生成过就生成 + 记 lastGeneratedPeriod
//
// 生成的是普通 DdlItem（source="周期任务"，带 recurringId 溯源），进入任务清单/日历。
// ============================================================

import { getDb } from "./db";
import type { DdlItem, RecurringTask, RecurringCadence } from "./types";

export const RECURRING_EVENT = "butler-recurring-change";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RECURRING_EVENT));
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 本周一（周从周一开始）*/
function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** 当前周期 key（同期内稳定，跨期变化）*/
export function periodKey(cadence: RecurringCadence, now = new Date()): string {
  if (cadence === "daily") return "d-" + iso(now);
  if (cadence === "weekly") return "w-" + iso(mondayOf(now));
  return "m-" + `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** N 次在周期内均匀分布的「天偏移」（相对周期起点）*/
function spreadOffsets(times: number, span: number): number[] {
  const n = Math.max(1, times);
  if (n === 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round((i * (span - 1)) / (n - 1)));
  return out;
}

/** 为「当前周期」生成实例 */
export function buildInstances(routine: RecurringTask, now = new Date()): DdlItem[] {
  const times = Math.max(1, Math.min(routine.timesPerPeriod || 1, 31));
  let baseDates: string[] = [];

  if (routine.cadence === "daily") {
    baseDates = Array.from({ length: times }, () => iso(now));
  } else if (routine.cadence === "weekly") {
    const monday = mondayOf(now);
    baseDates = spreadOffsets(times, 7).map((off) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + off);
      return iso(d);
    });
  } else {
    // monthly：在本月内分布
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    baseDates = spreadOffsets(times, daysInMonth).map((off) => iso(new Date(y, m, 1 + off)));
  }

  return baseDates.map((dueDate, i) => ({
    id: uid(),
    taskName: times > 1 ? `${routine.taskName}（${i + 1}/${times}）` : routine.taskName,
    weight: routine.weight ?? null,
    dueDate,
    dueTime: routine.dueTime || "23:59",
    description: routine.description || "",
    isGroupWork: false,
    source: "周期任务",
    completed: false,
    status: "todo",
    recurringId: routine.id,
    ...(routine.tags && routine.tags.length > 0 ? { tags: routine.tags } : {}),
  }));
}

/** 扫描所有模板：当期未生成的 → 生成实例 + 标记。返回新任务 + 变更后的模板。*/
export function materializeDue(
  routines: RecurringTask[],
  now = new Date(),
): { newTasks: DdlItem[]; updatedRoutines: RecurringTask[]; changed: boolean } {
  const newTasks: DdlItem[] = [];
  let changed = false;
  const updatedRoutines = routines.map((r) => {
    if (!r.active) return r;
    const key = periodKey(r.cadence, now);
    if (r.lastGeneratedPeriod === key) return r;
    newTasks.push(...buildInstances(r, now));
    changed = true;
    return { ...r, lastGeneratedPeriod: key };
  });
  return { newTasks, updatedRoutines, changed };
}

// ---------- 持久化 ----------
export async function getAllRecurring(): Promise<RecurringTask[]> {
  const list = await getDb().recurringTasks.toArray();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putRecurring(routine: RecurringTask): Promise<void> {
  await getDb().recurringTasks.put(routine);
  dispatchChange();
}

export async function bulkPutRecurring(routines: RecurringTask[]): Promise<void> {
  if (routines.length === 0) return;
  await getDb().recurringTasks.bulkPut(routines);
  // 不 dispatch：批量回写 lastGeneratedPeriod 属内部同步，避免回环
}

export async function deleteRecurring(id: string): Promise<void> {
  await getDb().recurringTasks.delete(id);
  dispatchChange();
}

export function makeRecurring(input: Partial<RecurringTask> & { taskName: string; cadence: RecurringCadence }): RecurringTask {
  return {
    id: "rec-" + uid(),
    taskName: input.taskName.trim().slice(0, 40),
    cadence: input.cadence,
    timesPerPeriod: Math.max(1, Math.min(input.timesPerPeriod || 1, 31)),
    dueTime: input.dueTime || "23:59",
    weight: input.weight ?? null,
    description: input.description || "",
    tags: input.tags,
    emoji: input.emoji || "🔁",
    active: input.active ?? true,
    createdAt: Date.now(),
    lastGeneratedPeriod: undefined, // 首次立即生成当期
  };
}

export const CADENCE_LABEL: Record<RecurringCadence, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
};
