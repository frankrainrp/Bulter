// ============================================================
// lib/ai-tools.ts — DeepSeek tool calling 工具定义
// 设计原则：tasks 与 calendar 共享同一数据模型 (DdlItem)，
// AI 通过 5 个工具完成对全局 ddls 列表的 CRUD + 查询
// ============================================================

import type { DdlItem, Note, TaskStatus, TaskPriority, PanelModuleType, PanelModuleConfig, RecurringCadence } from "./types";

// OpenAI / DeepSeek tool 定义格式
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const TOOLS: ToolDefinition[] = [
  // ---- 1. 创建任务/事件 ----
  {
    type: "function",
    function: {
      name: "create_item",
      description:
        "Create a new task or calendar event for the user. Use this for requests like tomorrow's meeting, next week's assignment, or final exam." +
        "If no specific time is provided, default dueTime to 23:59. If no academic weight is provided, pass weight as null.",
      parameters: {
        type: "object",
        properties: {
          taskName: {
            type: "string",
            description: "Task or event name, e.g. \"Data Structures Quiz\", \"Advisor meeting\", or \"Final Exam\"",
          },
          dueDate: {
            type: "string",
            description: "ISO 8601 date in YYYY-MM-DD. Infer an absolute date from the current date in the system prompt.",
          },
          dueTime: {
            type: "string",
            description: "HH:MM in 24-hour time, e.g. 09:00 / 14:30 / 23:59. Use 23:59 when unspecified.",
          },
          weight: {
            type: ["number", "null"],
            description: "Academic grade weight from 0 to 100. Use null for non-academic events.",
          },
          description: {
            type: "string",
            description: "Short supporting detail, e.g. \"Submit via Blackboard\" or \"bring laptop\".",
          },
          isGroupWork: {
            type: "boolean",
            description: "Whether this is group work.",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
            description: "Task status. Default to todo; use in_progress only when the user clearly says it is in progress.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Custom tag array, e.g. [\"C245\", \"final\"]. Use an empty array for no tags.",
          },
          priority: {
            type: "string",
            enum: ["low", "med", "high"],
            description: "Priority. Use high when the user clearly says important or urgent; omit for ordinary items.",
          },
          notes: {
            type: "string",
            description: "Long notes, separate from short description. Supports multiline Markdown.",
          },
        },
        required: ["taskName", "dueDate"],
      },
    },
  },

  // ---- 2. 更新任务/事件 ----
  {
    type: "function",
    function: {
      name: "update_item",
      description:
        "Update an existing task or event. Prefer itemId for exact targeting; use taskNameFuzzy only when itemId is unknown." +
        "Fields that are not provided remain unchanged.",
      parameters: {
        type: "object",
        properties: {
          itemId: {
            type: "string",
            description: "Exact target item ID from list_items.",
          },
          taskNameFuzzy: {
            type: "string",
            description: "Fallback fuzzy match against the task name when itemId is unavailable, e.g. \"Quiz 2\".",
          },
          taskName: { type: "string", description: "New name, optional." },
          dueDate: { type: "string", description: "New date YYYY-MM-DD, optional." },
          dueTime: { type: "string", description: "New time HH:MM, optional." },
          weight: { type: ["number", "null"], description: "New weight, optional." },
          description: { type: "string", description: "New description, optional." },
          isGroupWork: { type: "boolean", description: "Whether this is group work, optional." },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
            description: "New status, optional. Setting done marks it complete.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "New tag array, optional. Replaces existing tags.",
          },
          priority: {
            type: "string",
            enum: ["low", "med", "high"],
            description: "New priority, optional.",
          },
          notes: { type: "string", description: "New long notes, optional." },
        },
      },
    },
  },

  // ---- 3. 删除任务/事件 ----
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "Delete a task or event. Prefer itemId, otherwise use taskNameFuzzy. Confirm with the user before deleting.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Exact target item ID." },
          taskNameFuzzy: { type: "string", description: "Fallback fuzzy match by name when itemId is unavailable." },
        },
      },
    },
  },

  // ---- 4. 切换完成状态 ----
  {
    type: "function",
    function: {
      name: "toggle_complete",
      description: "Mark a task complete, or undo completion.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Exact target item ID." },
          taskNameFuzzy: { type: "string", description: "Fallback fuzzy match by name when itemId is unavailable." },
          completed: {
            type: "boolean",
            description: "true marks complete; false clears completion; omit to toggle current state.",
          },
        },
      },
    },
  },

  // ---- 5. 查询任务列表 ----
  {
    type: "function",
    function: {
      name: "list_items",
      description:
        "List the user's current tasks and events as structured data." +
        "Call this before update/delete when itemId is unknown." +
        "Also use this to answer queries such as what tasks are due this week.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "today", "thisWeek", "later", "completed", "active"],
            description: "Filter: all=everything; active=unfinished; other values filter by time window or status.",
          },
        },
      },
    },
  },

  // ---- 6. 创建笔记（B2 跨面板联动） ----
  {
    type: "function",
    function: {
      name: "create_note",
      description:
        "Create a Markdown note draft in the Notes panel. Use this when the user asks to save, summarize, or organize content as a note. " +
        "The draft goes through confirmation before it is added to Notes.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Note title, ideally 5-20 English words. Summarize from content if the user did not specify one.",
          },
          content: {
            type: "string",
            description: "Markdown note body. Prefer structure with #/## headings, bullets, bold text, and code spans.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Custom tag array, e.g. [\"data-structures\", \"review\"]. Use an empty array for no tags.",
          },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List current notes. Use this before answering, updating, or deleting notes when noteId is unknown.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional case-insensitive search text for title, content, or tags.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description: "Update an existing note. Use noteId when available, otherwise use titleFuzzy.",
      parameters: {
        type: "object",
        properties: {
          noteId: { type: "string", description: "Exact note ID from list_notes." },
          titleFuzzy: { type: "string", description: "Fallback fuzzy match against note title." },
          title: { type: "string", description: "New note title." },
          content: { type: "string", description: "New Markdown body." },
          tags: { type: "array", items: { type: "string" }, description: "Replacement tag list." },
          pinned: { type: "boolean", description: "Whether the note should be pinned." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Delete an existing note. Use noteId when available, otherwise use titleFuzzy.",
      parameters: {
        type: "object",
        properties: {
          noteId: { type: "string", description: "Exact note ID from list_notes." },
          titleFuzzy: { type: "string", description: "Fallback fuzzy match against note title." },
        },
      },
    },
  },

  // ---- 7. 创建自定义面板（[054] Phase E 扩展，D.3）----
  {
    type: "function",
    function: {
      name: "create_custom_panel",
      description:
        "Create a custom panel after the four built-in top tabs. Use this for:" +
        "requests such as creating a panel named X, opening a new tab for Y, embedding a website, or building a dashboard." +
        "kind=markdown is for written content; kind=iframe is for embedded websites;" +
        "**kind=modules is for data dashboards** made from chart, statistic, and list modules." +
        "Modules automatically bind to real task, note, and streak data. Prefer modules for study dashboards, progress boards, or stats panels." +
        "The panel goes through review and appears in the top bar only after the user accepts it.",
      parameters: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Tab label, 2-24 characters, e.g. \"Reading List\", \"Study Board\", or \"Final Review\".",
          },
          emoji: {
            type: "string",
            description: "Single emoji prefix for the tab, e.g. 📚 / 📊 / 📝 / 🎯. Defaults to 📋.",
          },
          kind: {
            type: "string",
            enum: ["markdown", "iframe", "modules"],
            description: "Panel type: markdown=Markdown document; iframe=embedded website; modules=data dashboard. Defaults to markdown.",
          },
          content: {
            type: "string",
            description: "Initial Markdown content for kind=markdown; may be omitted.",
          },
          url: {
            type: "string",
            description: "URL for kind=iframe, http or https. Ignored for other kinds.",
          },
          modules: {
            type: "array",
            description:
              "Module list for kind=modules. Combine modules as needed; order is display order." +
              "Visualizations and stats bind to the user's real data. A study board can combine:" +
              "[active-task stat, nearest-deadline countdown, task-status pie chart, 7-day due bar chart, task heatmap, in-progress list].",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["stat", "countdown", "tasklist", "pie", "bar", "heatmap"],
                  description:
                    "stat=large-number KPI; countdown=deadline countdown; tasklist=task list; pie=pie chart; bar=bar chart; heatmap=task heatmap.",
                },
                title: { type: "string", description: "Short module title." },
                config: {
                  type: "object",
                  description: "Module config, depending on type.",
                  properties: {
                    metric: {
                      type: "string",
                      enum: [
                        "tasks-total", "tasks-done", "tasks-active", "tasks-today",
                        "notes-total", "streak-current", "streak-longest",
                        "completion-7d", "tasks-by-status", "tasks-by-source",
                      ],
                      description:
                        "Bind to a real data metric. stat uses single-value metrics such as tasks-active or streak-current;" +
                        "pie/bar use series metrics such as tasks-by-status, tasks-by-source, or completion-7d.",
                    },
                    filter: {
                      type: "string",
                      enum: ["active", "today", "upcoming", "completed", "all"],
                      description: "Filter range for tasklist.",
                    },
                    targetDate: { type: "string", description: "Target date YYYY-MM-DD for countdown; omit for the nearest unfinished deadline." },
                    unit: { type: "string", description: "Unit label for stat cards, e.g. \"items\" or \"days\"." },
                    limit: { type: "number", description: "Maximum items to show in tasklist. Defaults to 6." },
                  },
                },
              },
              required: ["type"],
            },
          },
        },
        required: ["label"],
      },
    },
  },

  // ---- 8. 创建周期任务（[079] 重复任务模板）----
  {
    type: "function",
    function: {
      name: "create_recurring_task",
      description:
        "Create a recurring task or habit. Each new period automatically materializes concrete task instances." +
        "Use for habits such as gym four times a week, daily vocabulary, monthly rent, or weekly reports." +
        "Unlike create_item, this creates a periodic template that renews automatically." +
        "It immediately creates the instance for the current period.",
      parameters: {
        type: "object",
        properties: {
          taskName: { type: "string", description: "Task name, e.g. \"Go to the gym\", \"Study vocabulary\", or \"Pay rent\"." },
          cadence: {
            type: "string",
            enum: ["daily", "weekly", "monthly"],
            description: "Cadence: daily / weekly / monthly.",
          },
          timesPerPeriod: {
            type: "number",
            description: "Instances per period, e.g. gym four times per week means 4. Defaults to 1.",
          },
          dueTime: { type: "string", description: "HH:MM, default 23:59." },
          description: { type: "string", description: "Optional supporting description." },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags." },
          emoji: { type: "string", description: "Optional single emoji, e.g. 🏋️ / 📖 / 💰." },
        },
        required: ["taskName", "cadence"],
      },
    },
  },
];

