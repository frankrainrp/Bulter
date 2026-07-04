// Browser-side executor for AI tool calls.
//
// The backend exposes tool schemas to the model, but this file decides what a
// tool call actually does to frontend state. High-risk writes are converted
// into PendingChange records first; the user must accept the confirmation card
// before task, note, or panel state is changed.

import type { DdlItem, Note, CustomPanel, RecurringTask } from "./types";
import type { ApiToolCall } from "./chat-client";
import {
  compactItem,
  compactNote,
  type ToolCall,
  type ToolResult,
  type CreateItemArgs,
  type UpdateItemArgs,
  type DeleteItemArgs,
  type ToggleCompleteArgs,
  type ListItemsArgs,
  type CreateNoteArgs,
  type ListNotesArgs,
  type UpdateNoteArgs,
  type DeleteNoteArgs,
  type CreateCustomPanelArgs,
  type CreateRecurringTaskArgs,
} from "./ai-tools";
import { makeChangeId, type PendingChange } from "./pending";
import { makeRecurring, CADENCE_LABEL } from "./recurring";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export interface ToolExecutorDeps {
  // Use getter functions instead of captured arrays so tool calls read the
  // latest page state.
  getDdls: () => DdlItem[];
  // Direct task writes are reserved for low-risk reversible actions.
  setDdls: React.Dispatch<React.SetStateAction<DdlItem[]>>;
  getNotes: () => Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  // Adds one proposed write to the current review batch.
  addPending: (change: PendingChange) => void;
  // Saves a recurring template and materializes the current-period instance.
  addRecurring?: (routine: RecurringTask) => void;
}

export function createToolExecutor(deps: ToolExecutorDeps) {
  return async (call: ApiToolCall): Promise<ToolResult> => {
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      return { ok: false, message: `Tool argument JSON parse failed: ${call.function.arguments}` };
    }

    // Tool names must match ChatToolDefinitions.ts and ai-tools.ts. The
    // fallback prevents hallucinated tool names from crashing the UI.
    switch (call.function.name as ToolCall["name"]) {
      case "create_item":
        return execCreate(args as CreateItemArgs, deps);
      case "update_item":
        return execUpdate(args as UpdateItemArgs, deps);
      case "delete_item":
        return execDelete(args as DeleteItemArgs, deps);
      case "toggle_complete":
        return execToggle(args as ToggleCompleteArgs, deps);
      case "list_items":
        return execList(args as ListItemsArgs, deps);
      case "create_note":
        return execCreateNote(args as CreateNoteArgs, deps);
      case "list_notes":
        return execListNotes(args as ListNotesArgs, deps);
      case "update_note":
        return execUpdateNote(args as UpdateNoteArgs, deps);
      case "delete_note":
        return execDeleteNote(args as DeleteNoteArgs, deps);
      case "create_custom_panel":
        return execCreateCustomPanel(args as CreateCustomPanelArgs, deps);
      case "create_recurring_task":
        return execCreateRecurring(args as CreateRecurringTaskArgs, deps);
      default:
        return { ok: false, message: `Unknown tool: ${call.function.name}` };
    }
  };
}

function execCreate(args: CreateItemArgs, { addPending }: ToolExecutorDeps): ToolResult {
  // Creating tasks is a durable write, so it always enters the review queue.
  if (!args.taskName) {
    return { ok: false, message: "Missing required field taskName" };
  }
  const dueDate = args.dueDate ?? "";
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, message: `dueDate must be YYYY-MM-DD or an empty string. Received: ${dueDate}` };
  }

  const status = args.status ?? "todo";
  const draft: DdlItem = {
    id: uid(),
    taskName: args.taskName,
    weight: args.weight ?? null,
    dueDate,
    dueTime: args.dueTime || "23:59",
    description: args.description || "",
    isGroupWork: args.isGroupWork ?? false,
    source: "AI draft (pending review)",
    completed: status === "done",
    status,
    ...(args.tags && args.tags.length > 0 ? { tags: args.tags } : {}),
    ...(args.priority ? { priority: args.priority } : {}),
    ...(args.notes ? { notes: args.notes } : {}),
  };

  const dateLabel = draft.dueDate || "TBD";
  addPending({
    id: makeChangeId(),
    kind: "create",
    summary: `${draft.taskName} - ${dateLabel}${draft.dueTime ? " " + draft.dueTime : ""}`,
    draft,
  });

  return {
    ok: true,
    message: `Created a new-item draft: ${draft.taskName} (${dateLabel}). It was added to the review queue and will be saved only after the user accepts it.`,
    data: compactItem(draft),
  };
}

