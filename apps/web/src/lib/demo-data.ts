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
      taskName: "Data Structures Quiz 3",
      weight: 10,
      dueDate: isoOffsetDay(2),
      dueTime: "10:00",
      description: "Covers binary trees and red-black trees",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["C245", "quiz"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "Data Structures Midterm Project",
      weight: 25,
      dueDate: isoOffsetDay(10),
      dueTime: "23:59",
      description: "Implement a simplified LSM-Tree and submit on GitHub",
      isGroupWork: true,
      source: "Sample data",
      completed: false,
      status: "in_progress",
      tags: ["C245", "project"],
      priority: "high",
    },
    {
      id: uid(),
      taskName: "Data Structures Reading Ch5-6",
      weight: null,
      dueDate: isoOffsetDay(1),
      dueTime: "20:00",
      description: "Skip List + Hash Table",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["C245", "reading"],
      priority: "low",
    },
    // ---- ECON101 经济学 ----
    {
      id: uid(),
      taskName: "Economics Paper Outline",
      weight: 15,
      dueDate: isoOffsetDay(5),
      dueTime: "18:00",
      description: "Macroeconomic monetary policy: compare 2018 vs 2022",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["ECON101", "paper"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "Economics Reading Mankiw Ch12",
      weight: null,
      dueDate: isoOffsetDay(3),
      dueTime: "23:59",
      description: "Inflation, unemployment, and the Phillips curve",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["ECON101", "reading"],
    },
    {
      id: uid(),
      taskName: "Economics Final Exam",
      weight: 40,
      dueDate: isoOffsetDay(28),
      dueTime: "14:00",
      description: "Covers the full semester with focus on Ch1/3/7/12",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["ECON101", "exam"],
      priority: "high",
    },
    // ---- ENG201 学术英语 ----
    {
      id: uid(),
      taskName: "Academic Writing Draft",
      weight: 20,
      dueDate: isoOffsetDay(7),
      dueTime: "23:59",
      description: "Argumentative Essay 800-1000 words",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["ENG201", "paper"],
      priority: "med",
    },
    {
      id: uid(),
      taskName: "Presentation and Advisor Meeting",
      weight: null,
      dueDate: isoOffsetDay(4),
      dueTime: "15:30",
      description: "Discuss topic selection and outline review",
      isGroupWork: false,
      source: "Sample data",
      completed: false,
      status: "todo",
      tags: ["ENG201"],
      priority: "med",
    },
  ];

  const notes: Note[] = [
    {
      id: "note-" + uid(),
      title: "C245 Data Structures - Red-Black Tree Key Points",
      content: `# Red-Black Tree Key Points\n\n## Properties\n- Each node is red or black\n- The root is black\n- Children of red nodes must be black\n- Every path from a node to leaves has the same black-node count\n\n## Rotations\n- Left rotation: promote the right child\n- Right rotation: promote the left child\n\n## Insert Fixup\n- Red parent and red uncle: recolor parent/uncle black, grandparent red, then recurse upward\n- Red parent and black uncle: rotate and recolor\n\n> Important for Quiz 3`,
      tags: ["C245", "review"],
      pinned: true,
      createdAt: now - 3 * 86400000,
      updatedAt: now - 2 * 86400000,
    },
    {
      id: "note-" + uid(),
      title: "Economics Paper Topic Brainstorm",
      content: `# Paper Topic Candidates\n\n- [x] 2018 vs 2022 monetary policy comparison - selected\n- [ ] Impact of Fed quantitative easing on emerging markets\n- [ ] Transmission effects of China LPR reform\n\n## Sources\n- Mankiw Ch15\n- IMF WEO 2023\n- Fed FOMC minutes\n\n## Structure\n1. Intro - background\n2. Lit review - 2-3 core papers\n3. Analysis framework - IS-LM + Phillips\n4. Case comparison\n5. Conclusion + policy recommendations`,
      tags: ["ECON101", "paper"],
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    },
  ];

  return { ddls, notes };
}
