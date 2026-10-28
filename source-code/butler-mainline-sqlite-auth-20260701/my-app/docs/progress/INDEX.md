# 📚 进度归档索引

> [PROGRESS.md](../../PROGRESS.md) 只保留最近 5 条；更早的条目按月归档于此目录。

## 月度归档

| 月份 | 文件 | 包含条目 | 关键里程碑 |
|---|---|---|---|
| 2026-05 | [2026-05.md](./2026-05.md) | [001]-[021] | Monorepo 骨架 / Chat UI / 4 面板 / V4 Flash / 真 PDF 链路 / Dexie / CRUD / ICS / 附件 / 多会话 / UI 重构 Stage A-B / 管家形象 |

> [022]-[030] 仍在根 [PROGRESS.md](../../PROGRESS.md)，下次月度归档时迁过来。

## 按主题速查（跨月）

### 架构里程碑
- [001] Monorepo 骨架（`2026-05.md`）
- [002] Next.js App（`2026-05.md`）
- [003] AI 核心层 `packages/ai-core`（`2026-05.md`）
- [004] 数据库层 `packages/database`（`2026-05.md`）
- [005] 工作流层 `packages/workflows`（`2026-05.md`）
- [007] Phase 1 完成：4 面板架构（`2026-05.md`）
- [012] Dexie 持久化（`2026-05.md`）
- [016] 多会话隔离（`2026-05.md`）

### AI 链路演进
- [006] Chat UI 基础（`2026-05.md`）
- [009] 切换 DeepSeek-V4 Flash（成本 -3-25 倍）（`2026-05.md`）
- [010] Phase D：真实 PDF 链路（unpdf + 提取 DDL）（`2026-05.md`）
- [011] 客户端语义粗筛（MiniLM）（`2026-05.md`）
- [014] AI 质量护栏（不准瞎猜）（`2026-05.md`）
- [018] AI 写操作"待核实"门控（ConfirmCard）（`2026-05.md`）
- [026] 模型切换 + Stage C.2 字段扩展（[PROGRESS.md](../../PROGRESS.md)）
- [028] 多模态 OCR（Mistral）+ 模型简化 V4 only（[PROGRESS.md](../../PROGRESS.md)）
- [029] AI tool 加 status/tags/priority/notes + AI 开屏问候（[PROGRESS.md](../../PROGRESS.md)）
- [030] 模型切换 bug 修复（inline style 竞争）（[PROGRESS.md](../../PROGRESS.md)）

### UI 重构（Stage A-E）
- [017] Stage A：顶 Tab Bar + LeftRail + 墨绿设计 token（`2026-05.md`）
- [018] 管家形象 3 姿势（`2026-05.md`）
- [019] 漫画式对话舞台 + 真透明 PNG 抠图（`2026-05.md`）
- [020] 管家位置调整（左侧全高）（`2026-05.md`）
- [021] 管家融入主区 + AI 漫画对话框（`2026-05.md`）
- [022] Stage C.1：TasksPanel 视觉重做（[PROGRESS.md](../../PROGRESS.md)）
- [023] Stage D：Calendar 月+日双视图（[PROGRESS.md](../../PROGRESS.md)）
- [024] Mini Apps Drawer + Focus Timer（[PROGRESS.md](../../PROGRESS.md)）
- [025] Stage E：Notes 重做 + legacy 清理（[PROGRESS.md](../../PROGRESS.md)）

### 数据与功能扩展
- [013] TasksPanel/CalendarPanel CRUD（`2026-05.md`）
- [014] ICS 订阅 + JSON 导出导入（`2026-05.md`）
- [015] 任务备注 + 3 类附件（`2026-05.md`）
- [026] 模型切换 + Stage C.2 字段扩展（[PROGRESS.md](../../PROGRESS.md)）
- [029] Notes 浏览器版（Dexie v5 双栏）+ 全局搜索 + Markdown 预览（[PROGRESS.md](../../PROGRESS.md)）

### 文档维护
- [027] 上下文分区（按 Anthropic 2026 best practice 拆 AGENT/docs/）（[PROGRESS.md](../../PROGRESS.md)）
- [030] AGENT/architecture/setup/pitfalls/INDEX 同步最新状态（[PROGRESS.md](../../PROGRESS.md)）

## 归档规则

- **PROGRESS.md 只保留最近 5 条**（约 250-300 行，可一次性放进 AI context）
- 每月初把上月剩余条目迁到 `YYYY-MM.md`
- 本索引按主题维护跨月链接，方便回查
