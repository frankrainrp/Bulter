// ============================================================
// packages/workflows/src/process-document.ts
// Inngest 异步工作流：文档处理流水线
// 核心流程：接收上传事件 → OCR → 小模型过滤 → DDL 提取 → 写入日历 → 存库
// 原始文件经 S3 TTL 物理删除，本流水线仅处理临时访问
// ============================================================
import { inngest } from "./inngest-client";
import OpenAI from "openai";
import { buildExtractDdlPrompt } from "@smart-hub/ai-core";
import { DdlExtractionResultSchema } from "@smart-hub/ai-core";
import { getDbForTenant, ddlTasks, uploadLogs } from "@smart-hub/database";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 支持 DeepSeek 私有化托管
});

/**
 * 文档处理 Inngest 函数
 * 触发事件：document/uploaded
 */
export const processDocumentWorkflow = inngest.createFunction(
  { id: "process-document", name: "处理上传文档并提取 DDL" },
  { event: "document/uploaded" },
  async ({ event, step }) => {
    const { userId, tenantId, s3Key, originalFilename } = event.data as {
      userId: string;
      tenantId: string;
      s3Key: string;
      originalFilename: string;
    };

    // Step 1: OCR — 将文档从 S3 临时 URL 转为 Markdown
    const markdownContent = await step.run("ocr-document", async () => {
      // TODO: 接入开源 OCR 服务（如 Marker / Tesseract）
      // 当前为 Placeholder，实际应从 S3 临时 URL 下载并 OCR
      return `# ${originalFilename}\n\n作业：期末报告，截止日期：2024-12-20 23:59`;
    });

    // Step 2: AI 提取 DDL — 调用 DeepSeek/OpenAI，强类型 Zod 校验输出
    const extractionResult = await step.run("extract-ddl", async () => {
      const messages = buildExtractDdlPrompt(markdownContent);
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL ?? "deepseek-chat",
        messages,
        response_format: { type: "json_object" },
      });

      const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");
      // Zod 严格校验，校验失败直接抛出，Inngest 自动重试
      return DdlExtractionResultSchema.parse(raw);
    });

    // Step 3: 写入 Google/Outlook 日历（Write-only，零信任隔离）
    await step.run("push-to-calendar", async () => {
      for (const item of extractionResult.items) {
        // TODO: 调用 Google Calendar API（仅 write scope，不读取现有事件）
        console.log(`[Calendar] 写入事件: ${item.title} @ ${item.deadline}`);
      }
    });

    // Step 4: 持久化至租户独立数据库
    await step.run("persist-to-db", async () => {
      const db = getDbForTenant(tenantId);

      // 写入 DDL 任务
      await db.insert(ddlTasks).values(
        extractionResult.items.map((item) => ({
          userId,
          title: item.title,
          course: item.course,
          deadline: new Date(item.deadline),
          description: item.description,
          confidence: extractionResult.confidence,
        }))
      );

      // 写入上传日志（文件已删除，日志保留）
      await db.insert(uploadLogs).values({
        userId,
        originalFilename,
        s3Key,
        processedAt: new Date(),
      });
    });

    return { success: true, itemCount: extractionResult.items.length };
  }
);
