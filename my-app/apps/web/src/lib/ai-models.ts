// Configurable primary and alternate Ollama inference routes.
// Compatibility IDs preserve saved preferences; environment overrides select actual models.

export type AiModelId =
  | "deepseek-v4-flash"
  | "deepseek-v4-thinking"
  | "claude"
  | "gpt"
  | "gemini";

export interface AiModelMeta {
  id: AiModelId;
  /** Model fallback used when no environment override is configured. */
  apiModel: string;
  /** Short route label. */
  label: string;
  /** Route subtitle. */
  tagline: string;
  /** Route description. */
  desc: string;
  /** Usage display tier. */
  tier: "low" | "mid" | "high";
  /** Whether the route supports structured tool calls. */
  supportsTools: boolean;
  /** Optional provider-specific reasoning parameters. */
  thinking?: {
    reasoningEffort: "high" | "max";
  };
  /** Reserved provider option without an active API adapter.*/
  placeholder?: boolean;
  /** Selects the configured server-side Ollama route. */
  route: "server" | "windows";
}

export const AI_MODELS: AiModelMeta[] = [
  {
    id: "deepseek-v4-flash",
    apiModel: "huihui_ai/qwen3-abliterated:30b",
    label: "Local Ollama",
    tagline: "Primary inference route",
    desc: "Uses the server-configured Ollama endpoint and model (OLLAMA_SERVER_MODEL).",
    tier: "low",
    supportsTools: true,
    route: "server",
  },
  {
    id: "deepseek-v4-thinking",
    apiModel: "huihui_ai/qwen3-abliterated:30b",
    label: "Alternate Ollama",
    tagline: "Optional fallback route",
    desc: "Uses an optional second endpoint; falls back to the primary route when unavailable.",
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

// Persisted model-selection key.
export const MODEL_STORAGE_KEY = "butler.selectedModel";
