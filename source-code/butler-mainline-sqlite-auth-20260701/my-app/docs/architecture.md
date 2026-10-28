# 🏗️ Architecture

> Butler 的产品定位 + 4 面板信息架构 + 完整代码地图 + 核心数据模型 + 关键技术决策。

---

## 1. 产品定位

### 4 个面板

```
┌─[56px TopBar: Logo + 4 Tab + ⌘K 全局搜索 + Apps 图标 + 用户菜单(含偏好设置)]┐
├─[200px LeftRail]┬──────[Main Canvas]──────────────────────────────────┤
│  随 Tab 切内容  │  ┌──────────────────────────────────────────────┐ │
│  迷你月历(Cal) │  │ ChatCanvas(管家居中贴底 0.33;气泡左对齐;欢迎屏含 TodayHero+DropHero) │
│  + New Xxx 主btn │  │ TasksPanel(Linear + view + Deadline 紧急度色彩 + tag chip + 高亮闪烁) │
│  Views/Tags 等    │  │ CalendarPanel(月/Day/Week 三视图 + Week 点空格创建 + 事件拖拽改时间) │
│                  │  │ NotesPanel(双栏 + 关联任务条 + checkbox 自动同步 Tasks)        │
└──────────────────┴───────────────────────────────────────────────────┘
                              │
        + TopBar 搜索 → GlobalSearch(分组下拉 + 跳转 2s 黄色闪烁高亮)
        + ⚏ 图标 → MiniAppsDrawer(FocusTimer↔Task / StatsApp / ShareCard)
        + 编辑任务 → TaskDetailDrawer(状态/标签/优先级/附件/关联笔记/4 模板)
        + 备注 chip → NotesPreview(markdown modal)
        + ? 键 → KeyboardShortcutsHelp(快捷键 modal)
        + 用户菜单 → PreferencesPanel(亮/暗 + 字号 + 管家性格 3 档)
        + 首次访问 → OnboardingTour(5 步 + localStorage 防重复)
        + 全局 Toast(顶右 stack,4 档 + Undo action 5s)
```

### 核心心智

> "AI 是创造者，三个面板（任务/日历/笔记）是用户实际居住的产物。"

任何 UI / 信息架构决策围绕这个心智展开。对话框不是终态，是手段。

### 目标用户优先级

学生 B2C 优先 → 高校机构 B2B 推迟（用户原话）。

---

## 2. 完整代码地图

