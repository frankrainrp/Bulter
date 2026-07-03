import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const RootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function PathExists(relativePath) {
  return fs.existsSync(path.join(RootDir, relativePath));
}

function ReadText(relativePath) {
  return fs.readFileSync(path.join(RootDir, relativePath), "utf8");
}

function ReadJson(relativePath) {
  return JSON.parse(ReadText(relativePath));
}

function ListFiles(startRelativePath, predicate = () => true) {
  const startPath = path.join(RootDir, startRelativePath);
  if (!fs.existsSync(startPath)) return [];

  const result = [];
  const stack = [startPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".next", "dist", ".turbo", "build"].includes(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      const relativePath = path.relative(RootDir, fullPath).replaceAll(path.sep, "/");
      if (predicate(relativePath)) result.push(relativePath);
    }
  }
  return result.sort();
}

function AssertNoMatch(files, pattern, message) {
  const matches = files.filter((file) => pattern.test(ReadText(file)));
  assert.deepEqual(matches, [], message);
}

function SourceKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function LineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function StaticTextOfTemplate(node) {
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("${}");
}

function FindHanSourceText(relativePath, text, shouldVisit = () => true) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    SourceKindFor(relativePath),
  );
  const matches = [];
  const HanPattern = /[\u3400-\u9fff]/;

  function Push(node, kind, value) {
    if (!HanPattern.test(value)) return;
    matches.push({
      file: relativePath,
      line: LineOf(sourceFile, node),
      kind,
      text: value.replace(/\s+/g, " ").trim().slice(0, 160),
    });
  }

  function Visit(node) {
    if (!shouldVisit(node)) return;
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      Push(node, "string", node.text);
    }
    if (ts.isTemplateExpression(node)) {
      Push(node, "template", StaticTextOfTemplate(node));
    }
    if (ts.isJsxText(node)) {
      Push(node, "jsx", node.getText(sourceFile));
    }
    ts.forEachChild(node, Visit);
  }

  Visit(sourceFile);
  return matches;
}

function FindVariableInitializer(sourceFile, variableName) {
  let initializer = null;
  function Visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName
    ) {
      initializer = node.initializer ?? null;
      return;
    }
    ts.forEachChild(node, Visit);
  }
  Visit(sourceFile);
  return initializer;
}

const AppSourceFiles = ListFiles("apps", (file) => /\.(ts|tsx|js|jsx|json|yml|yaml)$/.test(file));
const AppCodeFiles = ListFiles("apps", (file) => /\.(ts|tsx|js|jsx)$/.test(file));
const PackageFiles = [
  "package.json",
  "pnpm-workspace.yaml",
  ...ListFiles("apps", (file) => file.endsWith("package.json")),
];

test("workspace keeps the target apps-only shape", () => {
  assert.equal(PathExists("apps/api/package.json"), true);
  assert.equal(PathExists("apps/web/package.json"), true);
  assert.equal(PathExists("packages"), false, "old packages workspace must not return");

  const workspace = ReadText("pnpm-workspace.yaml");
  assert.match(workspace, /apps\/\*/);
  assert.doesNotMatch(workspace, /packages\/\*/);
});

test("backend is Express plus Node plus MongoDB", () => {
  const pkg = ReadJson("apps/api/package.json");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  assert.ok(deps.express, "API must use Express");
  assert.ok(deps.mongoose, "API must use Mongoose/MongoDB");
  assert.ok(deps.typescript, "API must keep TypeScript compile checks");
});

test("frontend is no longer a Next API backend", () => {
  const nextRouteFiles = ListFiles("apps/web/src/app/api", (file) => file.endsWith("route.ts"));
  assert.deepEqual(nextRouteFiles, []);

  const nextConfig = ReadText("apps/web/next.config.js");
  assert.match(nextConfig, /express-api\/:path\*/);
  assert.match(nextConfig, /BUTLER_API_URL/);
});

