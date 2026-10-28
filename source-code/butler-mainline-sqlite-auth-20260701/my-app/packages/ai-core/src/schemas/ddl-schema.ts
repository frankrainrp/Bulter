// ============================================================
// packages/ai-core/src/schemas/ddl-schema.ts
// Zod 契约：AI 输出的强类型结构定义（DDL 提取结果）
// 所有 AI 输出必须经过此 Schema 校验，不得直接使用原始 JSON
// ============================================================
import { z } from "zod";

export const DdlItemSchema = z.object({
  taskName: z.string().describe("任务或评估的名称，例如：Assignment 1, Final Project, Quiz 2"),
  weight: z
    .number()
    .nullable()
    .describe("该任务占总成绩的百分比权重，范围 0-100。如果大纲中未提及，则返回 null"),
  dueDate: z
    .string()
    .describe("ISO 8601 格式的截止日期字符串（YYYY-MM-DD）。如果只有周数（如 Week 7），需结合当前学期开学时间推算"),
  dueTime: z
    .string()
    .default("23:59")
    .describe("具体截止时间，格式为 HH:MM。若未提及，默认返回 23:59"),
  description: z
    .string()
    .describe("对该任务要求的简短摘要或提交方式说明（如：Submit via Blackboard）"),
  isGroupWork: z.boolean().describe("是否为团队合作任务。true 表示小组作业，false 表示个人作业")
});

export const ModuleBriefAnalysisSchema = z.object({
  moduleCode: z.string().describe("课程代码，例如：CS101, MS4002"),
  moduleName: z.string().describe("课程标准名称"),
  academicYear: z.string().describe("学年与学期，例如：2025/2026 Semester 1"),
  deadlines: z.array(DdlItemSchema).describe("从大纲中提取出的所有关键截止日期列表")
});

// 导出类型给前端和工作流直接引用
export type DdlItem = z.infer<typeof DdlItemSchema>;
export type ModuleBriefAnalysis = z.infer<typeof ModuleBriefAnalysisSchema>;