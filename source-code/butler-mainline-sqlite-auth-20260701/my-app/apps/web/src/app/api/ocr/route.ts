// ============================================================
// app/api/ocr/route.ts — 多模态 OCR 路由
//
// 当前实现：Mistral OCR (mistral-ocr-latest)
// 其他 provider (deepseek-vl / tesseract) 在 lib/ocr/providers.ts 留位
//
// 输入：FormData(file)
// 输出：{ ok, text, pages, provider, ocrUsed }
// 错误：{ ok: false, error, needsConfig? }
// ============================================================

import {
  DEFAULT_OCR_PROVIDER,
  isValidOcrProviderId,
  getOcrProviderMeta,
  type OcrProviderId,
} from "@/lib/ocr/providers";
import { rateLimited } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// SEC-09：只接受图片 / PDF，挡掉任意二进制被当文档转发给上游
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|bmp|tiff?)|application\/pdf)$/i;
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|pdf)$/i;

export async function POST(req: Request) {
  const limited = rateLimited(req, 10); // SEC-05：OCR 单价高，限额收紧到 10/10s
  if (limited) return limited;

  // 1. 选 provider（环境变量 OCR_PROVIDER，默认 mistral）
  const providerEnv = process.env.OCR_PROVIDER || DEFAULT_OCR_PROVIDER;
  const providerId: OcrProviderId = isValidOcrProviderId(providerEnv) ? providerEnv : DEFAULT_OCR_PROVIDER;
  const providerMeta = getOcrProviderMeta(providerId);

  if (!providerMeta.implemented) {
    return jsonErr(
      `OCR provider「${providerMeta.label}」尚未实现接入。请设置 OCR_PROVIDER=mistral 或等待后续版本。`,
      501,
      true,
    );
  }

  // 2. 检查环境变量
  if (providerMeta.needsEnvKey) {
    const key = process.env[providerMeta.needsEnvKey];
    if (!key || key.startsWith("sk-xxx") || key === "your-key-here") {
      return jsonErr(
        `OCR 需要配置 ${providerMeta.needsEnvKey}（${providerMeta.pricing}）。\n请在 apps/web/.env.local 中填入真实 key 后重启 dev server。\nMistral 注册：https://console.mistral.ai/`,
        500,
        true,
      );
    }
  }

  // 3. 解析 FormData
  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return jsonErr("缺少 file 字段", 400);
    file = f;
  } catch (err) {
    return jsonErr(`FormData 解析失败：${(err as Error).message}`, 400);
  }

  if (file.size === 0) return jsonErr("空文件", 400);
  if (file.size > MAX_BYTES) {
    return jsonErr(`文件过大：${(file.size / 1024 / 1024).toFixed(1)} MB（上限 50 MB）`, 413);
  }
  // SEC-09：类型校验（MIME 或扩展名命中其一即可，兼容浏览器空 MIME）
  if (!ALLOWED_MIME.test(file.type || "") && !ALLOWED_EXT.test(file.name || "")) {
    return jsonErr(`不支持的文件类型（仅图片 / PDF）：${file.type || file.name || "未知"}`, 415);
  }
  if (file.size > 10 * 1024 * 1024) {
    console.warn(`[ocr] 大文件 ${(file.size / 1024 / 1024).toFixed(1)} MB，可能较慢`);
  }

  // 4. 调 provider
  if (providerId === "mistral") {
    return runMistralOcr(file);
  }

  return jsonErr(`未知 provider：${providerId}`, 500);
}

// ============================================================
// Mistral OCR 实现
// Docs: https://docs.mistral.ai/capabilities/OCR/basic_ocr/
// ============================================================
async function runMistralOcr(file: File): Promise<Response> {
  const apiKey = process.env.MISTRAL_API_KEY!;
  const baseURL = process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1";

  // 转 base64 data URL（Mistral OCR 接受 image_url 或 document_url）
  let dataUrl: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    dataUrl = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
  } catch (err) {
    return jsonErr(`文件读取失败：${(err as Error).message}`, 500);
  }

  // Mistral OCR API 区分 PDF / image
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const documentField = isPdf
    ? { type: "document_url", document_url: dataUrl }
    : { type: "image_url", image_url: dataUrl };

  let mistralRes: Response;
  try {
    mistralRes = await fetch(`${baseURL}/ocr`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: documentField,
        include_image_base64: false,
      }),
    });
  } catch (err) {
    return jsonErr(`Mistral API 网络失败：${(err as Error).message}`, 502);
  }

  if (!mistralRes.ok) {
    let detail = `Mistral HTTP ${mistralRes.status}`;
    try {
      const j = await mistralRes.json();
      detail = j.message || j.error?.message || JSON.stringify(j).slice(0, 200);
    } catch { /* ignore */ }
    return jsonErr(`Mistral OCR 调用失败：${detail}`, 502);
  }

  let json: MistralOcrResponse;
  try {
    json = await mistralRes.json();
  } catch (err) {
    return jsonErr(`Mistral 响应解析失败：${(err as Error).message}`, 502);
  }

  // 合并所有页的 markdown
  const pages = Array.isArray(json.pages) ? json.pages : [];
  const text = pages.map((p) => p.markdown || "").join("\n\n").trim();

  if (!text) {
    return jsonErr("Mistral OCR 返回为空（可能是无法识别的图像或扫描质量过低）", 422);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      text,
      pages: pages.length || 1,
      provider: "mistral",
      ocrUsed: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ============================================================
// Mistral OCR 响应类型
// ============================================================
interface MistralOcrPage {
  index?: number;
  markdown?: string;
}
interface MistralOcrResponse {
  pages?: MistralOcrPage[];
  model?: string;
}

// ============================================================
// helper
// ============================================================
function jsonErr(error: string, status = 500, needsConfig = false): Response {
  return new Response(
    JSON.stringify({ ok: false, error, ...(needsConfig ? { needsConfig: true } : {}) }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
