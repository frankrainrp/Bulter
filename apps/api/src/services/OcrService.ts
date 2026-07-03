// Express/multer 传入 OCR 服务时使用的文件结构。
// 这里不依赖浏览器 File 类型，因为后端拿到的是内存 buffer。
export type OcrFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

// OCR 单文件上限。50MB 是后端硬拒边界，避免把超大文件转成 base64 后进一步放大内存和上游成本。
const MaxBytes = 50 * 1024 * 1024;
// 双重类型白名单：
// - AllowedMime 处理正常浏览器上传；
// - AllowedExt 兜底处理 mimetype 缺失或被浏览器标成 application/octet-stream 的情况。
const AllowedMime = /^(image\/(png|jpe?g|webp|gif|bmp|tiff?)|application\/pdf)$/i;
const AllowedExt = /\.(png|jpe?g|webp|gif|bmp|tiff?|pdf)$/i;

// OCR 统一入口。
// 当前只实现 Mistral OCR，但保留 OCR_PROVIDER 环境变量，为后续 DeepSeek-VL/Tesseract 接入留扩展点。
// 返回对象里带 status，路由层可以直接用 status 决定 HTTP 状态码。
export async function RunOcr(file: OcrFile | undefined) {
  // 先做本地文件校验，避免无效/危险文件被转发给上游 OCR。
  const valid = ValidateOcrFile(file);
  if (!valid.ok) return valid;
  if (!file) return { ok: false, status: 400, error: "Missing file field." };

  // provider 目前只有 mistral 真正可用。
  // 这里显式返回 501 + needsConfig，方便前端提示“配置不支持”而不是普通失败。
  const provider = process.env.OCR_PROVIDER || "mistral";
  if (provider !== "mistral") {
    return { ok: false, status: 501, error: `OCR provider ${provider} is not implemented. Use OCR_PROVIDER=mistral.`, needsConfig: true };
  }

  // Mistral key 是服务端密钥，绝不能放到前端。
  // 未配置时直接返回可识别的 needsConfig，让 UI 展示配置指引。
  if (!process.env.MISTRAL_API_KEY) {
    return { ok: false, status: 500, error: "MISTRAL_API_KEY is not configured.", needsConfig: true };
  }

  return RunMistralOcr(file);
}

// 校验上传文件是否适合 OCR。
// 安全目标：只允许图片/PDF，限制大小，拒绝空文件，防止任意二进制被转给外部供应商。
function ValidateOcrFile(file: OcrFile | undefined) {
  if (!file) return { ok: false as const, status: 400, error: "Missing file field." };
  if (file.size === 0) return { ok: false as const, status: 400, error: "Empty file." };
  if (file.size > MaxBytes) {
    return { ok: false as const, status: 413, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 50 MB.` };
  }

  // MIME 和扩展名命中一个即可通过。
  // 这不是为了放松安全，而是兼容不同浏览器/系统对扫描件 MIME 的识别差异。
  if (!AllowedMime.test(file.mimetype || "") && !AllowedExt.test(file.originalname || "")) {
    return { ok: false as const, status: 415, error: `Unsupported file type: ${file.mimetype || file.originalname || "unknown"}.` };
  }

  return { ok: true as const };
}

// 调用 Mistral OCR。
// Mistral 的 /ocr 接口要求把图片/PDF 放在 document 字段中：
// - PDF 使用 document_url；
// - 图片使用 image_url；
// 两者都可以用 data URL，所以这里直接把 multer buffer 转成 base64 data URL。
async function RunMistralOcr(file: OcrFile) {
  const baseUrl = process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1";
  // base64 会让体积膨胀约 33%，这也是 RunOcr 前面要先限制 50MB 的原因。
  const dataUrl = `data:${file.mimetype || "application/octet-stream"};base64,${file.buffer.toString("base64")}`;
  const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
  const document = isPdf ? { type: "document_url", document_url: dataUrl } : { type: "image_url", image_url: dataUrl };

  // include_image_base64=false 表示只要识别出的 markdown，不要把页面图片再回传，减少响应体积。
  const response = await fetch(`${baseUrl}/ocr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      include_image_base64: false,
    }),
  });

  if (!response.ok) {
    // 上游错误统一转成 502，表示我们自己的服务可用，但依赖的 OCR provider 调用失败。
    const detail = await ReadMistralError(response);
    return { ok: false, status: 502, error: `Mistral OCR failed: ${detail}` };
  }

  // Mistral 每页返回 markdown。这里把多页结果用空行拼接成一个完整文本，方便前端继续做摘要/DDL 抽取。
  const json = (await response.json()) as { pages?: { markdown?: string }[] };
  const pages = Array.isArray(json.pages) ? json.pages : [];
  const text = pages.map((page) => page.markdown || "").join("\n\n").trim();

  // 空文本通常说明扫描质量太低、图片内容不可识别，或上游返回了异常但 HTTP 仍为 200。
  if (!text) {
    return { ok: false, status: 422, error: "Mistral OCR returned empty text." };
  }

  return {
    ok: true,
    status: 200,
    text,
    pages: pages.length || 1,
    provider: "mistral",
    ocrUsed: true,
  };
}

// 尽量读取 Mistral 的结构化错误。
// 如果上游没有返回 JSON，则回退到 HTTP status，保证调用方总能拿到可展示的错误描述。
async function ReadMistralError(response: Response) {
  try {
    const json = (await response.json()) as { message?: string; error?: { message?: string } };
    return json.message || json.error?.message || JSON.stringify(json).slice(0, 200);
  } catch {
    return `HTTP ${response.status}`;
  }
}
