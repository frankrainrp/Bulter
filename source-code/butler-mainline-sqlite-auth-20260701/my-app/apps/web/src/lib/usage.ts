"use client";

// ============================================================
// lib/usage.ts — 真实成本计量层（5 小时滑动窗口 + 周用量）
// [087] 变现方案 P1；[089] 加周用量（模仿 Claude：5h 窗口 + 每周上限两层）。
//   每个模型按 token 真实成本折 ¥，同时累计到「当前 5h 窗口」与「本周」。
//   窗口/周翻篇即清零（用不完不累积）。详见 Doc/变现方案.md §2。
//
// chat 路由开 stream_options.include_usage → 流尾返回 usage →
//   chat-client 调 recordUsage(model, prompt_tokens, completion_tokens)。
// ⚠️ 演示模式：计量存 localStorage（前端可篡改）。接真后端时迁服务端权威记账。
// ============================================================

import { useEffect, useState } from "react";
import type { AiModelId } from "./ai-models";

/**
 * 成本单价：¥ / 1000 token（代表性值，约 USD/M × 7.2 ÷ 1000）。
 * P4 `scripts/sync-models.ts` 会用各家官方定价覆盖此表。
 */
export const COST_PER_K: Record<AiModelId, { in: number; out: number }> = {
  "deepseek-v4-flash":    { in: 0.001,  out: 0.002 },
  "deepseek-v4-thinking": { in: 0.002,  out: 0.003 },
  gemini:                 { in: 0.009,  out: 0.072 },
  gpt:                    { in: 0.018,  out: 0.072 },
  claude:                 { in: 0.0216, out: 0.108 },
};

export const WINDOW_HOURS = 5;
const WINDOW_MS = WINDOW_HOURS * 3600 * 1000;
/** 每 5h 窗口免费额度（¥）。日额度 ≈ 3 ÷ (24/5) ≈ ¥0.625 → 取 ¥0.6 */
export const WINDOW_BUDGET = 0.6;

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** 每周免费额度上限（¥）。≈ ¥0.6/窗 × 4.8 窗/天 × 7 ≈ ¥20（周维度兜底，模仿 Claude）*/
export const WEEKLY_BUDGET = 20;

export const USAGE_EVENT = "butler:usage-change";
const WIN_PREFIX = "butler.usage.win.";
const WEEK_PREFIX = "butler.usage.week.";

// ---------- 时间窗口 ----------
/** 当前 5h 窗口起点（按网格对齐，跨午夜/时区无缝）*/
export function getWindowStart(now = Date.now()): number {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}
/** 当前窗口结束（= 下次回满）时间戳 */
export function getNextResetAt(now = Date.now()): number {
  return getWindowStart(now) + WINDOW_MS;
}
/** 本周起点（7 天网格对齐）*/
export function getWeekStart(now = Date.now()): number {
  return Math.floor(now / WEEK_MS) * WEEK_MS;
}
/** 本周结束（= 周额度回满）时间戳 */
export function getWeekResetAt(now = Date.now()): number {
  return getWeekStart(now) + WEEK_MS;
}

function winKey(now = Date.now()): string {
  return WIN_PREFIX + getWindowStart(now);
}
function weekKey(now = Date.now()): string {
  return WEEK_PREFIX + getWeekStart(now);
}

