// ============================================================
// packages/ai-core/src/index.ts
// AI Core 包公开 API 入口
// ============================================================
export { buildExtractDdlPrompt } from "./prompts/extract-ddl";
export {
  DdlItemSchema,
  DdlExtractionResultSchema,
  type DdlItem,
  type DdlExtractionResult,
} from "./schemas/ddl-schema";