test("old persistence and monorepo dependencies are removed", () => {
  const forbidden = [
    "@smart-hub/ai-core",
    "@smart-hub/database",
    "@smart-hub/workflows",
    "better-sqlite3",
    "dexie",
    "drizzle-kit",
    "drizzle-orm",
    "postgres",
  ];

  for (const file of PackageFiles) {
    const text = ReadText(file);
    for (const name of forbidden) {
      assert.doesNotMatch(text, new RegExp(`"${name}"`), `${name} still appears in ${file}`);
    }
  }

  AssertNoMatch(
    AppSourceFiles,
    /from\s+["']dexie["']|new\s+Dexie\b|getDb\(\)|better-sqlite3|drizzle-orm|postgres-js|@smart-hub\/(ai-core|database|workflows)/,
    "old storage or old workspace imports remain",
  );
});

test("core Express route and Mongo model files exist", () => {
  const requiredRoutes = [
    "AgentRoutes.ts",
    "AuthRoutes.ts",
    "ChatRoutes.ts",
    "ConnectorRoutes.ts",
    "CustomPanelRoutes.ts",
    "HealthRoutes.ts",
    "NoteRoutes.ts",
    "RecurringRoutes.ts",
    "StorageRoutes.ts",
    "TaskRoutes.ts",
  ];
  const requiredModels = [
    "ChatMessageModel.ts",
    "ChatSessionModel.ts",
    "CustomPanelModel.ts",
    "NoteModel.ts",
    "RecurringTaskModel.ts",
    "SessionModel.ts",
    "StorageItemModel.ts",
    "TaskModel.ts",
    "UserModel.ts",
  ];

  for (const file of requiredRoutes) {
    assert.equal(PathExists(`apps/api/src/routes/${file}`), true, `missing ${file}`);
  }
  for (const file of requiredModels) {
    assert.equal(PathExists(`apps/api/src/models/${file}`), true, `missing ${file}`);
  }
});

test("chat history is persisted through Express and MongoDB", () => {
  const chatRoutes = ReadText("apps/api/src/routes/ChatRoutes.ts");
  const chatService = ReadText("apps/api/src/services/ChatHistoryService.ts");
  const backendApi = ReadText("apps/web/src/lib/backend-api.ts");
  const page = ReadText("apps/web/src/app/page.tsx");

  assert.match(chatRoutes, /ChatRoutes\.get\(\s*["']\/history["']/);
  assert.match(chatRoutes, /ChatRoutes\.put\(\s*["']\/history["']/);
  assert.match(chatService, /ChatSessionModel/);
  assert.match(chatService, /ChatMessageModel/);
  assert.match(backendApi, /GetChatHistoryByApi/);
  assert.match(backendApi, /ReplaceChatHistoryByApi/);
  assert.match(page, /GetChatHistoryByApi/);
  assert.match(page, /ReplaceChatHistoryByApi/);

  assert.doesNotMatch(page, /butler\.sessions|butler\.messages|readLocalJson|writeLocalJson/);
});

test("docs do not describe the transformed project as still using old core storage", () => {
  const docs = [
    "README.md",
    "docs/migration-status.md",
  ].filter(PathExists).map(ReadText).join("\n");

  assert.doesNotMatch(docs, /still keeps its old Next\.js API routes/i);
  assert.doesNotMatch(docs, /conversation list.*localStorage|messages cache.*localStorage/i);
});

test("English-default runtime source has no hardcoded Chinese strings", () => {
  const ignoredFiles = new Set(["apps/web/src/lib/i18n.ts"]);
  const matches = [];

  for (const file of AppCodeFiles) {
    if (ignoredFiles.has(file)) continue;
    matches.push(...FindHanSourceText(file, ReadText(file)));
  }

  const i18nPath = "apps/web/src/lib/i18n.ts";
  const i18nText = ReadText(i18nPath);
  const i18nSource = ts.createSourceFile(i18nPath, i18nText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const enInitializer = FindVariableInitializer(i18nSource, "EN");
  assert.ok(enInitializer, "missing EN dictionary in i18n.ts");
  matches.push(...FindHanSourceText(i18nPath, i18nText, (node) => {
    const start = node.getStart(i18nSource);
    return start >= enInitializer.getStart(i18nSource) && start <= enInitializer.getEnd();
  }));

  assert.deepEqual(
    matches,
    [],
    "hardcoded Chinese text remains outside the zh locale dictionary",
  );
});
