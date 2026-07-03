// ============================================================
// lib/mock-pipeline.ts — frontend mock processing flow that returns DDL items.
// Phase 4 can replace this with a real Inngest/SSE/polling workflow.
// ============================================================

import type { DdlItem, PipelineStep, UploadedFile } from "./types";

export const INITIAL_STEPS: PipelineStep[] = [
  { id: "ocr", label: "Parse document with OCR", status: "pending" },
  { id: "extract", label: "Extract DDL items with AI", status: "pending" },
  { id: "calendar", label: "Write to calendar", status: "pending" },
  { id: "persist", label: "Save to database", status: "pending" },
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

// Mock DDL dataset. Production data should come from AI extraction.
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
  // Pick 5-8 items so each demo run is slightly different.
  const count = 5 + Math.floor(Math.random() * 4);
  const shuffled = [...MOCK_DDL_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((tpl) => ({
    ...tpl,
    id: uid(),
    source: file.name,
    completed: false,
  }));
}
