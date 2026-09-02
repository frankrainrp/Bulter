// ============================================================
// lib/ai-models.ts — 可切换的 AI 模型注册表
//
// 家庭部署只展示两个真实可用的本地推理路由：
// Ubuntu 家庭服务器（常在线）与 Windows RTX 5090（高性能）。
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
  /** 服务端据此选择对应的 Ollama 地址。 */
  route: "server" | "windows";
}

export const AI_MODELS: AiModelMeta[] = [
  {
    id: "deepseek-v4-flash",
    apiModel: "huihui_ai/qwen3-abliterated:30b",
    label: "Ubuntu 服务器 · 千问 30B",
    tagline: "默认 · 常在线",
    desc: "由家庭服务器 RTX 3060 上的 Ollama 运行；Windows 关机时仍可使用。",
    tier: "low",
    supportsTools: true,
    route: "server",
  },
  {
    id: "deepseek-v4-thinking",
    apiModel: "huihui_ai/qwen3-abliterated:30b",
    label: "Windows RTX 5090 · 千问 30B",
    tagline: "高速 · 电脑开机时",
    desc: "由 Windows RTX 5090 上的 Ollama 运行；电脑离线时自动回退到 Ubuntu 服务器。",
    tier: "mid",
    supportsTools: true,
    route: "windows",
  },
];

export const DEFAULT_MODEL_ID: AiModelId = "deepseek-v4-flash";

export function getModelMeta(id: AiModelId): AiModelMeta {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]!;
}

export function isValidModelId(id: string): id is AiModelId {
  return AI_MODELS.some((m) => m.id === id);
}

// localStorage 持久化 key
export const MODEL_STORAGE_KEY = "butler.selectedModel";