```
my-app/
├── AGENT.md                ← 入口简报
├── PROGRESS.md             ← 最近 5 条
├── docs/                   ← 详细文档（本文件、workflow / setup / pitfalls / plans）
│   ├── architecture.md     ← (this file)
│   ├── workflow.md
│   ├── setup.md
│   ├── pitfalls.md
│   ├── plans/
│   │   ├── ui-redesign.md  ← UI 重构存档
│   │   └── animation.md    ← Live2D/Rive 计划
│   └── progress/
│       ├── INDEX.md
│       └── 2026-05.md
├── apps/web/
│   ├── .env.local          ← DEEPSEEK_API_KEY（不提交）
│   ├── next.config.js      ← webpack alias（transformers.js 特殊处理）
│   ├── public/assets/      ← 4 张人物 PNG（已 trim 透明边）
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           ← Inter 字体，Clerk 解耦
│       │   ├── page.tsx             ← ★ 顶层状态机（详见 §3）
│       │   ├── globals.css          ← 设计 token（墨绿）+ .message-stream 滚动条
│       │   └── api/
│       │       ├── chat/route.ts          ← V4 模型 + thinking 透传 + 5 个 tool + 白名单
│       │       ├── extract-ddls/route.ts  ← V4 Flash tool_choice 强制提取
│       │       └── ocr/route.ts           ← ★ Mistral OCR 服务端代理（FormData→Mistral）
│       ├── components/
│       │   ├── ChatCanvas.tsx             ← ★ 管家居中贴底 + 气泡左对齐 + 欢迎屏 TodayHero+DropHero
│       │   ├── ButlerCharacter.tsx        ← ★ 7 姿势 + scale 0.33 默认 + onError fallback
│       │   ├── ConfirmCard.tsx            ← AI 写操作核实卡（+ create-note 紫色分支）
│       │   ├── Toast.tsx                  ← ★ 全局通知 useToast + 4 档 + Undo action
│       │   ├── TodayHero.tsx              ← ★ 今日聚焦概览 + streak 🔥 + 最佳时段 chip
│       │   ├── KeyboardShortcutsHelp.tsx  ← ★ ? 弹快捷键 modal
│       │   ├── PreferencesPanel.tsx       ← ★ 偏好(亮/暗 + 字号 + 管家性格 3 档)
│       │   ├── OnboardingTour.tsx         ← ★ 首次 5 步引导（pulse 高亮 + localStorage 防重复）
│       │   ├── NotesPreview.tsx           ← 任务备注 markdown modal
│       │   ├── ProcessingPipeline.tsx     ← PDF 4 步可视化
│       │   ├── InputPod.tsx               ← 输入舱 + 模型下拉 + 中文 IME 防误 + Stop 按钮
│       │   ├── TasksPanel.tsx             ← ★ 列表 + view + Deadline 紧急度色彩 + tag chip + 高亮闪烁
│       │   ├── TaskDetailDrawer.tsx       ← ★ 抽屉(status/tags/priority/附件/关联笔记/4 模板)
│       │   ├── CalendarPanel.tsx          ← ★ 月/Day/Week + Week 点创建 + 事件拖拽改时间
│       │   ├── NotesPanel.tsx             ← ★ 双栏 + 关联任务条 + checkbox 自动同步
│       │   ├── AttachmentPreview.tsx      ← URL/路径/Blob 3 类预览
│       │   ├── MiniAppsDrawer.tsx         ← 学习工具抽屉（3 App 注册表）
│       │   ├── mini-apps/
│       │   │   ├── FocusTimer.tsx         ← 番茄钟 + 关联任务下拉(结束写入 notes)
│       │   │   ├── StatsApp.tsx           ← ★ 7 天趋势 + Top tag 完成率
│       │   │   └── ShareCard.tsx          ← ★ 540×800 SVG 分享海报
│       │   └── layout/
│       │       ├── TopBar.tsx             ← 56px 顶 Bar + 用户菜单(含偏好设置入口)
│       │       ├── GlobalSearch.tsx       ← ⌘K 搜索 + 跳转 2s 黄色闪烁高亮
│       │       ├── LeftRail.tsx           ← 200px 容器
│       │       ├── ChatRail.tsx           ← + New Chat + Recent Chats
│       │       ├── TasksRail.tsx          ← 5 view 切换 + 计数
│       │       ├── CalendarRail.tsx       ← ★ 真迷你月历(7×6 + 上下月 + 今日圆 + 事件小点)
│       │       └── NotesRail.tsx          ← All / Pinned + 计数
│       └── lib/
│           ├── types.ts                   ← ★ DdlItem(+noteId) / Note(+syncedTodos) / ChatMessage(+reasoning+isError)
│           ├── db.ts                      ← Dexie v5
│           ├── ai-models.ts               ← V4 Flash + V4 思考
│           ├── ai-tools.ts                ← ★ 6 个 tool（+create_note）
│           ├── tool-executor.ts           ← + execCreateNote
│           ├── pending.ts                 ← + PendingCreateNote + extractNoteDrafts
│           ├── chat-client.ts             ← SSE + 多轮 tool + reasoning_content + personality + AbortSignal
│           ├── streak.ts                  ← ★ G2 连续天数 + 8 成就解锁
│           ├── demo-data.ts               ← ★ G1 一键 Demo（3 课 × 8 任务 + 2 笔记）
│           ├── ics-import.ts              ← ★ G1 .ics 文件解析
│           ├── ocr/
│           │   ├── providers.ts           ← OCR 注册表
│           │   └── index.ts               ← runOcr(file) + 50MB 硬拒
│           ├── document-parser.ts         ← unpdf + 路由
│           ├── semantic-filter.ts         ← MiniLM CDN
│           ├── blobs.ts                   ← Dexie blobs CRUD
│           ├── ics-export.ts              ← RFC 5545 + Butler footer 水印（[045] G3.1）
│           ├── json-export.ts             ← JSON 全量备份
│           └── mock-pipeline.ts           ← 4 步流元数据
└── public/
    ├── manifest.webmanifest               ← ★ PWA 装机（[045] G2.4）
    └── assets/butler-*.png                ← 3 张 + 4 新 fallback 到 standing
└── packages/                              ← Monorepo（Phase 4 真接入）
    ├── ai-core/                           ← Zod schemas（与 lib/types.ts 对齐）
    ├── database/                          ← Drizzle + getDbForTenant 多租户
    └── workflows/                         ← Inngest 工作流
```

