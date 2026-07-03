// ============================================================
// lib/ai-models.ts — 可切换的 AI 模型注册表
//
// 当前只保留 V4 系列（旧 deepseek-chat / deepseek-reasoner 2026-07-24 弃用）
// 两个候选：V4 Flash（默认）/ V4 思考模式
// ============================================================

export type AiModelId =
  | "deepseek-v4-flash"
  | "deepseek-v4-thinking"
  | "claude"
  | "gpt"
  | "gemini";

export interface AiModelMeta {
  id: AiModelId;
  /** 实际传给 DeepSeek API 的 model 字段 */
  apiModel: string;
  /** 显示名（短，badge 用） */
  label: string;
  /** 副标题（下拉项里用） */
  tagline: string;
  /** 简短描述（下拉项里用） */
  desc: string;
  /** 估算成本档：low / mid / high */
  tier: "low" | "mid" | "high";
  /** 是否支持工具调用（toggle_complete 等） */
  supportsTools: boolean;
  /** V4 Thinking 模式参数（见 DeepSeek thinking_mode 官方文档） */
  thinking?: {
    reasoningEffort: "high" | "max";
  };
  /** #12 接口预留：下拉可见但暂未接入 API（点击不切换，提示敬请期待）*/
  placeholder?: boolean;
}

export const AI_MODELS: AiModelMeta[] = [
  {
    id: "deepseek-v4-flash",
    apiModel: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    tagline: "Default · lowest cost",
    desc: "Lightweight V4 model with fast responses and low input-token cost. Best for daily chat and task management.",
    tier: "low",
    supportsTools: true,
  },
  {
    id: "deepseek-v4-thinking",
    apiModel: "deepseek-v4-pro",
    label: "DeepSeek V4 Thinking",
    tagline: "Deep reasoning · medium cost",
    desc: "V4 Pro with thinking mode enabled. Stronger for complex analysis, math, and logic; slower but more accurate. reasoning_effort=high.",
    tier: "mid",
    supportsTools: true,
    thinking: { reasoningEffort: "high" },
  },
  // #12 多模型接口预留（观察.txt）：下拉里保留 Claude / GPT / Gemini 选项，
  // 暂未接入对应 API Key，点击不切换。接入后把 placeholder 去掉、apiModel/路由补上即可。
  {
    id: "claude",
    apiModel: "claude",
    label: "Claude",
    tagline: "API reserved · coming soon",
    desc: "Anthropic Claude support is reserved and will be enabled after an API key is configured.",
    tier: "high",
    supportsTools: true,
    placeholder: true,
  },
  {
    id: "gpt",
    apiModel: "gpt",
    label: "GPT",
    tagline: "API reserved · coming soon",
    desc: "OpenAI GPT support is reserved and will be enabled after an API key is configured.",
    tier: "high",
    supportsTools: true,
    placeholder: true,
  },
  {
    id: "gemini",
    apiModel: "gemini",
    label: "Gemini",
    tagline: "API reserved · coming soon",
    desc: "Google Gemini support is reserved and will be enabled after an API key is configured.",
    tier: "mid",
    supportsTools: true,
    placeholder: true,
  },
];

export const DEFAULT_MODEL_ID: AiModelId = "deepseek-v4-flash";

export function getModelMeta(id: AiModelId): AiModelMeta {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

export function isValidModelId(id: string): id is AiModelId {
  return AI_MODELS.some((m) => m.id === id);
}

// localStorage 持久化 key
export const MODEL_STORAGE_KEY = "butler.selectedModel";
