// ============================================================
// packages/ai-core/src/prompts/extract-ddl.ts
// Prompt 资产：从多模态文档中提取 DDL（截止日期）信息
// 所有 Prompt 必须严格定义为 .ts 模块，禁止写死在业务代码中
// ============================================================
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * 构建用于提取 DDL 的系统 Prompt
 * @param documentMarkdown - 经 OCR 转换后的 Markdown 文本
 * @returns OpenAI 消息数组
 */
export function buildExtractDdlPrompt(
  documentMarkdown: string
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: `你是一个专业的学术助手，专门从大学课程文档中精准提取截止日期（DDL）信息。
请严格按照 JSON Schema 输出，不得输出任何额外解释文字。
当前时间：${new Date().toISOString()}`,
    },
    {
      role: "user",
      content: `请从以下文档内容中提取所有截止日期信息：\n\n${documentMarkdown}`,
    },
  ];
}
