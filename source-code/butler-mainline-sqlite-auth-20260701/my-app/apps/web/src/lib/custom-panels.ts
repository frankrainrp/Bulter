// ============================================================
// lib/custom-panels.ts — Phase E 自定义面板
//
// 用户在内置 4 Tab 之外创建额外面板。MVP：每个 panel 是一段
// Markdown 文档（适用于学习日志 / 链接收藏 / 知识库 / 项目计划等）。
//
// IndexedDB customPanels 表（Dexie v7）。变更通过 CustomEvent 通知
// page.tsx 立即同步。
// ============================================================

import { getDb } from "./db";
import type { CustomPanel } from "./types";

export const CUSTOM_PANEL_EVENT = "butler-custom-panel-change";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CUSTOM_PANEL_EVENT));
}

// ---------- CRUD ----------

export async function getAllCustomPanels(): Promise<CustomPanel[]> {
  const list = await getDb().customPanels.toArray();
  // 按 createdAt 升序（"先创建的在前"，匹配 Tab 顺序心智）
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getCustomPanel(id: string): Promise<CustomPanel | undefined> {
  return getDb().customPanels.get(id);
}

export async function createCustomPanel(label: string, emoji: string = "📋"): Promise<CustomPanel> {
  const now = Date.now();
  const panel: CustomPanel = {
    id: "custom-" + uid(),
    label: label.slice(0, 12).trim() || "新面板",
    emoji: (emoji || "📋").slice(0, 3),
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  await getDb().customPanels.add(panel);
  dispatchChange();
  return panel;
}

export async function updateCustomPanel(
  id: string,
  patch: Partial<Pick<CustomPanel, "label" | "emoji" | "content" | "kind" | "url" | "modules" | "spec">>,
): Promise<void> {
  const next: Partial<CustomPanel> = { ...patch, updatedAt: Date.now() };
  if (patch.label !== undefined) next.label = patch.label.slice(0, 12).trim() || "新面板";
  if (patch.emoji !== undefined) next.emoji = (patch.emoji || "📋").slice(0, 3);
  if (patch.url !== undefined) next.url = patch.url.trim();
  await getDb().customPanels.update(id, next);
  dispatchChange();
}

export async function deleteCustomPanel(id: string): Promise<void> {
  await getDb().customPanels.delete(id);
  dispatchChange();
}

/** [054] D.3：直接 put 完整 panel（用于 ConfirmCard 接受 AI 生成的草稿）*/
export async function putCustomPanel(panel: CustomPanel): Promise<void> {
  await getDb().customPanels.put(panel);
  dispatchChange();
}