function execUpdate(args: UpdateItemArgs, { getDdls, addPending }: ToolExecutorDeps): ToolResult {
  // Prefer exact ids; fuzzy names are only a fallback when the model lacks an id.
  const target = findItem(getDdls(), args.itemId, args.taskNameFuzzy);
  if (!target) {
    return {
      ok: false,
      message: `Could not find a matching task (itemId=${args.itemId}, taskNameFuzzy=${args.taskNameFuzzy}). Call list_items first if needed.`,
    };
  }
  if (args.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)) {
    return { ok: false, message: `dueDate must be YYYY-MM-DD. Received: ${args.dueDate}` };
  }

  // Only fields explicitly supplied by the model are patched. undefined means
  // "leave unchanged"; null remains a valid value for fields such as weight.
  const patch: Partial<DdlItem> = {
    ...(args.taskName !== undefined ? { taskName: args.taskName } : {}),
    ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
    ...(args.dueTime !== undefined ? { dueTime: args.dueTime } : {}),
    ...(args.weight !== undefined ? { weight: args.weight } : {}),
    ...(args.description !== undefined ? { description: args.description } : {}),
    ...(args.isGroupWork !== undefined ? { isGroupWork: args.isGroupWork } : {}),
    ...(args.status !== undefined ? { status: args.status, completed: args.status === "done" } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.priority !== undefined ? { priority: args.priority } : {}),
    ...(args.notes !== undefined ? { notes: args.notes } : {}),
  };
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "update_item needs at least one field to update" };
  }

  addPending({
    id: makeChangeId(),
    kind: "update",
    targetId: target.id,
    before: target,
    patch,
    summary: `${target.taskName}`,
  });

  return {
    ok: true,
    message: `Created an update draft for ${target.taskName}. It was added to the review queue.`,
    data: compactItem({ ...target, ...patch }),
  };
}

function execDelete(args: DeleteItemArgs, { getDdls, addPending }: ToolExecutorDeps): ToolResult {
  const target = findItem(getDdls(), args.itemId, args.taskNameFuzzy);
  if (!target) {
    return {
      ok: false,
      message: `Could not find a matching task (itemId=${args.itemId}, taskNameFuzzy=${args.taskNameFuzzy})`,
    };
  }

  // Deletion is staged with the original item attached so the UI can show
  // exactly what would be removed.
  addPending({
    id: makeChangeId(),
    kind: "delete",
    targetId: target.id,
    before: target,
    summary: `${target.taskName}`,
  });
  return {
    ok: true,
    message: `Created a delete draft for ${target.taskName}. It was added to the review queue.`,
    data: { id: target.id },
  };
}

function execToggle(args: ToggleCompleteArgs, { getDdls, setDdls }: ToolExecutorDeps): ToolResult {
  // Completion toggles are reversible and low risk, so they are applied
  // directly instead of going through the review queue.
  const target = findItem(getDdls(), args.itemId, args.taskNameFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching task" };
  }

  const nextCompleted = args.completed !== undefined ? args.completed : !target.completed;
  setDdls((prev) => prev.map((it) => (it.id === target.id ? { ...it, completed: nextCompleted } : it)));
  return {
    ok: true,
    message: nextCompleted ? `Marked complete: ${target.taskName}` : `Marked incomplete: ${target.taskName}`,
    data: { id: target.id, completed: nextCompleted },
  };
}

