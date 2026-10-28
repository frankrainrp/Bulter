import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("project exposes a health endpoint for deployment monitoring", () => {
  const route = fs.readFileSync("apps/web/src/app/api/health/route.ts", "utf8");
  assert.match(route, /service:\s*"butler-web"/);
  assert.match(route, /status:\s*"ok"/);
});

test("final report maps Butler to all core C270 DevOps requirements", () => {
  const report = fs.readFileSync("docs/C270_FINAL_REPORT.md", "utf8");
  for (const required of [
    "Version Control",
    "CI/CD",
    "Docker",
    "Deployment",
    "Infrastructure as Code",
    "Testing",
    "DevSecOps",
    "Monitoring",
  ]) {
    assert.match(report, new RegExp(required, "i"));
  }
});

test("submission does not include local environment secrets", () => {
  assert.equal(fs.existsSync("apps/web/.env.local"), false);
});
