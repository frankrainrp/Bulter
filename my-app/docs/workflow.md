# 🔄 Workflow

> 工作流约定 + 红线规则。开干前必读。

---

## A. Token 效率（用户预算敏感，反复强调）

- 系统 prompt 精简到 200 token 以内
- 历史消息截断（仅发最近 ~10 条）
- contextSummary 限 20 条 item
- 测试阶段一次跑 2-3 场景，**不要为了"覆盖所有 case"消耗大量 token**
- 保持 system prompt 稳定让 DeepSeek cache hit 命中（输入价 1/25）
- AI 流式输出不要无限多轮 tool（已设 `maxRounds=5`）

> 用户原话："我资金有限，能省 token 就省。"

---

## B. PM 对齐优先

接到下面信号时 → **绝对不要直接改代码**：

- "作为 PM..."
- "重新设计..."
- "不到预期..."
- "我想..."（产品级需求）

正确流程：

1. 用 `AskUserQuestion` 收敛 3-4 个关键决策：
   - 痛点是什么
   - 信息架构 / 数据模型
   - 目标用户 / 场景
   - 近期交付物
2. 遇到技术红旗（如"读写本地 Vault" 在 Web 做不到）**立刻拉旗 + 给选项**，让用户拍板
3. 等用户答了再 `TaskCreate` 拆 task 开干

> 反例：用户说"做个会话管理"我直接动手写 SessionListPanel，后来用户说"应该融入 LeftRail"我得拆掉重做。

---

## C. PROGRESS.md 是真相源

- 每次完成一组改动（≥ 创建/重写多个组件级别）→ **必须** 追加新条目到 PROGRESS.md 顶部
- 格式：

```markdown
## [序号] YYYY-MM-DD — 标题

> （可选）用户决策背景

### 📂 涉及文件

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `path/to/file` | 新建/修改/删除 | 一句话说明 |

### 🎯 / 🎨 / ✅ 等小节按需

### 🚦 后续可继续 / 💾 备份
```

- 每月把上月剩余条目迁移到 `docs/progress/YYYY-MM.md`
- 详见 [docs/progress/INDEX.md](progress/INDEX.md)

---

## D. UI 已 baseline 合格

- **不要主动重做视觉**。用户原话「UI 暂时算合格先处理实际功能」
- 改 UI 前先问用户具体哪里不对
- 例外：用户主动给设计稿 / 主动说"重做"才能动

> 历史：UI-REDESIGN-PLAN.md 是用户主动给 4 张设计稿后开启的，否则不会做。

---

## E. 任务追踪：TaskCreate / TaskUpdate

- ≥ 3 步的任务 **必须** 拆 task list
- 开始一个 task → `in_progress`；完成 → `completed`
- 让用户实时看到进度，避免反复确认
- 一次只 in_progress 1 个

---

## F. Git 备份规范

每完成一个**大阶段**（UI Stage / 重大重构）打 backup tag：

```bash
git add -A
git commit -m "..."
git tag backup-NNN-描述   # 如 backup-021-comic-chat / backup-024-mini-apps
```

回滚：`git reset --hard backup-NNN-描述` 或 `git checkout backup-NNN-描述`

**红线**：
- 不要 `--no-verify` / `--no-gpg-sign`
- 不要 `--force` push（除非用户明确）
- 不要 push 到远程（除非用户明确）
- 不要修改 `git config`

---

## G. 测试与校验顺序

1. 改完代码 → `pnpm exec tsc --noEmit`（`EXIT=0` 才算过）
2. 浏览器手测关键路径（不要为覆盖一切而 token 烧光）
3. 大改动后 commit + tag

dev server 在后台跑 → HMR 自动重载；TS 校验是独立任务。

---

## H. 红线（YOU MUST NOT）

- ❌ 凭印象写代码（DeepSeek 价格/模型经常变，先 WebSearch）
- ❌ 大改 UI 前不问用户
- ❌ 让 AI 流多轮 tool（费 token）
- ❌ 直接合并 PR / 推送 git
- ❌ 修改 `git config`
- ❌ skip hooks
- ❌ 上传 `.env.local`（包含 API key）
- ❌ 给 AI tool 任意权限（每个写操作都要走 ConfirmCard）

---

*最后更新：2026-05-24*
