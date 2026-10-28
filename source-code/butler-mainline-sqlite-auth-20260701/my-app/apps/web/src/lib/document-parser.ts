// ============================================================
// lib/document-parser.ts — 客户端文档解析（PDF / image / OCR 路由）
//
// 路由策略：
//   - 文字型 PDF       → unpdf 本地（免费、快）
//   - 扫描件 PDF       → /api/ocr (Mistral) — 用 detectScannedPdf 判断
//   - image/*          → /api/ocr (Mistral)
//   - 其他             → 报错
// ============================================================

import { extractText, getDocumentProxy } from "unpdf";
import { runOcr } from "./ocr";

export type ParseSource = "unpdf" | "ocr-mistral" | "ocr-deepseek-vl" | "ocr-tesseract";

export type ParseResult =
  | { ok: true; text: string; pages: number; source: ParseSource }
  | { ok: false; error: string; needsConfig?: boolean };

// 扫描件判定阈值：unpdf 输出 < 这个字数 → 走 OCR
const SCANNED_TEXT_THRESHOLD = 50;

export async function parseDocument(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const mime = file.type;

  // ---- PDF ----
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    // 先尝试 unpdf 本地
    const local = await parsePdfLocal(file);
    if (local.ok && local.text.replace(/\s+/g, "").length >= SCANNED_TEXT_THRESHOLD) {
      // 文字型 PDF：直接返回
      return { ok: true, text: local.text, pages: local.pages, source: "unpdf" };
    }
    // 扫描件 / 提取失败 → 走 OCR
    const ocr = await runOcr(file);
    if (ocr.ok !== true) {
      return {
        ok: false,
        error: `PDF 看起来是扫描件（unpdf 仅提取到 ${local.ok ? local.text.length : 0} 字符），需要 OCR：${ocr.error}`,
        needsConfig: ocr.needsConfig,
      };
    }
    return {
      ok: true,
      text: ocr.text,
      pages: ocr.pages,
      source: `ocr-${ocr.provider}` as ParseSource,
    };
  }

  // ---- image/* ----
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(name)) {
    const ocr = await runOcr(file);
    if (ocr.ok !== true) {
      return { ok: false, error: ocr.error, needsConfig: ocr.needsConfig };
    }
    return {
      ok: true,
      text: ocr.text,
      pages: ocr.pages,
      source: `ocr-${ocr.provider}` as ParseSource,
    };
  }

  // ---- 其他（docx/ppt 占位） ----
  return {
    ok: false,
    error: `暂不支持类型：${mime || name}（当前支持：PDF + image/*）。docx/ppt 待后续接入。`,
  };
}

/**
 * unpdf 本地解析。失败时返回 ok:false，调用方可决定是否 fallback。
 */
async function parsePdfLocal(file: File): Promise<{ ok: true; text: string; pages: number } | { ok: false; error: string }> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { ok: true, text, pages: totalPages };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================
// 关键词过滤（与之前一致，已 stable）
// ============================================================
const DDL_KEYWORDS = [
  "deadline", "due", "submit", "submission", "assessment", "assignment", "exam", "quiz",
  "project", "report", "presentation", "lab", "tutorial", "test",
  "week", "semester", "midterm", "final",
  "ddl", "截止", "提交", "考试", "作业", "测验", "周次", "学期", "期中", "期末",
  "%", "percent", "weight", "grade", "marks", "points", "ca", "fa", "sdcl", "mcq",
];

const KW_REGEX = new RegExp(DDL_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

/**
 * 把 markdown 按段落切分，只保留含 DDL 关键词的段落。
 * 通常能砍掉 60-80% 无关内容。若全文都没有匹配（少见），返回原文兜底。
 */
export function filterDdlRelevant(text: string): string {
  const cleaned = text
    .replace(/Official\s*\(?[\w\s\\\/]*\)?\s*Sensitive\s*Normal/gi, "")
    .replace(/\s{3,}/g, "\n\n");
  const paragraphs = cleaned.split(/\n{2,}|(?<=\.)\s{2,}/);
  const hits = paragraphs.filter((p) => p.trim().length > 0 && KW_REGEX.test(p));
  if (hits.length === 0) return text.slice(0, 8000);
  return hits.join("\n\n").slice(0, 8000);
}
