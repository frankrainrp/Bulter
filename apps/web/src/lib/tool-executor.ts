// ============================================================
// lib/tool-executor.ts — AI tool_call 执行器
//
// 设计原则（v2，2026-05-22 起）：
//   - create / update / delete  → 不直接改 ddls，而是产出 PendingChange 入待核实队列
//   - toggle_complete          → 直接执行（用户高频低风险）
//   - list_items               → 直接执行（只读）
//
// 回执文案使用"建议..."而非"已..."，让 AI 明确告诉用户「需要核实」。
//
// 与后端 ChatToolDefinitions 的关系：
// - 后端只把工具 schema 发给模型，让模型产出 tool_calls；
// - 本文件在浏览器端解析 tool_calls.arguments，并真正改动前端状态；
// - 高风险写操作先进入 PendingChange，用户点接受后才正式落入任务/面板数据。
// ============================================================

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

// 生成本地临时 id。
// 这里不要求加密安全，只要在当前浏览器会话里低概率冲突即可。
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export interface ToolExecutorDeps {
  /** 读取当前 DDL 列表；用函数而不是闭包数组，避免 tool 执行时拿到旧状态 */
  getDdls: () => DdlItem[];
  /** 写当前 DDL 列表；仅低风险动作 toggle_complete 会直接调用 */
  setDdls: React.Dispatch<React.SetStateAction<DdlItem[]>>;
  /** 读取当前笔记列表，供 list/update/delete note 工具使用 */
  getNotes: () => Note[];
  /** 写当前笔记列表；note 的 update/delete 当前走直接执行 */
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  /** 把一个"待核实"改动追加到当前批次（page.tsx 注入） */
  addPending: (change: PendingChange) => void;
  /** [079] 创建周期任务（page.tsx 注入：落库 + 立即生成当期实例）*/
  addRecurring?: (routine: RecurringTask) => void;
}

// 工厂函数：把页面状态依赖注入进来，返回一个可传给 chat-client 的 executeToolCall。
// 这样 chat-client 不需要知道任务/笔记/面板的状态结构，只负责调用这个执行器。
export function createToolExecutor(deps: ToolExecutorDeps) {
  return async (call: ApiToolCall): Promise<ToolResult> => {
    let args: unknown;
    try {
      // 模型给出的 arguments 按 OpenAI 协议是 JSON 字符串；解析失败说明模型输出不可执行。
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      return { ok: false, message: `Tool argument JSON parse failed: ${call.function.arguments}` };
    }

    // 工具名必须与 ChatToolDefinitions.ts / ai-tools.ts 中的定义一致。
    // default 分支用于兜底未知工具，避免模型幻觉出的函数名导致运行时崩溃。
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

// ============================================================
// 1. create_item → PendingCreate（不入库，待核实）
// ============================================================
function execCreate(args: CreateItemArgs, { addPending }: ToolExecutorDeps): ToolResult {
  // 新建任务至少需要名称；日期允许空串，表示“待定”。
  if (!args.taskName) {
    return { ok: false, message: "Missing required field taskName" };
  }
  // dueDate 只接受 ISO 日期或空串，避免自然语言日期直接进入数据层。
  const dueDate = args.dueDate ?? "";
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, message: `dueDate must be YYYY-MM-DD or an empty string. Received: ${dueDate}` };
  }
  const status = args.status ?? "todo";
  // draft 是“候选任务”，还不是正式任务。真正写入由 PendingChange 接受动作完成。
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
  // PendingChange 把草稿交给 UI 审核队列，用户可以接受或拒绝。
  addPending({
    id: makeChangeId(),
    kind: "create",
    summary: `${draft.taskName} · ${dateLabel}${draft.dueTime ? " " + draft.dueTime : ""}`,
    draft,
  });
  return {
    ok: true,
    message: `Created a new-item draft: ${draft.taskName} (${dateLabel}). It was added to the review queue and will be saved only after the user accepts it.`,
    data: compactItem(draft),
  };
}

