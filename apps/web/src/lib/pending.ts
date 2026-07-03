// ============================================================
// lib/pending.ts — AI 写操作的"待核实"模型
// AI 不直接改 ddls，先入 PendingBatch，等用户接受后才落库
// ============================================================

import type { DdlItem, Note, CustomPanel } from "./types";

export type PendingChangeKind = "create" | "update" | "delete" | "create-note" | "create-custom-panel";

export interface PendingChangeBase {
  id: string;          // change 自身的 id（用于 ✕ 单条删除）
  kind: PendingChangeKind;
  /** 一句话摘要，给 ConfirmCard 显示 */
  summary: string;
}

export interface PendingCreate extends PendingChangeBase {
  kind: "create";
  /** 暂存的 DdlItem 草稿（已经分配了 id，但还没入 ddls）*/
  draft: DdlItem;
}

export interface PendingUpdate extends PendingChangeBase {
  kind: "update";
  targetId: string;
  /** 修改前的快照，用于显示 diff */
  before: DdlItem;
  /** 要 patch 的字段 */
  patch: Partial<DdlItem>;
}

export interface PendingDelete extends PendingChangeBase {
  kind: "delete";
  targetId: string;
  /** 删除前的快照 */
  before: DdlItem;
}

/** B2 跨面板联动：AI 帮记笔记到 Notes 面板 */
export interface PendingCreateNote extends PendingChangeBase {
  kind: "create-note";
  /** 暂存的 Note 草稿（已分配 id，待用户核实后入 notes 表） */
  noteDraft: Note;
}

/** [054] D.3：AI 帮建自定义面板 */
export interface PendingCreateCustomPanel extends PendingChangeBase {
  kind: "create-custom-panel";
  /** 暂存的 CustomPanel 草稿（已分配 id/createdAt/updatedAt，待用户核实后入 customPanels 表）*/
  panelDraft: CustomPanel;
}

export type PendingChange =
  | PendingCreate
  | PendingUpdate
  | PendingDelete
  | PendingCreateNote
  | PendingCreateCustomPanel;

/** 一批属于同一次 AI 回合（或同一次 PDF pipeline）的 changes */
export interface PendingBatch {
  id: string;
  sessionId: string;
  changes: PendingChange[];
  /** 来源：AI 对话 tool_call / PDF 提取 / 其他自动化 */
  origin: "ai-chat" | "pdf-extract" | "other";
  /** 给 ConfirmCard 顶部显示的一句话 */
  intro: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
}

// ============================================================
// helpers
// ============================================================

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export const makeBatch = (sessionId: string, origin: PendingBatch["origin"], intro: string): PendingBatch => ({
  id: "batch-" + uid(),
  sessionId,
  changes: [],
  origin,
  intro,
  createdAt: Date.now(),
  status: "pending",
});

export const makeChangeId = () => "chg-" + uid();

/** 把一个 PendingBatch 应用到 ddls 数组（仅 ddls 相关 changes）— 返回新 ddls + 统计。
 *  note 类型 change 由 page.tsx 另外处理（applyNotesBatch） */
export function applyBatch(prev: DdlItem[], batch: PendingBatch): { next: DdlItem[]; stats: { created: number; updated: number; deleted: number } } {
  let next = [...prev];
  let created = 0, updated = 0, deleted = 0;
  for (const ch of batch.changes) {
    if (ch.kind === "create") {
      next = [...next, ch.draft];
      created++;
    } else if (ch.kind === "update") {
      next = next.map((d) => (d.id === ch.targetId ? { ...d, ...ch.patch } : d));
      updated++;
    } else if (ch.kind === "delete") {
      next = next.filter((d) => d.id !== ch.targetId);
      deleted++;
    }
    // create-note 在 page.tsx 单独处理（走 setNotes）
  }
  return { next, stats: { created, updated, deleted } };
}

/** 提取 batch 中所有 create-note 的草稿 — page.tsx 接受时调用 */
export function extractNoteDrafts(batch: PendingBatch): Note[] {
  return batch.changes
    .filter((c): c is PendingCreateNote => c.kind === "create-note")
    .map((c) => c.noteDraft);
}

/** [054] D.3：提取 batch 中所有 create-custom-panel 草稿 */
export function extractCustomPanelDrafts(batch: PendingBatch): CustomPanel[] {
  return batch.changes
    .filter((c): c is PendingCreateCustomPanel => c.kind === "create-custom-panel")
    .map((c) => c.panelDraft);
}
