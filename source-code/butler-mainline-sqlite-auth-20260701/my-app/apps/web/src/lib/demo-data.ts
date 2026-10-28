// ============================================================
// lib/demo-data.ts — 新用户激活:一键填入 3 门课 × 8 任务 + 2 笔记
//
// 全部基于今天 + N 天派生,保证 deadline 是未来日期,看起来真实
// ============================================================

import type { DdlItem, Note } from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function isoOffsetDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildDemoData(): { ddls: DdlItem[]; notes: Note[] } {
  const now = Date.now();

  const ddls: DdlItem[] = [
    // ---- C245 数据结构 ----
    {
      id: uid(),
      taskName: "数据结构 Quiz 3",
      weight: 10,
      dueDate: isoOffsetDay(2),
      dueTime: "10:00",
      description: "覆盖二叉树 / 红黑树",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["C245", "quiz"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "数据结构 期中 Project",
      weight: 25,
      dueDate: isoOffsetDay(10),
      dueTime: "23:59",
      description: "实现一个 LSM-Tree 简化版,Github 提交",
      isGroupWork: true,
      source: "示例数据",
      completed: false,
      status: "in_progress",
      tags: ["C245", "project"],
      priority: "high",
    },
    {
      id: uid(),
      taskName: "数据结构 阅读 Ch5-6",
      weight: null,
      dueDate: isoOffsetDay(1),
      dueTime: "20:00",
      description: "Skip List + Hash Table",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["C245", "reading"],
      priority: "low",
    },
    // ---- ECON101 经济学 ----
    {
      id: uid(),
      taskName: "经济学 Paper 提纲",
      weight: 15,
      dueDate: isoOffsetDay(5),
      dueTime: "18:00",
      description: "宏观货币政策 — 选 2018 vs 2022 对比",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["ECON101", "paper"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "经济学 阅读 Mankiw Ch12",
      weight: null,
      dueDate: isoOffsetDay(3),
      dueTime: "23:59",
      description: "通胀与失业的 Phillips 曲线",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["ECON101", "reading"],
    },
    {
      id: uid(),
      taskName: "经济学 期末考试",
      weight: 40,
      dueDate: isoOffsetDay(28),
      dueTime: "14:00",
      description: "覆盖全学期 + 重点 Ch1/3/7/12",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["ECON101", "exam"],
      priority: "high",
    },
    // ---- ENG201 学术英语 ----
    {
      id: uid(),
      taskName: "Academic Writing 草稿",
      weight: 20,
      dueDate: isoOffsetDay(7),
      dueTime: "23:59",
      description: "Argumentative Essay 800-1000 words",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["ENG201", "paper"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "Presentation 与导师 meeting",
      weight: null,
      dueDate: isoOffsetDay(4),
      dueTime: "15:30",
      description: "讨论选题 + 大纲 review",
      isGroupWork: false,
      source: "示例数据",
      completed: false,
      status: "todo",
      tags: ["ENG201"],
      priority: "med",
    },
  ];

  const notes: Note[] = [
    {
      id: "note-" + uid(),
      title: "C245 数据结构 — 红黑树关键点",
      content: `# 红黑树关键点\n\n## 性质\n- 节点红或黑\n- 根黑\n- 红节点的子节点必为黑\n- 任一节点到叶子的所有路径黑节点数相同\n\n## 旋转\n- 左旋:把右子提升\n- 右旋:把左子提升\n\n## 插入修复\n- 父叔均红 → 父叔变黑 + 祖父变红 + 向上递归\n- 父红叔黑 → 旋转 + 重新着色\n\n> Quiz 3 必考点 ⚠️`,
      tags: ["C245", "复习"],
      pinned: true,
      createdAt: now - 3 * 86400000,
      updatedAt: now - 2 * 86400000,
    },
    {
      id: "note-" + uid(),
      title: "经济学 paper 选题脑暴",
      content: `# Paper 选题候选\n\n- [x] 2018 vs 2022 货币政策对比 ✓ 选这个\n- [ ] Fed 量化宽松对新兴市场的影响\n- [ ] 中国 LPR 改革的传导效应\n\n## 资料\n- Mankiw Ch15\n- IMF WEO 2023\n- Fed FOMC 会议纪要\n\n## 结构\n1. Intro - 背景\n2. Lit review - 2-3 篇核心\n3. 分析框架 - IS-LM + Phillips\n4. 案例对比\n5. 结论 + 政策建议`,
      tags: ["ECON101", "paper"],
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    },
  ];

  return { ddls, notes };
}