---

## 3. 顶层状态机（page.tsx）

`page.tsx` 是单一信源，所有 state 在这里。子组件纯渲染 + emit 事件。

### 主要 state（~25 个，按职能分组）

**核心数据**
| State | 类型 | 说明 |
|---|---|---|
| `activeNav` | `NavId` | 当前 Tab |
| `messages` | `ChatMessage[]` | 全 session 共池 |
| `sessions` | `ChatSession[]` | 多会话元数据 |
| `activeSessionId` | `string \| null` | 当前会话 |
| `ddls` | `DdlItem[]` | 全局任务/日历 |
| `notes` | `Note[]` | 全局笔记 |
| `pendingBatches` | `Record<string, PendingBatch>` | AI 写操作待核实队列 |
| `pipelines` | `Record<string, ProcessingPipeline>` | PDF 4 步流 |

**AI 状态机（[033] 起）**
| State | 说明 |
|---|---|
| `selectedModel` | localStorage 持久化 |
| `aiActivity` | `{ phase: thinking/thinking-hard/idea/null, rareRoll: boolean }` 派生 butlerPose |
| `abortRef` (ref) | AbortController for 停止生成 |
| `ideaTimerRef` (ref) | idea pose 1s 切回 thinking 的 timer |
| `currentBatchIdRef` (ref) | 当前 send 期内累积 pending 同一 batch |
| `titleRequestedRef` (ref) | G 自动标题防重复 |
| `deadlineNotifiedRef` (ref) | Epic 5.4 deadline 通知防重复 |
| `greetedSessionsRef` (ref) | 开屏问候防重复 |

**UI Modal / Drawer**
| State | 说明 |
|---|---|
| `editing` | TaskDetailDrawer 编辑目标 |
| `previewing` / `previewNotes` | 附件 / 笔记 markdown 预览 |
| `miniAppsOpen` | MiniAppsDrawer |
| `shortcutsOpen` | KeyboardShortcutsHelp |
| `prefsOpen` | PreferencesPanel |
| `taskView` | Tasks 视图 |

**跨面板联动 + UI 派生**
| State | 说明 |
|---|---|
| `notesSelectId` | B1 跳 Notes 时选中 note |
| `highlightTaskId` + `highlightTimerRef` | B3 搜索跳转后 2s 闪烁 |
| `calendarJumpDay` | C1 迷你月历跳 Day View（用 `iso#timestamp` 防同 iso 失效） |
| `streakDays` | G2 连续天数 |
| `bestHourLabel` | G5.2 useMemo 派生最佳时段 |

### 持久化

- `ddls` / `messages` / `sessions` / `notes` → Dexie v5（自动迁移 v3→v4→v5）
- `selectedModel` → localStorage `butler.selectedModel`
- 偏好设置 → localStorage `butler.theme` / `butler.fontSize` / `butler.personality`
- streak → localStorage `butler.streak`（JSON）
- 成就解锁集 → localStorage `butler.achievements`（string[]）
- Tour 完成标记 → localStorage `butler.onboarded`
- 其他 ref / 浮层状态 → **不持久化**

---

## 4. 核心数据模型

### `DdlItem`（任务 = 日历共享）

```ts
interface DdlItem {
  id: string;
  taskName: string;
  weight: number | null;             // 学术权重 0-100，非学术 null
  dueDate: string;                   // YYYY-MM-DD 或 "" = "待定"
  dueTime: string;                   // HH:MM
  description: string;
  isGroupWork: boolean;
  source: string;                    // "AI 创建" / "手动添加" / 课件文件名
  completed: boolean;                // 保留兼容；新逻辑用 status
  notes?: string;
  attachments?: DdlAttachment[];     // URL / filepath / blob 3 类
  // v4 新字段
  status?: TaskStatus;               // "todo" | "in_progress" | "done"
  tags?: string[];
  priority?: TaskPriority;           // "low" | "med" | "high"
  // v5+ 跨面板联动（[039] B1）
  noteId?: string;                   // 关联笔记 id（反向用 ddls.filter 反查）
}
```

