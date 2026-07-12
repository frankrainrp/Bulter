import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only model completions consume chat AI limits", () => {
  const app = read("apps/api/src/app.ts");
  assert.match(app, /app\.use\("\/api\/chat", RequireAuth\)/);
  assert.match(app, /app\.post\("\/api\/chat", chatRateLimit, dailyAiRateLimit\)/);
  assert.match(app, /app\.use\("\/api\/chat", ChatRoutes\)/);
  assert.doesNotMatch(app, /app\.use\("\/api\/chat", RequireAuth, chatRateLimit/);
});

test("streaming history persistence is debounced", () => {
  const dataHook = read("apps/web/src/hooks/useCoreAppData.ts");
  assert.match(dataHook, /window\.setTimeout\([\s\S]*ReplaceChatHistoryByApi[\s\S]*600/);
  assert.match(dataHook, /window\.clearTimeout\(timer\)/);
  assert.match(dataHook, /chatSyncQueueRef\.current = chatSyncQueueRef\.current/);
});

test("retry uses a synchronous request ref instead of a delayed DOM click", () => {
  const flow = read("apps/web/src/hooks/useChatFlow.ts");
  assert.match(flow, /retryRequestRef\.current = \{ content: userContent, baseMessages \}/);
  assert.match(flow, /void handleSend\(\)/);
  assert.doesNotMatch(flow, /querySelector\("#send-btn"\)|setTimeout\(\(\) => \{[\s\S]*btn\?\.click/);
});

test("system prompt prioritizes latest intent and separates documents", () => {
  const service = read("apps/api/src/services/ChatService.ts");
  assert.match(service, /latest user message is the current task/i);
  assert.match(service, /Document uploads are processed by a separate pipeline/);
  assert.match(service, /DeepSeek API rate limit reached/);
});

test("chat uses the authenticated profile instead of a hardcoded user name", () => {
  const page = read("apps/web/src/app/page.tsx");
  const flow = read("apps/web/src/hooks/useChatFlow.ts");
  const sessions = read("apps/web/src/hooks/useChatSessions.ts");
  assert.match(page, /userName: authProfile\.name/);
  assert.match(flow, /userName,/);
  assert.doesNotMatch(`${flow}\n${sessions}`, /userName: "Feng"/);
});