// ============================================================
// Tool 执行结果类型
// ============================================================
export type ToolResult =
  | { ok: true; message: string; data?: unknown }
  | { ok: false; message: string };

// ============================================================
// 工具执行参数类型（与 schema 对应）
// ============================================================
export interface CreateItemArgs {
  taskName: string;
  dueDate: string;
  dueTime?: string;
  weight?: number | null;
  description?: string;
  isGroupWork?: boolean;
  status?: TaskStatus;
  tags?: string[];
  priority?: TaskPriority;
  notes?: string;
}

export interface UpdateItemArgs {
  itemId?: string;
  taskNameFuzzy?: string;
  taskName?: string;
  dueDate?: string;
  dueTime?: string;
  weight?: number | null;
  description?: string;
  isGroupWork?: boolean;
  status?: TaskStatus;
  tags?: string[];
  priority?: TaskPriority;
  notes?: string;
}

export interface DeleteItemArgs {
  itemId?: string;
  taskNameFuzzy?: string;
}

export interface ToggleCompleteArgs {
  itemId?: string;
  taskNameFuzzy?: string;
  completed?: boolean;
}

export interface ListItemsArgs {
  filter?: "all" | "today" | "thisWeek" | "later" | "completed" | "active";
}

export interface CreateNoteArgs {
  title: string;
  content: string;
  tags?: string[];
}

