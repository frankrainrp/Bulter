// ============================================================
// lib/streak.ts — 连续学习天数 + 成就解锁(localStorage)
//
// G2.1 streak:每次"活跃"调用 touchStreak(),按 UTC 日期 diff 判断连续
// G2.2 achievements:本地条件检测 + 解锁记录(Set);UI 用 toast 弹解锁
// ============================================================

const STREAK_KEY = "butler.streak";
const ACHIEVE_KEY = "butler.achievements";

export interface StreakState {
  /** YYYY-MM-DD 最近一次活跃日期 */
  lastActiveDate: string;
  /** 当前连续天数 */
  currentDays: number;
  /** 历史最长 */
  longestDays: number;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function getStreak(): StreakState {
  if (typeof window === "undefined") return { lastActiveDate: "", currentDays: 0, longestDays: 0 };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { lastActiveDate: "", currentDays: 0, longestDays: 0 };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { lastActiveDate: "", currentDays: 0, longestDays: 0 };
  }
}

/** 标记今日活跃 — 返回是否"今天首次"(用于触发庆祝 toast)+ 新 state */
export function touchStreak(): { newDay: boolean; broken: boolean; state: StreakState } {
  if (typeof window === "undefined") {
    return { newDay: false, broken: false, state: { lastActiveDate: "", currentDays: 0, longestDays: 0 } };
  }
  const prev = getStreak();
  const today = todayIso();
  if (prev.lastActiveDate === today) {
    return { newDay: false, broken: false, state: prev };
  }
  let newDays = 1;
  let broken = false;
  if (prev.lastActiveDate) {
    const diff = daysBetween(prev.lastActiveDate, today);
    if (diff === 1) newDays = prev.currentDays + 1;
    else broken = true; // 中断
  }
  const next: StreakState = {
    lastActiveDate: today,
    currentDays: newDays,
    longestDays: Math.max(prev.longestDays, newDays),
  };
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return { newDay: true, broken, state: next };
}

// ============================================================
// 成就
// ============================================================
export interface Achievement {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  /** 检测当前状态是否满足解锁 */
  check: (ctx: AchievementCtx) => boolean;
}

export interface AchievementCtx {
  ddlsTotal: number;
  ddlsDone: number;
  notesTotal: number;
  streakDays: number;
  longestStreak: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-task", label: "First task", emoji: "🌱", desc: "Create your first task", check: (c) => c.ddlsTotal >= 1 },
  { id: "first-done", label: "First win", emoji: "✅", desc: "Complete your first task", check: (c) => c.ddlsDone >= 1 },
  { id: "ten-done", label: "Momentum", emoji: "💪", desc: "Complete 10 tasks", check: (c) => c.ddlsDone >= 10 },
  { id: "fifty-done", label: "High output", emoji: "🚀", desc: "Complete 50 tasks", check: (c) => c.ddlsDone >= 50 },
  { id: "first-note", label: "First note", emoji: "📝", desc: "Create your first note", check: (c) => c.notesTotal >= 1 },
  { id: "streak-3", label: "Three-day streak", emoji: "🔥", desc: "Open Butler for 3 days in a row", check: (c) => c.streakDays >= 3 },
  { id: "streak-7", label: "Habit formed", emoji: "🌟", desc: "Open Butler for 7 days in a row", check: (c) => c.streakDays >= 7 },
  { id: "streak-30", label: "Thirty-day streak", emoji: "👑", desc: "Open Butler for 30 days in a row", check: (c) => c.streakDays >= 30 },
];

export function getUnlockedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ACHIEVE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

export function saveUnlockedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(ACHIEVE_KEY, JSON.stringify(Array.from(set))); } catch { /* ignore */ }
}

/** 检测新解锁:返回未在 unlocked 但 check 满足的成就 */
export function detectNewUnlocks(ctx: AchievementCtx, unlocked: Set<string>): Achievement[] {
  const newly: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    if (a.check(ctx)) newly.push(a);
  }
  return newly;
}
