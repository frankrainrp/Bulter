// ============================================================
// lib/ocr/providers.ts — OCR provider registry.
//
// Similar to ai-models.ts: providers can be switched while keeping pricing
// and integration requirements visible.
// Mistral is implemented; DeepSeek-VL and Tesseract remain placeholders.
//
// Provider selection: OCR_PROVIDER=mistral (default) / deepseek-vl / tesseract.
// ============================================================

export type OcrProviderId = "mistral" | "deepseek-vl" | "tesseract";

export interface OcrProviderMeta {
  id: OcrProviderId;
  label: string;
  /** Human-readable pricing. */
  pricing: string;
  /** Required environment variable name. null means no key is required. */
  needsEnvKey: string | null;
  /** Cost tier. */
  tier: "low" | "mid" | "high";
  /** Description and suitable scenarios. */
  desc: string;
  /** false means the provider is still a placeholder. */
  implemented: boolean;
}

export const OCR_PROVIDERS: OcrProviderMeta[] = [
  {
    id: "mistral",
    label: "Mistral OCR",
    pricing: "$0.001/page ($1 per 1,000 pages)",
    needsEnvKey: "MISTRAL_API_KEY",
    tier: "low",
    desc: "Low-cost professional OCR with strong table and formula handling. Recommended default.",
    implemented: true,
  },
  {
    id: "deepseek-vl",
    label: "DeepSeek-VL (placeholder)",
    pricing: "Reuses DEEPSEEK_API_KEY; token-based pricing varies by page.",
    needsEnvKey: "DEEPSEEK_API_KEY",
    tier: "low",
    desc: "Can reuse an existing DeepSeek key, but it is not a dedicated OCR provider and may be weaker on complex layouts.",
    implemented: false,
  },
  {
    id: "tesseract",
    label: "Tesseract.js (client-side)",
    pricing: "No API cost; first run downloads an OCR model.",
    needsEnvKey: null,
    tier: "low",
    desc: "Fully local and keyless, but slower and weaker on complex tables.",
    implemented: false,
  },
];

export const DEFAULT_OCR_PROVIDER: OcrProviderId = "mistral";

export function getOcrProviderMeta(id: OcrProviderId): OcrProviderMeta {
  return OCR_PROVIDERS.find((p) => p.id === id) ?? OCR_PROVIDERS[0];
}

export function isValidOcrProviderId(id: string): id is OcrProviderId {
  return OCR_PROVIDERS.some((p) => p.id === id);
}
