// AI write proposals are staged here before they are allowed to mutate user
// task, note, or custom-panel state. The UI turns each PendingBatch into a
// confirmation card, and only accepted batches are applied.

import type { DdlItem, Note, CustomPanel } from "./types";

export type PendingChangeKind = "create" | "update" | "delete" | "create-note" | "create-custom-panel";

export interface PendingChangeBase {
  id: string;
  // Short human-readable line shown in ConfirmCard.
  summary: string;
  kind: PendingChangeKind;
}

export interface PendingCreate extends PendingChangeBase {
  kind: "create";
  // Draft task with a temporary client id. It is not saved until accepted.
  draft: DdlItem;
}

export interface PendingUpdate extends PendingChangeBase {
  kind: "update";
  targetId: string;
  // Snapshot used by the review UI and by rejection flows.
  before: DdlItem;
  // Only fields explicitly requested by the AI are included.
  patch: Partial<DdlItem>;
}

export interface PendingDelete extends PendingChangeBase {
  kind: "delete";
  targetId: string;
  // Snapshot of the item that would be removed if accepted.
  before: DdlItem;
}

export interface PendingCreateNote extends PendingChangeBase {
  kind: "create-note";
  // Draft note with a temporary client id. It is inserted only after review.
  noteDraft: Note;
}

export interface PendingCreateCustomPanel extends PendingChangeBase {
  kind: "create-custom-panel";
  // Draft panel prepared by AI, kept out of persisted panel state until review.
  panelDraft: CustomPanel;
}

export type PendingChange =
  | PendingCreate
  | PendingUpdate
  | PendingDelete
  | PendingCreateNote
  | PendingCreateCustomPanel;

export interface PendingBatch {
  id: string;
  sessionId: string;
  changes: PendingChange[];
  origin: "ai-chat" | "pdf-extract" | "other";
  intro: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
}

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

// Apply only task-related changes. Note and custom-panel drafts are extracted
// by their own helpers because they update different state buckets.
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
  }
  return { next, stats: { created, updated, deleted } };
}

export function extractNoteDrafts(batch: PendingBatch): Note[] {
  return batch.changes
    .filter((c): c is PendingCreateNote => c.kind === "create-note")
    .map((c) => c.noteDraft);
}

export function extractCustomPanelDrafts(batch: PendingBatch): CustomPanel[] {
  return batch.changes
    .filter((c): c is PendingCreateCustomPanel => c.kind === "create-custom-panel")
    .map((c) => c.panelDraft);
}
