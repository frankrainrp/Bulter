import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("document pipeline is local text extraction only", () => {
  const parser = read("apps/web/src/lib/document-parser.ts");
  const pipeline = read("apps/web/src/hooks/useFilePipeline.ts");
  const app = read("apps/api/src/app.ts");

  assert.match(parser, /getDocumentProxy/);
  assert.match(parser, /extractText/);
  assert.match(parser, /file\.text\(\)/);
  assert.match(parser, /Scanned or image-only documents are not supported/);
  assert.doesNotMatch(parser, /runOcr|\/express-api\/ocr|MISTRAL_API_KEY/);
  assert.match(pipeline, /import \{ filterDdlRelevant, parseDocument \}/);
  assert.doesNotMatch(pipeline, /import\("@\/lib\/document-parser"\)/);
  assert.doesNotMatch(app, /OcrRoutes|\/api\/ocr/);
});

test("paid OCR integration files are removed", () => {
  const removed = [
    "apps/api/src/routes/OcrRoutes.ts",
    "apps/api/src/services/OcrService.ts",
    "apps/web/src/lib/ocr/index.ts",
    "apps/web/src/lib/ocr/providers.ts",
  ];
  for (const path of removed) {
    assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} should not exist`);
  }
});