export interface ListNotesArgs {
  query?: string;
}

export interface UpdateNoteArgs {
  noteId?: string;
  titleFuzzy?: string;
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
}

export interface DeleteNoteArgs {
  noteId?: string;
  titleFuzzy?: string;
}

export interface CreateCustomPanelArgs {
  label: string;
  emoji?: string;
  kind?: "markdown" | "iframe" | "modules";
  content?: string;
  url?: string;
  /** [064] kind=modules 时的模组规格（AI 不传 id，executor 补）*/
  modules?: { type: PanelModuleType; title?: string; config?: PanelModuleConfig }[];
}

export interface CreateRecurringTaskArgs {
  taskName: string;
  cadence: RecurringCadence;
  timesPerPeriod?: number;
  dueTime?: string;
  description?: string;
  tags?: string[];
  emoji?: string;
}

// 工具名 → 参数类型 的联合（供执行器使用）
export type ToolCall =
  | { name: "create_item";           args: CreateItemArgs }
  | { name: "update_item";           args: UpdateItemArgs }
  | { name: "delete_item";           args: DeleteItemArgs }
  | { name: "toggle_complete";       args: ToggleCompleteArgs }
  | { name: "list_items";            args: ListItemsArgs }
  | { name: "create_note";           args: CreateNoteArgs }
  | { name: "list_notes";            args: ListNotesArgs }
  | { name: "update_note";           args: UpdateNoteArgs }
  | { name: "delete_note";           args: DeleteNoteArgs }
  | { name: "create_custom_panel";   args: CreateCustomPanelArgs }
  | { name: "create_recurring_task"; args: CreateRecurringTaskArgs };

// ============================================================
// Helper：精简的 DdlItem（用于回传给 AI 看上下文，不要给完整 source）
// ============================================================
export function compactItem(item: DdlItem): Record<string, unknown> {
  return {
    id: item.id,
    taskName: item.taskName,
    dueDate: item.dueDate,
    dueTime: item.dueTime,
    weight: item.weight,
    description: item.description,
    isGroupWork: item.isGroupWork,
    completed: item.completed,
  };
}

export function compactNote(note: Note): Record<string, unknown> {
  return {
    id: note.id,
    title: note.title,
    preview: note.content.replace(/\s+/g, " ").slice(0, 240),
    tags: note.tags ?? [],
    pinned: note.pinned ?? false,
    updatedAt: note.updatedAt,
  };
}
