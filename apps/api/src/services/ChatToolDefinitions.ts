// 这里定义的是会传给 DeepSeek/OpenAI-compatible Chat Completions API 的 tools schema。
// 模型只能“提出”这些函数调用，真正执行在前端 apps/web/src/lib/tool-executor.ts。
// 因此本文件是 AI 能力边界的第一层：字段越清晰，模型越容易给出可执行、可校验的参数。
export const ChatTools = [
  // create_item：从自然语言中抽取一个任务/日程草稿。
  // 后续执行器不会直接写入正式 DDL，而是放入 PendingChange，等待用户确认。
  {
    type: "function",
    function: {
      name: "create_item",
      description: "Create a new task or calendar item. Use this for assignments, exams, meetings, and deadlines.",
      parameters: {
        type: "object",
        properties: {
          taskName: { type: "string" },
          dueDate: { type: "string", description: "YYYY-MM-DD or empty string when unknown." },
          dueTime: { type: "string", description: "HH:MM. Default to 23:59 when not specified." },
          weight: { type: ["number", "null"] },
          description: { type: "string" },
          isGroupWork: { type: "boolean" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["low", "med", "high"] },
          notes: { type: "string" },
        },
        required: ["taskName", "dueDate"],
      },
    },
  },
  // update_item：修改已有任务。
  // 模型应该优先使用 itemId；如果当前上下文没有 id，先 list_items 再用 taskNameFuzzy 辅助定位。
  {
    type: "function",
    function: {
      name: "update_item",
      description: "Update an existing task. Use itemId when available, otherwise use taskNameFuzzy.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          taskNameFuzzy: { type: "string" },
          taskName: { type: "string" },
          dueDate: { type: "string" },
          dueTime: { type: "string" },
          weight: { type: ["number", "null"] },
          description: { type: "string" },
          isGroupWork: { type: "boolean" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["low", "med", "high"] },
          notes: { type: "string" },
        },
      },
    },
  },
  // delete_item：删除已有任务。
  // 删除属于高风险操作，执行器会生成待核实草稿，而不是立刻从任务列表移除。
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "Delete a task. Use itemId when available, otherwise use taskNameFuzzy.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          taskNameFuzzy: { type: "string" },
        },
      },
    },
  },
  // toggle_complete：切换任务完成状态。
  // 这是高频、低风险操作，所以执行器会直接更新本地状态，不走 PendingChange。
  {
    type: "function",
    function: {
      name: "toggle_complete",
      description: "Mark a task complete or incomplete.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          taskNameFuzzy: { type: "string" },
          completed: { type: "boolean" },
        },
      },
    },
  },
  // list_items：只读查询当前任务列表。
  // 模型在回答“有哪些任务”、或者更新/删除前缺少 itemId 时应该先调用它。
  {
    type: "function",
    function: {
      name: "list_items",
      description: "List current user tasks before answering, updating, or deleting when needed.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "today", "thisWeek", "later", "completed", "active"] },
        },
      },
    },
  },
  // create_note：生成一条笔记草稿。
  // title/content 是最小可用字段；tags 可帮助后续检索和归档。
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a markdown note draft.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "content"],
      },
    },
  },
  // list_notes：只读检索笔记。
  // query 是宽松搜索词，执行器会在 title/content/tags 中做包含匹配。
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List current notes before answering, updating, or deleting when needed.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional title/content/tag search text." },
        },
      },
    },
  },
  // update_note：修改已有笔记。
  // 与 update_item 类似，优先 noteId；不知道 id 时先 list_notes 再用 titleFuzzy。
  {
    type: "function",
    function: {
      name: "update_note",
      description: "Update an existing note. Use noteId when available, otherwise use titleFuzzy.",
      parameters: {
        type: "object",
        properties: {
          noteId: { type: "string" },
          titleFuzzy: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
      },
    },
  },
  // delete_note：删除已有笔记。
  // 当前执行器会直接删除本地 note 状态，因此模型必须先确认目标足够明确。
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Delete an existing note. Use noteId when available, otherwise use titleFuzzy.",
      parameters: {
        type: "object",
        properties: {
          noteId: { type: "string" },
          titleFuzzy: { type: "string" },
        },
      },
    },
  },
  // create_custom_panel：创建自定义面板/仪表盘草稿。
  // kind=modules 时 modules 可承载统计卡、倒计时、图表、任务列表等动态组件配置。
  {
    type: "function",
    function: {
      name: "create_custom_panel",
      description: "Create a custom dashboard or panel draft.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          emoji: { type: "string" },
          kind: { type: "string", enum: ["markdown", "iframe", "modules"] },
          content: { type: "string" },
          url: { type: "string" },
          modules: { type: "array", items: { type: "object" } },
        },
        required: ["label"],
      },
    },
  },
  // create_recurring_task：创建周期任务模板。
  // cadence 控制日/周/月周期；timesPerPeriod 用于一周期多次的习惯或重复作业。
  {
    type: "function",
    function: {
      name: "create_recurring_task",
      description: "Create a recurring task template.",
      parameters: {
        type: "object",
        properties: {
          taskName: { type: "string" },
          cadence: { type: "string", enum: ["daily", "weekly", "monthly"] },
          timesPerPeriod: { type: "number" },
          dueTime: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          emoji: { type: "string" },
        },
        required: ["taskName", "cadence"],
      },
    },
  },
] as const;
