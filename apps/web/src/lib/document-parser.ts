// ============================================================
// lib/document-parser.ts — client document parsing for PDF, images, and OCR.
//
// Routing:
//   - Text PDFs    -> local unpdf parsing.
//   - Scanned PDFs -> /api/ocr through the configured OCR provider.
//   - image/*      -> /api/ocr through the configured OCR provider.
//   - Other files  -> unsupported-file error.
// ============================================================

import { extractText, getDocumentProxy } from "unpdf";
import { runOcr } from "./ocr";

export type ParseSource = "unpdf" | "ocr-mistral" | "ocr-deepseek-vl" | "ocr-tesseract";

export type ParseResult =
  | { ok: true; text: string; pages: number; source: ParseSource }
  | { ok: false; error: string; needsConfig?: boolean };

// If unpdf extracts less than this many non-space characters, fall back to OCR.
const SCANNED_TEXT_THRESHOLD = 50;

export async function parseDocument(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const mime = file.type;

  // ---- PDF ----
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const local = await parsePdfLocal(file);
    if (local.ok && local.text.replace(/\s+/g, "").length >= SCANNED_TEXT_THRESHOLD) {
      return { ok: true, text: local.text, pages: local.pages, source: "unpdf" };
    }
    const ocr = await runOcr(file);
    if (ocr.ok !== true) {
      return {
        ok: false,
        error: `This PDF appears to be scanned. unpdf extracted only ${local.ok ? local.text.length : 0} characters, so OCR is required: ${ocr.error}`,
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

  // ---- Other document types are not supported yet. ----
  return {
    ok: false,
    error: `Unsupported file type: ${mime || name}. Current support: PDF and image/*. DOCX/PPT support is planned for a later pass.`,
  };
}

/**
 * Local unpdf parsing. Returns ok:false on failure so the caller can choose a fallback.
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
// Keyword filtering for deadline-related document sections.
// ============================================================
const DDL_KEYWORDS = [
  "deadline", "due", "submit", "submission", "assessment", "assignment", "exam", "quiz",
  "project", "report", "presentation", "lab", "tutorial", "test",
  "week", "semester", "midterm", "final",
  "ddl",
  "%", "percent", "weight", "grade", "marks", "points", "ca", "fa", "sdcl", "mcq",
];

const KW_REGEX = new RegExp(DDL_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

/**
 * Split markdown into paragraphs and keep only deadline-related sections.
 * If nothing matches, fall back to the first chunk of the original text.
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
