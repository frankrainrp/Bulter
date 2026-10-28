// ============================================================
// lib/ai-tools.ts — DeepSeek tool calling 工具定义
// 设计原则：tasks 与 calendar 共享同一数据模型 (DdlItem)，
// AI 通过 5 个工具完成对全局 ddls 列表的 CRUD + 查询
// ============================================================

import type { DdlItem, TaskStatus, TaskPriority, PanelModuleType, PanelModuleConfig, RecurringCadence } from "./types";

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
        "为用户创建一个新的任务或日历事件。无论是「明天开会」「下周交作业」「期末考试」都用这个工具。" +
        "若用户没说具体时间，dueTime 默认 23:59。若用户没说权重（学术作业才有的概念），weight 传 null。",
      parameters: {
        type: "object",
        properties: {
          taskName: {
            type: "string",
            description: "任务/事件名称，例如「数据结构 Quiz」「与导师的开会」「Final Exam」",
          },
          dueDate: {
            type: "string",
            description: "ISO 8601 日期 YYYY-MM-DD。务必根据系统 prompt 提供的「当前日期」推算出绝对日期",
          },
          dueTime: {
            type: "string",
            description: "HH:MM (24h)，例如 09:00 / 14:30 / 23:59。未指定时填 23:59",
          },
          weight: {
            type: ["number", "null"],
            description: "学术作业的成绩权重百分比 0-100，非学术事件填 null",
          },
          description: {
            type: "string",
            description: "对该事项的简短补充说明，例如「Submit via Blackboard」「带笔记本」",
          },
          isGroupWork: {
            type: "boolean",
            description: "是否为小组协作事项",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
            description: "任务状态，默认 todo。仅在用户明确说「在做」「正在进行」时设 in_progress",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "自定义标签数组，例如 [\"C245\", \"期末\"]。空数组表示无标签",
          },
          priority: {
            type: "string",
            enum: ["low", "med", "high"],
            description: "优先级。用户明确说「重要」「紧急」时设 high；常规事项不传",
          },
          notes: {
            type: "string",
            description: "长备注（区别于简短 description），支持多行 Markdown",
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
        "修改一个已存在的任务/事件。优先用 itemId 精确定位；只有当 itemId 未知时才用 taskNameFuzzy 模糊匹配。" +
        "未提供的字段保持原值不变。",
      parameters: {
        type: "object",
        properties: {
          itemId: {
            type: "string",
            description: "目标 item 的精确 ID（通过 list_items 拿到）",
          },
          taskNameFuzzy: {
            type: "string",
            description: "找不到 itemId 时用任务名称模糊匹配（包含即可），例如「Quiz 2」",
          },
          taskName: { type: "string", description: "新名称（可选）" },
          dueDate: { type: "string", description: "新日期 YYYY-MM-DD（可选）" },
          dueTime: { type: "string", description: "新时间 HH:MM（可选）" },
          weight: { type: ["number", "null"], description: "新权重（可选）" },
          description: { type: "string", description: "新描述（可选）" },
          isGroupWork: { type: "boolean", description: "是否小组作业（可选）" },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
            description: "新状态（可选）。设 done 等同于完成",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "新标签数组（可选，会替换原有 tags）",
          },
          priority: {
            type: "string",
            enum: ["low", "med", "high"],
            description: "新优先级（可选）",
          },
          notes: { type: "string", description: "新长备注（可选）" },
        },
      },
    },
  },

  // ---- 3. 删除任务/事件 ----
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "删除一个任务/事件。优先用 itemId，否则 taskNameFuzzy。删除前请向用户确认。",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "目标 item 的精确 ID" },
          taskNameFuzzy: { type: "string", description: "找不到 itemId 时用名称模糊匹配" },
        },
      },
    },
  },

  // ---- 4. 切换完成状态 ----
  {
    type: "function",
    function: {
      name: "toggle_complete",
      description: "勾选一项任务为完成（或取消完成）。",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "目标 item 的精确 ID" },
          taskNameFuzzy: { type: "string", description: "找不到 itemId 时用名称模糊匹配" },
          completed: {
            type: "boolean",
            description: "true=标记完成；false=取消完成；不传则切换当前状态",
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
        "查询用户当前的所有任务/事件，返回结构化数据。" +
        "在执行 update/delete 前若不知道 itemId，应先调用此工具。" +
        "也可用于回答「我本周有什么任务」这类查询。",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "today", "thisWeek", "later", "completed", "active"],
            description: "过滤器：all=全部；active=未完成；其他按时间窗口或状态",
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
        "把一段内容存为笔记到 Notes 面板。适用场景：用户说「帮我记一条笔记」「把这段话存下来」" +
        "「整理成笔记」「写一份关于 X 的笔记」。content 支持 Markdown，可包含标题、列表、代码块。" +
        "走待核实流程（用户接受后才入 Notes 表）。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "笔记标题，5-20 个汉字。若用户没明确说，从 content 概括",
          },
          content: {
            type: "string",
            description: "笔记正文 Markdown。建议结构化：可用 #/##、-、**bold**、`code`",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "自定义标签数组，例如 [\"数据结构\", \"复习\"]。空数组表示无标签",
          },
        },
        required: ["title", "content"],
      },
    },
  },

  // ---- 7. 创建自定义面板（[054] Phase E 扩展，D.3）----
  {
    type: "function",
    function: {
      name: "create_custom_panel",
      description:
        "在顶栏 4 内置 Tab 后新建一个自定义面板（用户的自留地）。适用场景：" +
        "「帮我建一个面板叫 X」「新开一个 Tab 放 Y」「做一个嵌入 X 网页的面板」「给我做一个 XX 看板/仪表盘」。" +
        "kind=markdown 用于内容笔记；kind=iframe 用于嵌入网站；" +
        "**kind=modules 用于数据仪表盘**——把若干模组组合成看板（图表/统计/清单），" +
        "模组会自动绑定用户真实的任务/笔记/连续天数数据。用户说「做个学习仪表盘/进度看板/统计面板」时优先用 modules。" +
        "走待核实流程，用户接受后才出现在顶栏。",
      parameters: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Tab 显示名，2-12 个汉字。例如「读书清单」「学习看板」「期末复习」",
          },
          emoji: {
            type: "string",
            description: "Tab 前缀单字符 emoji，例如 📚 / 📊 / 📝 / 🎯。不传默认 📋",
          },
          kind: {
            type: "string",
            enum: ["markdown", "iframe", "modules"],
            description: "面板类型：markdown=Markdown 文档；iframe=嵌入网页；modules=数据仪表盘（组合图表/统计模组）。不传默认 markdown",
          },
          content: {
            type: "string",
            description: "kind=markdown 时的初始 Markdown 内容；可不传留空",
          },
          url: {
            type: "string",
            description: "kind=iframe 时的网址（http/https）。kind 不是 iframe 时忽略",
          },
          modules: {
            type: "array",
            description:
              "kind=modules 时的模组列表，按需组合成仪表盘（顺序即显示顺序）。" +
              "数据可视化与统计会自动用用户真实数据。例如做学习看板可组合：" +
              "[待办统计卡, 最近 DDL 倒计时, 任务状态饼图, 近 7 日到期柱状图, 任务热力图, 进行中清单]。",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["stat", "countdown", "tasklist", "pie", "bar", "heatmap"],
                  description:
                    "stat=大数字统计卡；countdown=DDL 倒计时；tasklist=任务清单；pie=饼图；bar=柱状图；heatmap=任务热力图",
                },
                title: { type: "string", description: "模组标题，简短中文" },
                config: {
                  type: "object",
                  description: "模组配置（按类型选填）",
                  properties: {
                    metric: {
                      type: "string",
                      enum: [
                        "tasks-total", "tasks-done", "tasks-active", "tasks-today",
                        "notes-total", "streak-current", "streak-longest",
                        "completion-7d", "tasks-by-status", "tasks-by-source",
                      ],
                      description:
                        "绑定真实数据指标。stat 用单值类（tasks-active/streak-current 等）；" +
                        "pie/bar 用系列类（tasks-by-status/tasks-by-source/completion-7d）。",
                    },
                    filter: {
                      type: "string",
                      enum: ["active", "today", "upcoming", "completed", "all"],
                      description: "tasklist 的筛选范围",
                    },
                    targetDate: { type: "string", description: "countdown 目标日期 YYYY-MM-DD；不传=最近未完成 DDL" },
                    unit: { type: "string", description: "stat 卡单位，如「个」「天」" },
                    limit: { type: "number", description: "tasklist 最多显示条数（默认 6）" },
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
        "创建一个会自动重复的周期任务/习惯。每到新周期，管家自动把它生成成具体任务加入清单。" +
        "适用场景：「每周去健身房 4 次」「每天背单词」「每月 1 号交房租」「每周写周报」。" +
        "和 create_item 的区别：create_item 是一次性的；这个是周期性、自动续期的。" +
        "创建后会立即生成「当前周期」的实例。",
      parameters: {
        type: "object",
        properties: {
          taskName: { type: "string", description: "任务名，例如「去健身房」「背单词」「交房租」" },
          cadence: {
            type: "string",
            enum: ["daily", "weekly", "monthly"],
            description: "周期：daily=每天 / weekly=每周 / monthly=每月",
          },
          timesPerPeriod: {
            type: "number",
            description: "每个周期生成几次（如每周去健身房 4 次 → 4）。默认 1",
          },
          dueTime: { type: "string", description: "HH:MM，默认 23:59" },
          description: { type: "string", description: "可选补充说明" },
          tags: { type: "array", items: { type: "string" }, description: "可选标签" },
          emoji: { type: "string", description: "可选单字符 emoji，如 🏋️ / 📖 / 💰" },
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