function execList(args: ListItemsArgs, { getDdls }: ToolExecutorDeps): ToolResult {
  // Listing is read-only and helps the model obtain real ids before it proposes
  // updates or deletions.
  const all = getDdls();
  const filter = args.filter || "all";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = all.filter((d) => {
    if (filter === "all") return true;
    if (filter === "active") return !d.completed;
    if (filter === "completed") return d.completed;
    const due = new Date(d.dueDate);
    const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (filter === "today") return diff === 0 && !d.completed;
    if (filter === "thisWeek") return diff >= 0 && diff <= 7 && !d.completed;
    if (filter === "later") return diff > 7 && !d.completed;
    return true;
  });

  return {
    ok: true,
    message: `Found ${filtered.length} matching item(s)`,
    data: filtered.map(compactItem),
  };
}

function execCreateNote(args: CreateNoteArgs, { addPending }: ToolExecutorDeps): ToolResult {
  if (!args.title || !args.content) {
    return { ok: false, message: "create_note needs title and content" };
  }

  const now = Date.now();
  const noteDraft: Note = {
    id: "note-" + uid(),
    title: args.title.slice(0, 60),
    content: args.content,
    ...(args.tags && args.tags.length > 0 ? { tags: args.tags } : {}),
    createdAt: now,
    updatedAt: now,
  };

  addPending({
    id: makeChangeId(),
    kind: "create-note",
    summary: noteDraft.title,
    noteDraft,
  });
  return {
    ok: true,
    message: `Created a note draft: "${noteDraft.title}" (${noteDraft.content.length} chars). It was added to the review queue.`,
    data: { id: noteDraft.id, title: noteDraft.title, length: noteDraft.content.length },
  };
}

function execListNotes(args: ListNotesArgs, { getNotes }: ToolExecutorDeps): ToolResult {
  const query = (args.query || "").trim().toLowerCase();
  const notes = getNotes();
  const filtered = query
    ? notes.filter((note) => {
        const haystack = `${note.title} ${note.content} ${(note.tags ?? []).join(" ")}`.toLowerCase();
        return haystack.includes(query);
      })
    : notes;

  return {
    ok: true,
    message: `Found ${filtered.length} note(s).`,
    data: filtered.map(compactNote),
  };
}

function execUpdateNote(args: UpdateNoteArgs, { getNotes, setNotes }: ToolExecutorDeps): ToolResult {
  const target = findNote(getNotes(), args.noteId, args.titleFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching note. Use list_notes first if the note ID is unknown." };
  }

  const patch: Partial<Note> = {
    ...(args.title !== undefined ? { title: args.title.slice(0, 80) } : {}),
    ...(args.content !== undefined ? { content: args.content } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
  };
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "update_note needs at least one field to update." };
  }

  // Existing note updates are direct today. If this becomes high-risk later,
  // route it through PendingChange the same way task updates are handled.
  const updated: Note = { ...target, ...patch, updatedAt: Date.now() };
  setNotes((prev) => prev.map((note) => (note.id === target.id ? updated : note)));
  return {
    ok: true,
    message: `Updated note: ${updated.title || "(untitled)"}.`,
    data: compactNote(updated),
  };
}

function execDeleteNote(args: DeleteNoteArgs, { getNotes, setNotes }: ToolExecutorDeps): ToolResult {
  const target = findNote(getNotes(), args.noteId, args.titleFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching note. Use list_notes first if the note ID is unknown." };
  }

  setNotes((prev) => prev.filter((note) => note.id !== target.id));
  return {
    ok: true,
    message: `Deleted note: ${target.title || "(untitled)"}.`,
    data: { id: target.id, title: target.title },
  };
}

