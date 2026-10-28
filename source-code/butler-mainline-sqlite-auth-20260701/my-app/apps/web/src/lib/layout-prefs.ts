// ============================================================
// lib/layout-prefs.ts — Phase D 元素位置自定义
//
// 持久化 3 项布局偏好（localStorage + CustomEvent 通知）：
//   - Tab 顺序（4 NavId 重排序）
//   - Tab 隐藏（可隐藏不常用的 Tab）
//   - 管家位置（left / center / right / hidden）
//
// 监听 LAYOUT_PREFS_EVENT 即时换肤（同 Phase C butler-asset 模式）
// ============================================================

import type { NavId } from "./types";

const DEFAULT_ORDER: NavId[] = ["chat", "tasks", "calendar", "notes"];
const ORDER_KEY = "butler.layout.tabsOrder";
const HIDDEN_KEY = "butler.layout.hiddenTabs";
const BUTLER_POS_KEY = "butler.layout.butlerPosition";

export type ButlerPosition = "left" | "center" | "right" | "hidden";
export const DEFAULT_BUTLER_POSITION: ButlerPosition = "center";

export const LAYOUT_PREFS_EVENT = "butler-layout-prefs-change";

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAYOUT_PREFS_EVENT));
}

// ---------- Tab 顺序 ----------

/** 读 tab 顺序；返回总是包含全部 4 个 NavId（修复历史缺失或新增） */
export function getTabsOrder(): NavId[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as NavId[];
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    // 校验 + 补齐：保留合法 id，附加任何缺失的 default id
    const seen = new Set<NavId>();
    const filtered: NavId[] = [];
    for (const id of parsed) {
      if (DEFAULT_ORDER.includes(id) && !seen.has(id)) {
        filtered.push(id);
        seen.add(id);
      }
    }
    for (const id of DEFAULT_ORDER) {
      if (!seen.has(id)) filtered.push(id);
    }
    return filtered;
  } catch { return DEFAULT_ORDER; }
}

export function setTabsOrder(order: NavId[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch { /* silent */ }
  dispatchChange();
}

export function resetTabsOrder(): void {
  try { localStorage.removeItem(ORDER_KEY); } catch { /* silent */ }
  dispatchChange();
}

// ---------- Tab 隐藏 ----------

export function getHiddenTabs(): Set<NavId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as NavId[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => DEFAULT_ORDER.includes(id)));
  } catch { return new Set(); }
}

export function setHiddenTabs(hidden: Set<NavId>): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
  } catch { /* silent */ }
  dispatchChange();
}

export function toggleHiddenTab(id: NavId): Set<NavId> {
  const cur = getHiddenTabs();
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  // 不允许全部隐藏（保留至少 1 个）
  if (cur.size >= DEFAULT_ORDER.length) cur.delete(id);
  setHiddenTabs(cur);
  return cur;
}

// ---------- 管家位置 ----------

export function getButlerPosition(): ButlerPosition {
  if (typeof window === "undefined") return DEFAULT_BUTLER_POSITION;
  try {
    const raw = localStorage.getItem(BUTLER_POS_KEY) as ButlerPosition | null;
    if (raw && ["left", "center", "right", "hidden"].includes(raw)) return raw;
    return DEFAULT_BUTLER_POSITION;
  } catch { return DEFAULT_BUTLER_POSITION; }
}

export function setButlerPosition(pos: ButlerPosition): void {
  try {
    if (pos === DEFAULT_BUTLER_POSITION) {
      localStorage.removeItem(BUTLER_POS_KEY);
    } else {
      localStorage.setItem(BUTLER_POS_KEY, pos);
    }
  } catch { /* silent */ }
  dispatchChange();
}