### 待核实门控

```ts
interface PendingBatch {
  id: string;
  sessionId: string;
  changes: PendingChange[];          // PendingCreate | PendingUpdate | PendingDelete
  origin: "ai-chat" | "pdf-extract";
  intro: string;                     // 给 ConfirmCard 顶部显示
  status: "pending" | "accepted" | "rejected";
}
```

流程：AI tool_call → `tool-executor.ts addPending(change)` → `page.tsx setPendingBatches` →
`ChatCanvas` 渲染 `ConfirmCard` → 用户点接受 → `applyBatch()` → `setDdls()`。

### `Note`（浏览器内笔记，v5 起）

```ts
interface Note {
  id: string;
  title: string;
  content: string;                   // Markdown
  tags?: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  vaultPath?: string;                // Phase 3 接 Tauri 后同步本地 Vault 时填
  syncedTodos?: string[];            // [039] B4 已自动同步到 Tasks 的 todo 文本（去重）
}
```

### `ChatMessage`（多了 reasoning / isError）

```ts
interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "pipeline" | "confirm";
  content: string;
  files?: UploadedFile[];
  pipelineId?: string;
  confirmBatchId?: string;
  reasoning?: string;                // [031] V4 思考模式 CoT 推理
  isError?: boolean;                 // [036] 错误消息 → 红边 + 永显 retry
  timestamp: Date;
}
```

### `PendingChange`（含 create-note）

```ts
type PendingChange = PendingCreate | PendingUpdate | PendingDelete | PendingCreateNote;
// PendingCreateNote: { kind: "create-note"; noteDraft: Note }
```

`extractNoteDrafts(batch)` 接受时把 note 草稿单独 setNotes。

NotesPanel 双栏 + 500ms 防抖保存。`vaultPath` 当前留空，Phase 3 启用本地 Obsidian Vault 时填。

### OCR Response（多模态识别返回）

```ts
type OcrResponse =
  | { ok: true; text: string; pages: number; provider: string; ocrUsed: boolean }
  | { ok: false; error: string; needsConfig?: boolean };
```

`needsConfig=true` 用于 UI 友好提示"去申请 MISTRAL_API_KEY"。

---

## 5. 关键技术决策（不要回退）