function execCreateCustomPanel(args: CreateCustomPanelArgs, { addPending }: ToolExecutorDeps): ToolResult {
  if (!args.label || !args.label.trim()) {
    return { ok: false, message: "create_custom_panel needs label" };
  }

  const kind: "markdown" | "iframe" | "modules" =
    args.kind === "iframe" ? "iframe" : args.kind === "modules" ? "modules" : "markdown";
  if (kind === "iframe" && (!args.url || !args.url.trim())) {
    return { ok: false, message: "kind=iframe needs url" };
  }
  if (kind === "modules" && (!args.modules || args.modules.length === 0)) {
    return { ok: false, message: "kind=modules needs at least one module" };
  }

  const now = Date.now();
  const modules =
    kind === "modules" && args.modules
      ? args.modules.map((m) => ({ id: "mod-" + uid(), type: m.type, title: m.title, config: m.config }))
      : undefined;
  const panelDraft: CustomPanel = {
    id: "custom-" + uid(),
    label: args.label.slice(0, 12).trim() || "New panel",
    emoji: (args.emoji || "📋").slice(0, 3),
    content: args.content ?? "",
    kind,
    ...(kind === "iframe" && args.url ? { url: args.url.trim() } : {}),
    ...(modules ? { modules } : {}),
    createdAt: now,
    updatedAt: now,
  };

  addPending({
    id: makeChangeId(),
    kind: "create-custom-panel",
    summary: kind === "modules"
      ? `${panelDraft.emoji} ${panelDraft.label} (${modules!.length} modules)`
      : `${panelDraft.emoji} ${panelDraft.label}`,
    panelDraft,
  });
  return {
    ok: true,
    message: `Created a custom panel draft: "${panelDraft.label}" (${kind}). It was added to the review queue.`,
    data: { id: panelDraft.id, label: panelDraft.label, kind },
  };
}

function execCreateRecurring(args: CreateRecurringTaskArgs, { addRecurring }: ToolExecutorDeps): ToolResult {
  if (!args.taskName || !args.taskName.trim()) {
    return { ok: false, message: "create_recurring_task needs taskName" };
  }
  if (args.cadence !== "daily" && args.cadence !== "weekly" && args.cadence !== "monthly") {
    return { ok: false, message: "cadence must be daily / weekly / monthly" };
  }
  if (!addRecurring) {
    return { ok: false, message: "Recurring task support is not ready" };
  }

  const times = Math.max(1, Math.min(args.timesPerPeriod || 1, 31));
  const routine = makeRecurring({
    taskName: args.taskName,
    cadence: args.cadence,
    timesPerPeriod: times,
    dueTime: args.dueTime,
    description: args.description,
    tags: args.tags,
    emoji: args.emoji,
  });
  addRecurring(routine);

  const freq = `${CADENCE_LABEL[args.cadence]}${times > 1 ? ` ${times} times` : ""}`;
  return {
    ok: true,
    message: `Created recurring task "${routine.taskName}" (${freq}) and generated the current-period instance in the task list. It will renew automatically each period.`,
    data: { id: routine.id, taskName: routine.taskName, cadence: routine.cadence, timesPerPeriod: times },
  };
}

function findItem(ddls: DdlItem[], itemId?: string, fuzzy?: string): DdlItem | null {
  if (itemId) {
    const exact = ddls.find((d) => d.id === itemId);
    if (exact) return exact;
  }
  if (fuzzy) {
    const lower = fuzzy.toLowerCase().trim();
    return ddls.find((d) => d.taskName.toLowerCase().includes(lower)) || null;
  }
  return null;
}

function findNote(notes: Note[], noteId?: string, fuzzy?: string): Note | null {
  if (noteId) {
    const exact = notes.find((note) => note.id === noteId);
    if (exact) return exact;
  }
  if (fuzzy) {
    const lower = fuzzy.toLowerCase().trim();
    return notes.find((note) => note.title.toLowerCase().includes(lower)) || null;
  }
  return null;
}