/** 计算一次调用的 ¥ 成本 */
export function costOf(model: AiModelId, promptTokens: number, completionTokens: number): number {
  const p = COST_PER_K[model] ?? COST_PER_K["deepseek-v4-flash"];
  return (promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out;
}

function readNum(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? parseFloat(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** 当前窗口已花 ¥ */
export function getWindowSpend(now = Date.now()): number {
  if (typeof window === "undefined") return 0;
  return readNum(winKey(now));
}
/** 本周已花 ¥ */
export function getWeekSpend(now = Date.now()): number {
  if (typeof window === "undefined") return 0;
  return readNum(weekKey(now));
}
/** 当前窗口剩余 ¥ */
export function getWindowRemaining(now = Date.now()): number {
  return Math.max(0, WINDOW_BUDGET - getWindowSpend(now));
}
/** 本周剩余 ¥ */
export function getWeekRemaining(now = Date.now()): number {
  return Math.max(0, WEEKLY_BUDGET - getWeekSpend(now));
}

/** 发送前预检：当前窗口与本周都还有免费额度（任一耗尽即拦，下条才拦）*/
export function canSpend(): boolean {
  return getWindowRemaining() > 0 && getWeekRemaining() > 0;
}

/** 清掉非当前的旧 usage 键（窗口/周各保留当前），避免 localStorage 无限增长 */
function cleanupOld(curWin: string, curWeek: string) {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(WIN_PREFIX) && k !== curWin) toRemove.push(k);
      else if (k.startsWith(WEEK_PREFIX) && k !== curWeek) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* silent */
  }
}

/** 记一次用量 → 累加到当前窗口 + 本周 + 广播。返回本次 ¥ 成本。*/
export function recordUsage(model: AiModelId, promptTokens: number, completionTokens: number): number {
  if (typeof window === "undefined") return 0;
  const cost = costOf(model, promptTokens, completionTokens);
  if (cost <= 0) return 0;
  try {
    const wk = winKey();
    const wkw = weekKey();
    localStorage.setItem(wk, String(getWindowSpend() + cost));
    localStorage.setItem(wkw, String(getWeekSpend() + cost));
    cleanupOld(wk, wkw);
    window.dispatchEvent(new CustomEvent(USAGE_EVENT));
  } catch {
    /* silent */
  }
  return cost;
}

// ---------- 快照 ----------
export interface UsageBucket {
  /** 已花 ¥ */
  spend: number;
  /** 剩余 ¥ */
  remaining: number;
  /** 额度 ¥ */
  budget: number;
  /** 下次回满时间戳 */
  resetAt: number;
  /** 是否已用尽 */
  exhausted: boolean;
  /** 已用百分比 0–100 */
  pct: number;
}

export interface UsageSnapshot {
  /** 当前 5h 窗口 */
  window: UsageBucket;
  /** 本周 */
  week: UsageBucket;
}

function bucket(spend: number, budget: number, resetAt: number): UsageBucket {
  return {
    spend,
    remaining: Math.max(0, budget - spend),
    budget,
    resetAt,
    exhausted: spend >= budget,
    pct: budget > 0 ? Math.min(100, (spend / budget) * 100) : 0,
  };
}

export function readUsage(now = Date.now()): UsageSnapshot {
  return {
    window: bucket(getWindowSpend(now), WINDOW_BUDGET, getNextResetAt(now)),
    week: bucket(getWeekSpend(now), WEEKLY_BUDGET, getWeekResetAt(now)),
  };
}

const EMPTY_SNAPSHOT: UsageSnapshot = {
  window: bucket(0, WINDOW_BUDGET, 0),
  week: bucket(0, WEEKLY_BUDGET, 0),
};

/** 订阅用量变化（记账事件 + 30s 兜底复查窗口/周翻篇）。SSR 安全：初始空、挂载后读真实。*/
export function useUsage(): UsageSnapshot {
  const [snap, setSnap] = useState<UsageSnapshot>(EMPTY_SNAPSHOT);
  useEffect(() => {
    const update = () => setSnap(readUsage());
    update();
    window.addEventListener(USAGE_EVENT, update);
    const iv = setInterval(update, 30000);
    return () => {
      window.removeEventListener(USAGE_EVENT, update);
      clearInterval(iv);
    };
  }, []);
  return snap;
}

/** 倒计时友好文案：`2天3h` / `2h48m` / `12m` / `<1m` */
export function formatCountdown(resetAt: number, now = Date.now()): string {
  const ms = Math.max(0, resetAt - now);
  const totalMin = Math.floor(ms / 60000);
  if (totalMin <= 0) return "<1m";
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}天${h}h`;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}