// ============================================================
// 2. update_item → PendingUpdate（不入库，待核实）
// ============================================================
function execUpdate(args: UpdateItemArgs, { getDdls, addPending }: ToolExecutorDeps): ToolResult {
  // 修改必须先定位目标。itemId 最可靠；taskNameFuzzy 只是上下文缺 id 时的降级匹配。
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

  // 只把模型明确传入的字段放进 patch。
  // undefined 表示“不修改”，null 则是有效值，例如 weight 可以被清空。
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

  // 保存 before + patch，方便 UI 展示差异，也方便用户拒绝时不影响原数据。
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

// ============================================================
// 3. delete_item → PendingDelete（不入库，待核实）
// ============================================================
function execDelete(args: DeleteItemArgs, { getDdls, addPending }: ToolExecutorDeps): ToolResult {
  // 删除同样必须先定位目标；找不到时提示模型先 list_items。
  const target = findItem(getDdls(), args.itemId, args.taskNameFuzzy);
  if (!target) {
    return {
      ok: false,
      message: `Could not find a matching task (itemId=${args.itemId}, taskNameFuzzy=${args.taskNameFuzzy})`,
    };
  }
  // 删除草稿保存 before，UI 可以让用户看清楚将删除哪一条。
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

// ============================================================
// 4. toggle_complete → 直接执行（用户高频低风险，不走核实）
// ============================================================
function execToggle(args: ToggleCompleteArgs, { getDdls, setDdls }: ToolExecutorDeps): ToolResult {
  // 完成/取消完成是可逆低风险动作，因此直接更新任务状态。
  const target = findItem(getDdls(), args.itemId, args.taskNameFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching task" };
  }
  // 如果模型没有显式给 completed，就按当前状态取反。
  const nextCompleted = args.completed !== undefined ? args.completed : !target.completed;
  setDdls((prev) => prev.map((it) => (it.id === target.id ? { ...it, completed: nextCompleted } : it)));
  return {
    ok: true,
    message: nextCompleted ? `Marked complete: ${target.taskName}` : `Marked incomplete: ${target.taskName}`,
    data: { id: target.id, completed: nextCompleted },
  };
}

// ============================================================
// 5. list_items → 直接执行（只读）
// ============================================================
function execList(args: ListItemsArgs, { getDdls }: ToolExecutorDeps): ToolResult {
  // list 是只读工具，主要给模型拿真实 itemId 和当前任务状态，防止它凭记忆编造。
  const all = getDdls();
  const filter = args.filter || "all";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = all.filter((d) => {
    if (filter === "all") return true;
    if (filter === "active") return !d.completed;
    if (filter === "completed") return d.completed;
    const due = new Date(d.dueDate);
    // diff 以本地日期零点为基准，符合用户在日历/任务列表里看到的“今天/本周”语义。
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

// ============================================================
// 6. create_note → PendingCreateNote（待核实，B2 跨面板联动）
// ============================================================
function execCreateNote(args: CreateNoteArgs, { addPending }: ToolExecutorDeps): ToolResult {
  // 笔记草稿至少需要标题和内容；空笔记没有进入审核队列的价值。
  if (!args.title || !args.content) {
    return { ok: false, message: "create_note needs title and content" };
  }
  const now = Date.now();
  // 标题截断到 60，避免模型生成长标题挤爆笔记列表 UI。
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

// ============================================================
// 7. list/update/delete note → 笔记工具
// ============================================================
function execListNotes(args: ListNotesArgs, { getNotes }: ToolExecutorDeps): ToolResult {
  // query 为空时返回全部笔记；否则在标题、正文、tags 上做简单包含搜索。
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
  // noteId 优先，titleFuzzy 只是没有 id 时的模糊定位兜底。
  const target = findNote(getNotes(), args.noteId, args.titleFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching note. Use list_notes first if the note ID is unknown." };
  }

  // 只更新模型明确给出的字段；title 额外截断，保护列表布局。
  const patch: Partial<Note> = {
    ...(args.title !== undefined ? { title: args.title.slice(0, 80) } : {}),
    ...(args.content !== undefined ? { content: args.content } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
  };
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "update_note needs at least one field to update." };
  }

  // 笔记 update 当前直接执行，不进入 PendingChange；updatedAt 用于排序/同步。
  const updated: Note = { ...target, ...patch, updatedAt: Date.now() };
  setNotes((prev) => prev.map((note) => (note.id === target.id ? updated : note)));
  return {
    ok: true,
    message: `Updated note: ${updated.title || "(untitled)"}.`,
    data: compactNote(updated),
  };
}

function execDeleteNote(args: DeleteNoteArgs, { getNotes, setNotes }: ToolExecutorDeps): ToolResult {
  // 删除前同样先定位，避免模糊标题误删。
  const target = findNote(getNotes(), args.noteId, args.titleFuzzy);
  if (!target) {
    return { ok: false, message: "Could not find a matching note. Use list_notes first if the note ID is unknown." };
  }

  // 当前笔记删除是直接执行；如未来需要更强安全性，可改造成 PendingChange。
  setNotes((prev) => prev.filter((note) => note.id !== target.id));
  return {
    ok: true,
    message: `Deleted note: ${target.title || "(untitled)"}.`,
    data: { id: target.id, title: target.title },
  };
}

// ============================================================
// 8. create_custom_panel → PendingCreateCustomPanel（[054] D.3）
// ============================================================
function execCreateCustomPanel(args: CreateCustomPanelArgs, { addPending }: ToolExecutorDeps): ToolResult {
  // 面板至少要有 label，其他字段根据 kind 决定是否必填。
  if (!args.label || !args.label.trim()) {
    return { ok: false, message: "create_custom_panel needs label" };
  }
  // kind 默认 markdown；iframe/modules 需要额外校验 url/modules。
  const kind: "markdown" | "iframe" | "modules" =
    args.kind === "iframe" ? "iframe" : args.kind === "modules" ? "modules" : "markdown";
  if (kind === "iframe" && (!args.url || !args.url.trim())) {
    return { ok: false, message: "kind=iframe needs url" };
  }
  if (kind === "modules" && (!args.modules || args.modules.length === 0)) {
    return { ok: false, message: "kind=modules needs at least one module" };
  }
  const now = Date.now();
  // [064] 给每个模组补 id（AI 不传 id）
  const modules =
    kind === "modules" && args.modules
      ? args.modules.map((m) => ({ id: "mod-" + uid(), type: m.type, title: m.title, config: m.config }))
      : undefined;
  const panelDraft: CustomPanel = {
    id: "custom-" + uid(),
    // label/emoji 都做短截断，避免模型生成过长文本破坏侧边栏/标签栏布局。
    label: args.label.slice(0, 12).trim() || "New panel",
    emoji: (args.emoji || "📋").slice(0, 3),
    content: args.content ?? "",
    kind,
    ...(kind === "iframe" && args.url ? { url: args.url.trim() } : {}),
    ...(modules ? { modules } : {}),
    createdAt: now,
    updatedAt: now,
  };
  // 自定义面板属于结构性 UI 变更，因此进入待核实队列。
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

// ============================================================
// 9. create_recurring_task → 直接建模板 + 立即生成当期（[079]）
// ============================================================
function execCreateRecurring(args: CreateRecurringTaskArgs, { addRecurring }: ToolExecutorDeps): ToolResult {
  // 周期任务至少需要名称和频率。
  if (!args.taskName || !args.taskName.trim()) {
    return { ok: false, message: "create_recurring_task needs taskName" };
  }
  if (args.cadence !== "daily" && args.cadence !== "weekly" && args.cadence !== "monthly") {
    return { ok: false, message: "cadence must be daily / weekly / monthly" };
  }
  if (!addRecurring) {
    return { ok: false, message: "Recurring task support is not ready" };
  }
  // timesPerPeriod 做 1..31 钳制，避免模型传入极端数字制造大量实例。
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
  // addRecurring 由 page.tsx 注入，内部负责保存模板并立即生成当前周期实例。
  addRecurring(routine);
  const freq = `${CADENCE_LABEL[args.cadence]}${times > 1 ? ` ${times} times` : ""}`;
  return {
    ok: true,
    message: `Created recurring task "${routine.taskName}" (${freq}) and generated the current-period instance in the task list. It will renew automatically each period.`,
    data: { id: routine.id, taskName: routine.taskName, cadence: routine.cadence, timesPerPeriod: times },
  };
}

// ============================================================
// helper
// ============================================================
function findItem(ddls: DdlItem[], itemId?: string, fuzzy?: string): DdlItem | null {
  // 精确 id 优先，避免同名/近似任务误匹配。
  if (itemId) {
    const exact = ddls.find((d) => d.id === itemId);
    if (exact) return exact;
  }
  // 模糊匹配只做包含判断；模型若拿不准，应先 list_items 让用户或上下文提供更明确 id。
  if (fuzzy) {
    const lower = fuzzy.toLowerCase().trim();
    return ddls.find((d) => d.taskName.toLowerCase().includes(lower)) || null;
  }
  return null;
}

function findNote(notes: Note[], noteId?: string, fuzzy?: string): Note | null {
  // 笔记同样先按 id 精确查找，再按标题包含匹配。
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
