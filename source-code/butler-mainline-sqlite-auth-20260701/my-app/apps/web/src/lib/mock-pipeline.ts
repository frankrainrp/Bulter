// ============================================================
// lib/mock-pipeline.ts — 前端 Mock 处理流（4 步），完成后产出 DDL 列表
// Phase 4 接入真实 Inngest 工作流时整体替换为 SSE/Polling
// ============================================================

import type { DdlItem, PipelineStep, UploadedFile } from "./types";

export const INITIAL_STEPS: PipelineStep[] = [
  { id: "ocr",      label: "OCR 解析文档", status: "pending" },
  { id: "extract",  label: "AI 提取 DDL",  status: "pending" },
  { id: "calendar", label: "写入日历",      status: "pending" },
  { id: "persist",  label: "保存到数据库",   status: "pending" },
];

const STEP_DURATIONS: Record<PipelineStep["id"], number> = {
  ocr: 1500,
  extract: 2000,
  calendar: 1000,
  persist: 800,
};

const STEP_DETAILS: Record<PipelineStep["id"], string> = {
  ocr: "Marker → Markdown",
  extract: "DeepSeek-V4 Flash Structured Output",
  calendar: "Google Calendar API (write-only)",
  persist: "Drizzle ORM → PostgreSQL",
};

// 模拟 DDL 数据集（实际生产由 AI 提取）
const MOCK_DDL_TEMPLATES: Omit<DdlItem, "id" | "source" | "completed">[] = [
  { taskName: "Assignment 1: Sorting Algorithms",       weight: 15, dueDate: addDays(7),  dueTime: "23:59", description: "Submit via Blackboard, individual report", isGroupWork: false },
  { taskName: "Quiz 2: Data Structures",                 weight: 5,  dueDate: addDays(3),  dueTime: "14:00", description: "In-class quiz, closed book",              isGroupWork: false },
  { taskName: "Group Project Proposal",                  weight: 10, dueDate: addDays(14), dueTime: "17:00", description: "3-4 students per group, 2-page proposal", isGroupWork: true  },
  { taskName: "Lab Report 3: Linked Lists",              weight: 8,  dueDate: addDays(5),  dueTime: "23:59", description: "Submit PDF + source code",                isGroupWork: false },
  { taskName: "Midterm Exam",                            weight: 25, dueDate: addDays(21), dueTime: "09:00", description: "Venue: Main Hall, 2 hours",               isGroupWork: false },
  { taskName: "Assignment 2: Graph Algorithms",          weight: 15, dueDate: addDays(28), dueTime: "23:59", description: "Pair programming allowed",                isGroupWork: false },
  { taskName: "Final Project Presentation",              weight: 12, dueDate: addDays(45), dueTime: "10:00", description: "15 min presentation + 5 min Q&A",         isGroupWork: true  },
  { taskName: "Final Exam",                              weight: 30, dueDate: addDays(60), dueTime: "09:00", description: "Comprehensive, 3 hours",                  isGroupWork: false },
];

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export function getStepDuration(stepId: PipelineStep["id"]): number {
  return STEP_DURATIONS[stepId];
}

export function getStepDetail(stepId: PipelineStep["id"]): string {
  return STEP_DETAILS[stepId];
}

export function generateMockDdls(file: UploadedFile): DdlItem[] {
  // 随机选 5-8 条（让每次 demo 略有变化）
  const count = 5 + Math.floor(Math.random() * 4);
  const shuffled = [...MOCK_DDL_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((tpl) => ({
    ...tpl,
    id: uid(),
    source: file.name,
    completed: false,
  }));
}
