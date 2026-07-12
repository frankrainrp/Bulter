import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const RootDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const databaseName = `c240_chat_smoke_${Date.now()}`;
const mongoUrl = `mongodb://127.0.0.1:27017/${databaseName}`;

const apiPort = await freePort();
const providerPort = await freePort();
let capturedProviderBody = null;

const provider = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += String(chunk);
  capturedProviderBody = JSON.parse(raw || "{}");
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write(`data: ${JSON.stringify({
    id: "chatcmpl-smoke",
    object: "chat.completion.chunk",
    model: "deepseek-v4-flash",
    choices: [{ index: 0, delta: { content: "OK" }, finish_reason: null }],
  })}\n\n`);
  res.write(`data: ${JSON.stringify({
    id: "chatcmpl-smoke",
    object: "chat.completion.chunk",
    model: "deepseek-v4-flash",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
  })}\n\n`);
  res.end("data: [DONE]\n\n");
});
await new Promise((resolve) => provider.listen(providerPort, "127.0.0.1", resolve));

const api = spawn("node", ["apps/api/dist/server.js"], {
  cwd: RootDir,
  env: {
    ...process.env,
    PORT: String(apiPort),
    MONGO_URL: mongoUrl,
    CORS_ORIGIN: "http://localhost:3000",
    DEEPSEEK_API_KEY: "smoke-key",
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stdout = "";
let stderr = "";
api.stdout.on("data", (chunk) => { stdout += String(chunk); });
api.stderr.on("data", (chunk) => { stderr += String(chunk); });

const baseUrl = `http://127.0.0.1:${apiPort}`;
let dbConnection;
try {
  await waitForHealth(baseUrl);
  const signup = await requestJson(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    body: { email: `chat-smoke-${Date.now()}@example.com`, password: "Password123!", name: "Chat Smoke" },
  });
  assert.equal(signup.status, 201);
  const cookie = String(signup.setCookie || "").split(";", 1)[0];
  assert.match(cookie, /^butler_session=/);

  const session = { id: "smoke-session", title: "", createdAt: Date.now(), updatedAt: Date.now() };
  for (let i = 0; i < 105; i += 1) {
    const history = await requestJson(`${baseUrl}/api/chat/history`, {
      method: "PUT",
      cookie,
      body: { sessions: [session], messages: [] },
    });
    assert.equal(history.status, 200, `history write ${i + 1} was rate limited`);
  }

  process.env.MONGO_URL = mongoUrl;
  const { ConnectMongo } = await import("../apps/api/dist/db/MongoDb.js");
  dbConnection = await ConnectMongo();
  const before = await dbConnection.db.collection("apidailyusages").countDocuments({});
  assert.equal(before, 0, "history persistence must not consume AI daily quota");

  const chat = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      messages: [{ role: "user", content: "teach me Python in seven days" }],
      includeTools: false,
      model: "deepseek-v4-flash",
    }),
  });
  const streamText = await chat.text();
  assert.equal(chat.status, 200);
  assert.match(streamText, /"content":"OK"/);

  const after = await dbConnection.db.collection("apidailyusages").findOne({ scope: "ai-daily" });
  assert.equal(after?.count, 1, "one model completion should consume exactly one daily request");
  assert.equal(capturedProviderBody?.messages?.at(-1)?.content, "teach me Python in seven days");
  assert.match(capturedProviderBody?.messages?.[0]?.content || "", /latest user message is the current task/i);

  console.log("CHAT_RUNTIME_SMOKE=ok");
  console.log("HISTORY_WRITES_WITHOUT_AI_QUOTA=105");
  console.log("MODEL_COMPLETIONS_COUNTED=1");
} finally {
  if (dbConnection) {
    await dbConnection.db.dropDatabase();
    await dbConnection.close();
  }
  api.kill();
  await new Promise((resolve) => provider.close(resolve));
  if (api.exitCode && api.exitCode !== 0) {
    console.error(stdout);
    console.error(stderr);
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chat smoke API did not become healthy.");
}

async function requestJson(url, { method, body, cookie } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    setCookie: response.headers.get("set-cookie"),
  };
}