| 决策 | 原因 | 文件 |
|---|---|---|
| **DeepSeek 只用 V4 系列**（Flash / 思考） | 旧 `deepseek-chat`/`deepseek-reasoner` 2026-07-24 弃用；Flash 比 V3 便宜 3-25× | `lib/ai-models.ts` |
| 思考模式参数 = `reasoning_effort: "high"` + `thinking: { type: "enabled" }` 透传 | DeepSeek V4 Pro 的 thinking_mode 官方 API | `app/api/chat/route.ts` |
| **文字 PDF → unpdf 本地**；扫描件 / 图片 → Mistral OCR | 文字型免费快；扫描件 $0.001/页 | `lib/document-parser.ts` + `app/api/ocr/route.ts` |
| OCR 可切换 provider（mistral/deepseek-vl/tesseract） | 未来不绑死 Mistral；价格透明 | `lib/ocr/providers.ts` |
| MiniLM via CDN + `new Function("u","return import(u)")` | 绕开 transformers.js webpack 冲突 | `lib/semantic-filter.ts` |
| **Dexie v5** + IndexedDB | 个人 MVP 0 部署 0 月费；v5 加 notes 表 | `lib/db.ts` |
| Phase 3 走 Tauri 而非 Electron | 体积小一个数量级 + 用户明确选 | — |
| 关键词过滤 + 语义粗筛双层 | 砍 60-80% input token | `lib/document-parser.ts` + `semantic-filter.ts` |
| AI 不准瞎猜 | dueDate → 空串"待定"；weight → null | `app/api/extract-ddls/route.ts` |
| AI 写操作走 ConfirmCard | 用户必须核实才落库 | `lib/tool-executor.ts` + `ConfirmCard.tsx` |
| AI tool 可设全部字段（status/tags/priority/notes） | Stage C.2 字段扩展的自然延伸 | `lib/ai-tools.ts` + `lib/tool-executor.ts` |
| **开屏问候改纯本地代码**（[038]）零 token | `triggerGreeting` 不再调 API,buildLocalGreeting 派生 | `app/page.tsx buildLocalGreeting` |
| 全局搜索接通 ddls/notes/messages + 跳转 2s 黄色闪烁 | 体验闭环 | `GlobalSearch.tsx` + `globals.css search-flash` |
| 管家 PNG 抠白底 + trim 透明边 | mix-blend-mode 不够干净 | `public/assets/butler-*.png` |
| **管家居中贴底 0.33 倍率**（[037]） | 替代左下浮动,小角色不抢视觉 | `ChatCanvas.tsx` + `ButlerCharacter.tsx` |
| **管家 7 姿势状态机** + 7-9am × 6.1% rare 彩蛋 | flash/thinking/idea/rare 区分,人格化 | `ButlerCharacter.tsx` + `page.tsx aiActivity` |
| **管家性格 3 档**（gentle/standard/sassy） | 差异化护城河 | `PERSONALITY_LINE` in `chat/route.ts` |
| **历史截断 10 条**（[035]） | input token 线性爆炸防护 | `page.tsx handleSend HISTORY_LIMIT` |
| **AI 气泡左对齐 + 标准 ChatGPT 风格**（[037]） | 用户决策回归标准 | `ChatCanvas ButlerBubble justifyContent` |
| **跨面板联动 B1-B4**（[039]） | 任务↔笔记关联 / AI create_note / 搜索高亮 / checkbox 同步 Tasks | `tool-executor + TaskDetailDrawer + NotesPanel` |
| **AI 写操作走 ConfirmCard** | 用户必须核实才落库 | `tool-executor.ts` + `ConfirmCard.tsx` |
| 设计语言：墨绿 + 平面 + 暗色主题（[045] G3） | 与 Linear/Notion 对齐 | `app/globals.css` |
| **Toast 系统取代 alert + 删除带 5s Undo** | UX 基础 | `components/Toast.tsx` |
| **首次 5 步 Tour + localStorage 防重复** | G1.3 激活率 | `OnboardingTour.tsx` |
| **streak + 8 成就 + PWA manifest** | G2 留存机制（纯本地） | `lib/streak.ts` + `public/manifest.webmanifest` |
| **学习习惯识别**（本地分析 messages 时间戳） | G5.2 差异化 | `page.tsx bestHourLabel useMemo` |
| **临近 deadline 浏览器通知**（24h 内 + Toast + Notification API） | Epic 5.4 | `page.tsx useEffect 60s 扫描` |

---

## 6. AI Tool 调用矩阵

| Tool | 走 ConfirmCard | 直接执行 | 用途 |
|---|---|---|---|
| `create_item` | ✅ | | 新建任务/事件（草稿入 pending） |
| `update_item` | ✅ | | 修改（patch 入 pending） |
| `delete_item` | ✅ | | 删除（快照入 pending） |
| `toggle_complete` | | ✅ | 高频低风险，直接改 completed |
| `list_items` | | ✅（只读） | AI 查询当前 ddls |
| `create_note` | ✅ | | [039] B2 跨面板:草稿入 pending (create-note) → 用户接受后入 Notes |

Reasoner 模型不支持工具，自动跳过（见 `app/api/chat/route.ts`）。

---

## 7. 5 增长支柱（[044]+[045]）

| Pillar | 状态 | 关键产出 |
|---|---|---|
| G1 激活率 | ✅ | Demo 数据 / 大拖拽 / 5 步 Tour / .ics 导入 |
| G2 留存 | ✅ | streak / 成就 / PWA manifest |
| G3 传播 | ✅ | ics footer 水印 / SVG 分享卡 |
| G5 AI 差异化 | ✅ | 管家 3 性格 / 学习习惯识别 |
| G4 变现 | ⏳ | Phase 4 多租户后做 |

---

*最后更新：2026-05-25 — 全面同步 [031]-[045]:reasoning + 居中管家 + 7 姿势状态机 + 历史截断 + 跨面板联动 + UI/UX 6 Epic + Calendar 100% + 5 增长支柱*
