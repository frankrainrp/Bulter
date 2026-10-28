// ============================================================
// lib/ocr/providers.ts — OCR 服务商注册表
//
// 类似 ai-models.ts：可切换 OCR provider，价格 / 接入难度透明。
// 当前仅实现 Mistral；DeepSeek-VL / Tesseract 留接口位。
//
// 选用 provider：环境变量 OCR_PROVIDER=mistral（默认）/ deepseek-vl / tesseract
// ============================================================

export type OcrProviderId = "mistral" | "deepseek-vl" | "tesseract";

export interface OcrProviderMeta {
  id: OcrProviderId;
  label: string;
  /** 人话价格 */
  pricing: string;
  /** 需要的环境变量名（null = 不需要） */
  needsEnvKey: string | null;
  /** 成本档：low / mid / high */
  tier: "low" | "mid" | "high";
  /** 描述 + 适用场景 */
  desc: string;
  /** 是否已实现接入（false = 占位） */
  implemented: boolean;
}

export const OCR_PROVIDERS: OcrProviderMeta[] = [
  {
    id: "mistral",
    label: "Mistral OCR",
    pricing: "$0.001/页（1000 页 $1）",
    needsEnvKey: "MISTRAL_API_KEY",
    tier: "low",
    desc: "业内最便宜的专业 OCR，中文/表格/数学公式都强。推荐默认。",
    implemented: true,
  },
  {
    id: "deepseek-vl",
    label: "DeepSeek-VL（占位）",
    pricing: "复用 DEEPSEEK_API_KEY（按 token 算，约 ¥0.01-0.05/页）",
    needsEnvKey: "DEEPSEEK_API_KEY",
    tier: "low",
    desc: "复用现有 DeepSeek key 无需新申请。但非专业 OCR，复杂版面可能不如 Mistral。",
    implemented: false,
  },
  {
    id: "tesseract",
    label: "Tesseract.js（客户端）",
    pricing: "0 成本（首次下载 ~10MB 模型）",
    needsEnvKey: null,
    tier: "low",
    desc: "0 key 0 钱，但中文识别一般、复杂表格弱、速度慢（1-3s/页）。完全本地。",
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
