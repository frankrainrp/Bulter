import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("AI routes use per-user daily and separated burst limits", () => {
  const app = read("apps/api/src/app.ts");
  const middleware = read("apps/api/src/middleware/RateLimitMiddleware.ts");
  const model = read("apps/api/src/models/ApiDailyUsageModel.ts");
  assert.match(app, /CreateDailyRateLimit\(\{ name: "ai-daily", max: 1000 \}\)/);
  assert.match(app, /name: "chat-completion"[\s\S]*max: 100[\s\S]*identity: "user"/);
  assert.match(app, /name: "generation"[\s\S]*max: 60[\s\S]*identity: "user"/);
  assert.match(app, /name: "connector"[\s\S]*max: 120[\s\S]*identity: "user"/);
  assert.doesNotMatch(app, /name: "ai"[\s\S]*max: 20/);
  assert.match(middleware, /ApiDailyUsageModel\.findOneAndUpdate/);
  assert.match(middleware, /Daily API request limit reached\. Your quota resets at midnight\./);
  assert.match(model, /ownerId: 1, day: 1, scope: 1[\s\S]*unique: true/);
});

test("free usage quota resets on the local calendar day, not every five hours", () => {
  const usage = read("apps/web/src/lib/usage.ts");
  const i18n = read("apps/web/src/lib/i18n.ts");
  assert.match(usage, /export const DAILY_BUDGET = 3/);
  assert.match(usage, /export function getDayResetAt/);
  assert.match(usage, /date\.getDate\(\) \+ 1/);
  assert.doesNotMatch(usage, /WINDOW_HOURS\s*=\s*5|WINDOW_MS\s*=/);
  assert.doesNotMatch(i18n, /5-hour window quota|every 5 hours|每 5 小时回满|5 小时窗口额度/);
});
