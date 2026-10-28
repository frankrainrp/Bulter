// ============================================================
// lib/types.ts — 前端共享类型（与 packages/ai-core 的 Zod Schema 对齐）
// ============================================================

export type NavId = "chat" | "tasks" | "calendar" | "notes";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  file?: File; // 真实 File 对象，客户端 only，不序列化
}

export type PipelineStepStatus = "pending" | "running" | "success" | "failed";

export interface PipelineStep {
  id: "ocr" | "extract" | "calendar" | "persist";
  label: string;
  status: PipelineStepStatus;
  detail?: string;
}

export interface ProcessingPipeline {
  id: string;
  file: UploadedFile;
  steps: PipelineStep[];
  status: "running" | "completed" | "failed";
  startedAt: number;
  finishedAt?: number;
  extractedCount?: number;
}

export type AttachmentKind = "url" | "filepath" | "blob";

export interface DdlAttachment {
  id: string;
  kind: AttachmentKind;
  label: string;       // 显示名（默认取 URL host / 文件名）
  ref: string;         // url / 本地路径 / blob id
  mime?: string;       // blob 类型
  size?: number;       // blob 字节数
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "med" | "high";

export interface DdlItem {
  id: string;
  taskName: string;
  weight: number | null;
  dueDate: string; // YYYY-MM-DD 或空串表示"待定"
  dueTime: string; // HH:MM
  description: string;
  isGroupWork: boolean;
  source: string;
  completed: boolean;                   // 保留兼容；status="done" 时同步为 true
  notes?: string;                       // 长备注
  attachments?: DdlAttachment[];        // 附件列表
  // v4 新增（C.2）
  status?: TaskStatus;                  // todo / in_progress / done（v4 起填充）
  tags?: string[];                      // 自定义标签
  priority?: TaskPriority;              // low / med / high
  // v5+ 跨面板联动（B1）
  noteId?: string;                      // 关联笔记 id（一对一,反向 Note.taskIds 通过 ddls 反查）
  // [079] 周期任务：标记此实例由哪个 RecurringTask 模板自动生成
  recurringId?: string;
}

// ============================================================
// [079] 周期任务（重复任务模板）
// 每到新周期自动生成实例到 ddls，如「每周去健身房 4 次」。
// ============================================================
export type RecurringCadence = "daily" | "weekly" | "monthly";

export interface RecurringTask {
  id: string;
  taskName: string;
  cadence: RecurringCadence;
  /** 每周期生成几个实例（如每周 4 次健身）*/
  timesPerPeriod: number;
  dueTime: string;            // HH:MM
  weight?: number | null;
  description?: string;
  tags?: string[];
  emoji?: string;            // 列表展示用
  active: boolean;
  createdAt: number;
  /** 上次已生成到的周期 key（防重复）；首次为空，立即生成当期 */
  lastGeneratedPeriod?: string;
}

// Dexie blobs 表记录形态
export interface StoredBlob {
  id: string;
  data: Blob;
  mime: string;
  name: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;                      // 所属会话（v3 起必填）
  role: "user" | "assistant" | "pipeline" | "confirm";
  content: string;
  files?: UploadedFile[];
  pipelineId?: string;
  /** role=confirm 时关联的 PendingBatch id */
  confirmBatchId?: string;
  /** V4 思考模式产生的推理过程（CoT），仅 assistant 可能有 */
  reasoning?: string;
  /** 标记此条 assistant 是错误消息（来自 onError 兜底），UI 显示 retry 按钮 */
  isError?: boolean;
  timestamp: Date;
}

// 多会话：每个 ChatSession 持有一组独立的消息流
// 任务/日历/笔记数据全局共享，不绑定 session（见 [[project_product_definition]]）
export interface ChatSession {
  id: string;
  title: string;        // "新对话" → 首条用户消息后自动取前 24 字
  createdAt: number;
  updatedAt: number;    // 用于列表排序
}

// 笔记（浏览器内简易 Markdown 版，Dexie v5 起）
// Phase 3 接 Tauri 后，会迁移到本地 Obsidian Vault（用 path 字段标记同步状态）
export interface Note {
  id: string;
  title: string;
  /** Markdown 内容 */
  content: string;
  /** 自定义标签 */
  tags?: string[];
  /** 是否置顶 */
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Phase 3 同步本地 Vault 时填，当前留空 */
  vaultPath?: string;
  /** B4 已自动同步到 Tasks 的 todo 文本（去重防止重复创建任务） */
  syncedTodos?: string[];
}

// 用户自定义管家形象（[050] Phase C，Dexie v6 起）
// poseName="default" 表示替换全部 7 内置姿势；后续可支持具体 pose name 单独覆盖
export interface ButlerAsset {
  poseName: string;     // "default" | "standing" | "serving" | ...
  blob: Blob;           // 已 trim 透明 PNG
  width: number;        // trim 后真实宽度
  height: number;       // trim 后真实高度
  updatedAt: number;
}

// 壁纸（[066]，Dexie v8 起）：root 背景可替换为图片或视频，浮在玻璃胶囊后
export interface Wallpaper {
  id: string;              // 固定 "current"
  kind: "image" | "video";
  blob: Blob;              // 原始图片/视频二进制
  updatedAt: number;
}

// 用户自定义面板（[052] Phase E，Dexie v7 起；[054] D.2 加 kind/url 支持 iframe）
// 出现在 Tab Bar 内置 4 Tab 后
// [064] 模组系统：kind=modules → 面板由一摞 PanelModule 组合（AI 可调用拼装 / 用户手动加）
export type CustomPanelKind = "markdown" | "iframe" | "modules" | "generated";
export interface CustomPanel {
  id: string;          // "custom-{nanoid}"
  label: string;       // Tab 显示名（≤12 字符）
  emoji: string;       // Tab 前缀单字符 emoji
  content: string;     // Markdown body（kind=markdown 时用）
  createdAt: number;
  updatedAt: number;
  /** [054] D.2：面板类型；缺省 = markdown（兼容 [052] 历史数据）*/
  kind?: CustomPanelKind;
  /** [054] D.2：嵌入网页 URL（kind=iframe 时用）*/
  url?: string;
  /** [064] kind=modules 时的模组列表（按顺序竖排渲染）*/
  modules?: PanelModule[];
  /** [073] kind=generated 时的声明式面板 schema（数据源 + 组件块）*/
  spec?: import("./panel-schema").GeneratedPanelSpec;
}

// ============================================================
// [064] 面板模组系统
// ============================================================
export type PanelModuleType =
  | "stat"      // 统计大数字卡（Butler 数据绑定）
  | "countdown" // DDL 倒计时（绑定最近截止 / 指定日期）
  | "tasklist"  // 任务清单（按筛选）
  | "pie"       // 饼图
  | "bar"       // 柱状图
  | "heatmap";  // 活动热力图（绑定每日完成数）

/** 绑定到 Butler 真实数据的指标 key（resolve 时从 ddls/notes/streak 算）*/
export type PanelMetric =
  | "tasks-total" | "tasks-done" | "tasks-active" | "tasks-today"
  | "notes-total" | "streak-current" | "streak-longest"
  | "completion-7d"       // 近 7 日每日完成数（series）
  | "tasks-by-status"     // 按状态分布（series）
  | "tasks-by-source";    // 按来源分布（series）

export interface PanelModuleConfig {
  /** 绑定指标（stat/pie/bar/heatmap 用；填了走 live 数据）*/
  metric?: PanelMetric;
  /** 静态数据（不绑定时用；pie/bar 的数据系列）*/
  data?: { label: string; value: number }[];
  /** stat 卡单位（如「个」「天」）*/
  unit?: string;
  /** countdown 目标日期 YYYY-MM-DD（缺省=最近 DDL）*/
  targetDate?: string;
  /** tasklist 筛选 */
  filter?: "active" | "today" | "upcoming" | "completed" | "all";
  /** tasklist 上限 */
  limit?: number;
}

export interface PanelModule {
  id: string;
  type: PanelModuleType;
  /** 模组标题（可选，显示在模组顶部）*/
  title?: string;
  config?: PanelModuleConfig;
}
