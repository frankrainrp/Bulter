# 🤖 AGENT.md — Butler 接班简报（入口）

> **5 分钟入门**。这份文件刻意短（< 200 行），按需打开 `docs/*`。
> 写法参考 [Anthropic Claude Code 官方 best practice](https://code.claude.com/docs/en/best-practices)。

---

## 0. TL;DR

**Butler / 智能多模态学习管家** = **AI 驱动的 4 面板 Personal Learning OS**（Chat / Tasks / Calendar / Notes）。
用户和管家（AI）对话或丢 PDF，管家结构化为任务 / 日历 / 笔记并持续维护。
**不是 ChatGPT 克隆**。

---

## 1. 当前 Phase 与最新进度

- **Phase 2 完成 ✅** + 基础功能 4 面板全部有真东西（PROGRESS 最新 **[057]**）；**Chat ~100% / Tasks ~99% / Notes ~100% / Calendar ~100% / 跨面板 ~80% / 平台层全新增 / 5 增长支柱 / 7 管家姿势 / 自定义系统 5 Phase A-E / Notes 100% / D 小补丁 / F Polish / 音效+插画 / [057] 修复思考模式多轮 tool calling 400**
- UI 重构 5 stage 全部收尾（Stage A 顶 Tab → E 全局清理）
- **管家形象 + ConfirmCard 核实门控 + Mini Apps Drawer + 模型切换 + Stage C.2 字段扩展 + 多模态 OCR + Notes 浏览器版 + 全局搜索 + AI 开屏问候 + 思考模式 reasoning 可见化** 都已落地
- Phase 3（Tauri 桌面壳）/ Phase 4（Clerk + Neon 多租户）未启动
- **阻塞中**：Rive 人物动画等用户提供分层 SVG 资产（详见 `docs/plans/animation.md`）

---

## 2. 必读（按顺序，越往下越按需）

| # | 文件 | 看什么 | 强制读 |
|---|---|---|---|
| 1 | [PROGRESS.md](PROGRESS.md) 第一条 | **当前最新进度**，下一步从这里推算 | ✅ IMPORTANT |
| 2 | [docs/architecture.md](docs/architecture.md) | 4 面板 / 代码地图 / 共享类型 / 关键技术决策 | ✅ IMPORTANT |
| 3 | [docs/workflow.md](docs/workflow.md) | Token 效率 / PM 对齐 / PROGRESS 规范 / UI baseline | ✅ IMPORTANT |
| 4 | [docs/setup.md](docs/setup.md) | 启动 / 测试 / 环境变量 / 模型切换 | 用到再读 |
| 5 | [docs/pitfalls.md](docs/pitfalls.md) | 已知陷阱（前任踩过的坑） | 报错再读 |
| 6 | [docs/plans/](docs/plans/) | UI 重构存档 / Live2D 动画方案 | 做对应任务时读 |

> 读完前 2 + 3 项（约 1500 行）就能开工；其他按需。

---

## 3. 接班第一件事

1. 跑 `pnpm dev`（cd `my-app/apps/web`）
2. 浏览器开 `http://localhost:3000`，点一遍 Chat / Tasks / Calendar / Notes + 右上 Apps 图标
3. 读 PROGRESS.md 最顶部一条
4. **问用户**："你想继续 [PROGRESS 最新进度的下一步]，还是别的方向？"
5. 用户答了再用 `TaskCreate` 拆 task list

**不要**：凭印象写代码 / 直接改 UI（已 baseline） / 让 AI 流任意多轮 tool / 推 git。

---

## 4. 不要回退的关键决策（一句话）

- **DeepSeek 只用 V4 系列**：`deepseek-v4-flash`（默认）和 `deepseek-v4-pro` + 思考模式（旧 `deepseek-chat` / `deepseek-reasoner` **2026-07-24 弃用**）
- **客户端 unpdf + MiniLM 语义粗筛**（文字 PDF ¥0.003/份）；**扫描件 / 图片走 Mistral OCR**（$0.001/页，需 `MISTRAL_API_KEY`）
- **Dexie v5**（IndexedDB）单用户持久化：`ddls / messages / sessions / blobs / notes`。Phase 3 切 Tauri SQLite，Phase 4 切 Neon
- **AI 写操作（create/update/delete）走 ConfirmCard 核实门控**，不直接落库
- **AI tool 可设全部字段**：status / tags / priority / notes（PROGRESS [029] 起）
- **管家居中贴主区底部**（[037] 起 scale 0.33），AI 消息墨绿描边 + 左对齐贴 padding（[038]）；ConfirmCard 独立居中浮顶
- **管家 7 姿势状态机**（[033]）+ 7-9am × 6.1% rare-thinking 彩蛋；4 张新姿势真资产 [046] 接入（trim 脚本 `scripts/trim_butler_poses.py` 复用）
- **管家 3 性格**（gentle/standard/sassy）影响 system prompt，localStorage `butler.personality`
- **Toast 全局通知系统**（[040]）取代所有 alert；删除/导入带 5s Undo
- **首次访问 Tour**（[044] G1.3）自动启动，localStorage `butler.onboarded` 防重复
- **streak + 成就**（[045] G2）localStorage 派生,8 个成就;TodayHero 显示 🔥
- **PWA manifest**（[045] G2.4）支持装机
- **Notes 浏览器版**（v5 起）双栏 + 防抖保存。Phase 3 接 Tauri 后会迁移到本地 Obsidian Vault（`vaultPath` 字段已留位）
- **自定义系统 5 Phase A-E**（[048]-[052]，Dexie v7）：
  - 主题色 color picker + hex↔HSL 派生（`lib/theme.ts`）
  - 上传管家形象 + 客户端 Canvas trim（`lib/butler-asset.ts`，IndexedDB butlerAssets）
  - 布局偏好（`lib/layout-prefs.ts`，Tab 拖拽顺序 + 隐藏 + 管家位置 4 档）
  - 自定义面板（`lib/custom-panels.ts`，IndexedDB customPanels，Markdown body）

---

## 5. 工作流约定（必须遵守）

> 详见 [docs/workflow.md](docs/workflow.md)，这里只列硬规则。

- **IMPORTANT**: ≥ 3 步任务 **必须** 用 `TaskCreate` 拆 task list
- **IMPORTANT**: 接到 "作为 PM" / "重新设计" / "不到预期" 信号 → 用 `AskUserQuestion` 先收敛 3-4 个关键决策，**禁止直接改代码**
- **IMPORTANT**: UI 改动前先问用户具体哪里不对（用户原话「UI 暂时算合格先处理实际功能」）
- **IMPORTANT**: 每组改动追加 `PROGRESS.md` 新条目（格式 `## [序号] YYYY-MM-DD — 标题`）
- **IMPORTANT**: 系统 prompt < 200 token；历史消息截断至最近 10 条；contextSummary 限 20 条 item
- **IMPORTANT**: 备份点用 git commit + tag（`backup-NNN-描述`）
- **YOU MUST**: 不要修改 git config / 不要 push / 不要 --no-verify

---

## 6. 代码地图速查（详见 [docs/architecture.md](docs/architecture.md)）

```
my-app/apps/web/src/
├── app/
│   ├── page.tsx              ← ★ 顶层状态机（含 notes / streak / aiActivity / abortRef / 拖拽 / Tour 等 ~20 state）
│   ├── layout.tsx            ← ToastProvider + manifest + Inter 字体
│   ├── globals.css           ← 设计 token（墨绿 + 暗色 dark theme） + font-base + search-flash 动画
│   └── api/
│       ├── chat/route.ts     ← V4 模型 + thinking + personality 3 档 + 6 个 tool（含 create_note）
│       ├── extract-ddls/...  ← PDF DDL 提取（V4 Flash + tool_choice）
│       │                       注：chat/route.ts 现支持 7 个 tool（含 [054] create_custom_panel）
│       └── ocr/route.ts      ← Mistral OCR 服务端代理
├── components/
│   ├── ChatCanvas.tsx        ← 主区:管家居中贴底 0.33 倍率 + 气泡左对齐 + 输入框前置 + 欢迎屏 TodayHero+DropHero
│   ├── ButlerCharacter.tsx   ← ★ 7 姿势 PNG 真资产 [046]（standing/serving/pointout/thinking/thinking-hard/idea/rare-thinking）+ scale 0.33 默认 + onError fallback
│   ├── ConfirmCard.tsx       ← AI 写操作核实卡（含 create-note 紫色 BookOpen 分支）
│   ├── NotesPreview.tsx      ← 任务备注 Markdown 预览 modal
│   ├── TaskDetailDrawer.tsx  ← 右侧详情抽屉(status/tags/priority/附件/关联笔记/4 模板)
│   ├── TasksPanel.tsx        ← Linear 列表 + view 过滤 + Deadline 紧急度色彩 + tag chip 聚合 + 高亮闪烁
│   ├── CalendarPanel.tsx     ← 月 + Day + Week 视图（Week 含点空格创建 + 事件拖拽改时间）
│   ├── NotesPanel.tsx        ← [053] 浏览器版双栏（v5）+ wikilink 双链 + 反向引用 + 本地搜索 + 关联任务条 + checkbox 自动同步 Tasks
│   ├── ProcessingPipeline.tsx ← PDF 4 步可视化
│   ├── InputPod.tsx          ← 输入舱 + 模型下拉 + 中文 IME 防误 + Stop 按钮
│   ├── AttachmentPreview.tsx ← URL/路径/Blob 3 类预览
│   ├── MiniAppsDrawer.tsx    ← 学习工具抽屉（3 App: FocusTimer/StatsApp/ShareCard）
│   ├── Toast.tsx             ← ★ 全局 Toast 通知（useToast hook，4 档 + action 按钮 Undo）
│   ├── TodayHero.tsx         ← ★ Chat 欢迎屏「今日聚焦」+ streak 🔥 + 最佳时段 chip
│   ├── KeyboardShortcutsHelp.tsx ← ★ ? 弹快捷键 modal
│   ├── PreferencesPanel.tsx  ← ★ 偏好设置 modal（主题/字号/主题色/管家形象/布局/管家性格 6 段）
│   ├── CustomPanelView.tsx   ← ★ [052] 自定义面板渲染（emoji+label+Markdown/iframe + 防抖保存）
│   ├── EmptyIllustrations.tsx ← ★ [056] 6 内联 SVG 空状态插画（主题色自适应）
│   ├── OnboardingTour.tsx    ← ★ 首次 5 步引导（暗色遮罩 + pulse 高亮）
│   ├── mini-apps/
│   │   ├── FocusTimer.tsx    ← 番茄钟 + 关联任务下拉
│   │   ├── StatsApp.tsx      ← ★ 7 天趋势 + Top tag
│   │   └── ShareCard.tsx     ← ★ 540×800 竖版 SVG 分享海报
│   └── layout/
│       ├── TopBar.tsx        ← 56px 顶 Bar + 用户菜单(含偏好设置) + Apps 按钮
│       ├── GlobalSearch.tsx  ← ⌘K 全局搜索(ddls/notes/messages) + 跳转高亮
│       ├── LeftRail.tsx      ← 200px 容器
│       ├── ChatRail.tsx      ← + New Chat + Recent Chats
│       ├── TasksRail.tsx     ← 5 view 切换 + 计数
│       ├── CalendarRail.tsx  ← ★ 真迷你月历（7×6 网格 + 上下月切换 + 今日墨绿圆 + 事件小点）
│       └── NotesRail.tsx     ← All / Pinned + 计数
└── lib/
    ├── types.ts              ← ★ DdlItem(+noteId) / ChatMessage(+reasoning+isError) / Note(+syncedTodos) / TaskStatus/Priority
    ├── db.ts                 ← Dexie v5
    ├── ai-models.ts          ← V4 Flash + V4 思考
    ├── ai-tools.ts           ← 7 个 tool schema（+ [054] create_custom_panel）
    ├── tool-executor.ts      ← 含 execCreateNote + execCreateCustomPanel
    ├── pending.ts            ← + PendingCreateNote + PendingCreateCustomPanel + extract* 助手
    ├── chat-client.ts        ← SSE + 多轮 tool + reasoning_content（[057] 带 tool_call 轮必回传）+ personality + AbortSignal
    ├── document-parser.ts    ← 文字 PDF→unpdf;扫描/图片→OCR
    ├── semantic-filter.ts    ← MiniLM CDN
    ├── streak.ts             ← ★ G2 连续天数 + 8 个成就解锁
    ├── demo-data.ts          ← ★ G1 一键 Demo（3 课 × 8 任务 + 2 笔记）
    ├── ics-import.ts         ← ★ G1 .ics 课表文件解析
    ├── theme.ts              ← ★ [049] Phase B 颜色：hex↔HSL + deriveAccentScheme + 6 预设
    ├── butler-asset.ts       ← ★ [050] Phase C 人物：客户端 Canvas trim + IndexedDB CRUD
    ├── layout-prefs.ts       ← ★ [051] Phase D 布局：tabsOrder/hiddenTabs/butlerPosition
    ├── custom-panels.ts      ← ★ [052] Phase E 自定义面板 CRUD + [054] putCustomPanel（用于 AI 草稿入库）
    ├── sound.ts              ← ★ [056] WebAudio 程序化音效（14 key / opt-in / 6 分类 / 静音时段）
    ├── ocr/
    │   ├── providers.ts      ← OCR provider 注册表
    │   └── index.ts          ← runOcr(file) + 50MB 硬拒
    └── blobs.ts / ics-export.ts(含 Butler footer 水印) / json-export.ts / mock-pipeline.ts

public/
├── manifest.webmanifest      ← ★ PWA 装机
└── assets/
    └── butler-*.png          ← ★ 7 张全部就位（standing/serving/pointout + thinking/thinking-hard/idea/rare-thinking）

scripts/
└── trim_butler_poses.py     ← ★ [046] 1254² JPEG-in-SVG → trim 透明 PNG（PIL 白底抠图 + getbbox）
```

---

## 7. 已知陷阱（详见 [docs/pitfalls.md](docs/pitfalls.md)）

报错时按表查：
- transformers.js webpack 冲突 → CDN + `new Function` 隐藏 dynamic import
- unpdf 浏览器 mergePages 空 → 用 npm 而非 CDN
- Dexie 启动 hydration 竞态 → 用 `hydrated` 门控
- Next.js HMR 缓存 dynamic import → 重启 dev server
- Windows PowerShell 不支持 `&&` → 用 `;` 或 `if ($?) { B }`

---

*最后更新：2026-05-28 — 同步 [057]：修复思考模式多轮 tool calling 丢 reasoning_content（400）*
