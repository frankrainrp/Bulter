import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function toolBlock(source) {
  const start = source.indexOf('name: "create_custom_panel"');
  const end = source.indexOf('name: "create_recurring_task"', start);
  assert.notEqual(start, -1, "create_custom_panel tool must exist");
  assert.notEqual(end, -1, "following tool boundary must exist");
  return source.slice(start, end);
}

test("AI Web Panel schema supports either HTTPS or self-contained HTML", async () => {
  const [frontend, backend] = await Promise.all([
    read("apps/web/src/lib/ai-tools.ts"),
    read("apps/api/src/services/ChatToolDefinitions.ts"),
  ]);

  for (const schema of [toolBlock(frontend), toolBlock(backend)]) {
    assert.match(schema, /required:\s*\["label"\]/);
    assert.match(schema, /HTTPS/);
    assert.match(schema, /html:\s*\{/);
    assert.match(schema, /self-contained/i);
    assert.doesNotMatch(schema, /kind:\s*\{/);
    assert.doesNotMatch(schema, /modules:\s*\{/);
  }
});

test("AI executor validates one source and always creates an iframe panel", async () => {
  const source = await read("apps/web/src/lib/tool-executor.ts");
  const start = source.indexOf("function execCreateCustomPanel");
  const end = source.indexOf("function execCreateRecurring", start);
  const block = source.slice(start, end);

  assert.match(block, /normalizePanelUrl/);
  assert.match(block, /normalizePanelHtml/);
  assert.match(block, /kind:\s*"iframe"/);
  assert.match(block, /exactly one of url or html/);
  assert.match(block, /interactive web app/);
  assert.doesNotMatch(block, /args\.modules|args\.content|args\.kind|spec/);
});

test("retired App panels and cryptocurrency fallback are fully disconnected", async () => {
  const [view, types, schema, route] = await Promise.all([
    read("apps/web/src/components/CustomPanelView.tsx"),
    read("apps/web/src/lib/types.ts"),
    read("apps/web/src/lib/panel-schema.ts"),
    read("apps/api/src/routes/CustomPanelRoutes.ts"),
  ]);
  assert.doesNotMatch(view, /cpv\.kind\.app|GeneratedPanelView|SAMPLE_SPEC|kind === "generated"/);
  assert.doesNotMatch(types, /"generated"|\bspec\?:/);
  assert.doesNotMatch(schema, /SAMPLE_SPEC|Crypto Top 10|CoinGecko/);
  assert.match(route, /data\.kind": "generated"/);
  assert.match(route, /data\.spec/);
  assert.match(route, /retired App panel format/);
  await assert.rejects(access(new URL("../apps/web/src/components/GeneratedPanelView.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../apps/web/src/components/DataSourceBuilder.tsx", import.meta.url)));
});

test("AI-authored HTML runs in a network-isolated iframe", async () => {
  const [view, helper] = await Promise.all([
    read("apps/web/src/components/CustomPanelView.tsx"),
    read("apps/web/src/lib/panel-url.ts"),
  ]);
  assert.match(view, /srcDoc=\{webAppHtml\}/);
  assert.match(view, /sandbox="allow-scripts"/);
  assert.doesNotMatch(view, /srcDoc[\s\S]{0,200}allow-same-origin/);
  assert.match(helper, /Content-Security-Policy/);
  assert.match(helper, /connect-src 'none'/);
});

test("panel source normalizers reject unsafe or incomplete input", async () => {
  const { buildSandboxedWebApp, normalizePanelHtml, normalizePanelUrl } = await import("../apps/web/src/lib/panel-url.ts");
  assert.equal(normalizePanelUrl("javascript:alert(1)"), "");
  assert.equal(normalizePanelUrl("example.com"), "https://example.com/");
  assert.equal(normalizePanelHtml("hello"), "");
  assert.match(normalizePanelHtml("```html\n<div>game</div>\n```"), /^<div>/);
  const sandboxed = buildSandboxedWebApp("<html><body><button>Play</button><script>1</script></body></html>");
  assert.match(sandboxed, /Content-Security-Policy/);
  assert.match(sandboxed, /connect-src 'none'/);
});

test("AI-authored panel HTML has no app-specific character ceiling", async () => {
  const { normalizePanelHtml } = await import("../apps/web/src/lib/panel-url.ts");
  const largeHtml = `<html><body><script>${"const value = 1;".repeat(10_000)}</script></body></html>`;
  assert.ok(largeHtml.length > 100_000);
  assert.equal(normalizePanelHtml(largeHtml), largeHtml);

  const helper = await read("apps/web/src/lib/panel-url.ts");
  assert.doesNotMatch(helper, /html\.length\s*[><=]/);
});

test("chat output ceiling can carry a complete HTML mini app", async () => {
  const source = await read("apps/api/src/services/ChatService.ts");
  assert.match(source, /max_tokens:\s*8192/);
  assert.match(source, /actual tokens/);
});

test("share card is responsive and exports a real PNG", async () => {
  const source = await read("apps/web/src/components/mini-apps/ShareCard.tsx");
  assert.match(source, /renderPng/);
  assert.match(source, /canvas\.toBlob/);
  assert.match(source, /navigator\.share/);
  assert.match(source, /aspectRatio/);
  assert.doesNotMatch(source, /scale\(0\.55\)|marginBottom:\s*-360|linearGradient/);
});
