// ============================================================
// lib/document-parser.ts — local text extraction for text-layer PDFs and plain text files.
//
// Routing:
//   - Text PDFs -> local unpdf parsing.
//   - text/*    -> browser File.text().
//   - Scans and images are intentionally unsupported: no paid OCR dependency.
// ============================================================

import { extractText, getDocumentProxy } from "unpdf";

export type ParseSource = "unpdf" | "text";

export type ParseResult =
  | { ok: true; text: string; pages: number; source: ParseSource }
  | { ok: false; error: string };

// Below this threshold the PDF is probably scanned or image-only.
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
    return {
      ok: false,
      error: `This PDF has no usable text layer (${local.ok ? local.text.length : 0} extracted characters). Scanned or image-only documents are not supported; export a searchable PDF first.`,
    };
  }

  // ---- Plain text ----
  if (mime.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(name)) {
    const text = await file.text();
    if (!text.trim()) return { ok: false, error: "The text file is empty." };
    return { ok: true, text, pages: 1, source: "text" };
  }

  // ---- Other document types are not supported yet. ----
  return {
    ok: false,
    error: `Unsupported file type: ${mime || name}. Current support: searchable PDF, TXT, Markdown, CSV, and JSON.`,
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
