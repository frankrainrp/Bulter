import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function requirePath(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return target;
}

function requireText(relativePath, pattern, label) {
  const target = requirePath(relativePath);
  const content = fs.readFileSync(target, "utf8");
  if (!pattern.test(content)) {
    throw new Error(`${relativePath} does not satisfy: ${label}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(requirePath("package.json"), "utf8"));
if (packageJson.packageManager !== "pnpm@9.0.0") {
  throw new Error("packageManager must stay pinned to pnpm@9.0.0 for reproducible installs.");
}

const turboJson = JSON.parse(fs.readFileSync(requirePath("turbo.json"), "utf8"));
if (!turboJson.tasks || turboJson.pipeline) {
  throw new Error("turbo.json must use the Turbo 2.x tasks field, not pipeline.");
}

requirePath("pnpm-lock.yaml");
requirePath("Dockerfile");
requirePath("docker-compose.yml");
requirePath(".github/workflows/ci.yml");
requirePath("ansible/deploy-butler.yml");
requirePath("docs/C270_FINAL_REPORT.md");
requirePath("apps/web/src/app/api/health/route.ts");

requireText("Dockerfile", /node:20-alpine/, "Node 20 container baseline");
requireText("docker-compose.yml", /healthcheck:/, "container health check");
requireText(".github/workflows/ci.yml", /pnpm audit --audit-level critical/, "DevSecOps dependency scan");
requireText("apps/web/src/app/api/health/route.ts", /status:\s*"ok"/, "health route returns ok");

if (fs.existsSync(path.join(root, "apps/web/.env.local"))) {
  throw new Error("apps/web/.env.local must not be included in the submission package.");
}

console.log("C270 DevOps validation passed.");
