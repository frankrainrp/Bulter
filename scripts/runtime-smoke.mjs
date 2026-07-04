import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

const RootDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const MongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/c270_fa_runtime_test";

async function Main() {
  const port = await GetFreePort();
  const child = spawn("node", ["apps/api/dist/server.js"], {
    cwd: RootDir,
    env: {
      ...process.env,
      PORT: String(port),
      MONGO_URL: MongoUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await WaitForHealth(baseUrl);

    const health = await ReadJson(`${baseUrl}/api/health`);
    assert.equal(health.ok, true);
    assert.equal(health.data.service, "c270-fa-agent-api");
    assert.equal(health.data.mongoReadyState, 1);

    const auth = await WriteJson(`${baseUrl}/api/auth/signup`, {
      email: `runtime-${Date.now()}@example.com`,
      password: "runtime-pass-123",
      name: "Runtime Smoke",
    }, { method: "POST" });
    assert.equal(auth.body.ok, true);
    const cookie = ReadSetCookie(auth.response);
    assert.ok(cookie.includes("butler_session="));

    const writeBody = {
      sessions: [{ id: "sess-runtime", title: "runtime smoke", createdAt: 1000, updatedAt: 2000 }],
      messages: [{
        id: "msg-runtime",
        sessionId: "sess-runtime",
        role: "user",
        content: "hello mongo",
        timestamp: "2026-07-01T00:00:00.000Z",
      }],
    };

    const written = await WriteJson(`${baseUrl}/api/chat/history`, writeBody, { cookie });
    assert.equal(written.ok, true);

    const readBack = await ReadJson(`${baseUrl}/api/chat/history`, cookie);
    assert.equal(readBack.ok, true);
    assert.equal(readBack.data.sessions[0].id, "sess-runtime");
    assert.equal(readBack.data.messages[0].id, "msg-runtime");
    assert.equal(readBack.data.messages[0].content, "hello mongo");

    const cleared = await WriteJson(`${baseUrl}/api/chat/history`, { sessions: [], messages: [] }, { cookie });
    assert.equal(cleared.ok, true);

    console.log("runtime smoke passed");
  } catch (error) {
    console.error(stdout);
    console.error(stderr);
    throw error;
  } finally {
    child.kill("SIGTERM");
  }
}

function GetFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not allocate a free port."));
      });
    });
  });
}

async function WaitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await ReadJson(`${baseUrl}/api/health`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("API did not become healthy in time.");
}

async function ReadJson(url, cookie = "") {
  const response = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function WriteJson(url, body, options = {}) {
  const response = await fetch(url, {
    method: options.method || "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const parsed = await response.json();
  return options.method ? { body: parsed, response } : parsed;
}

function ReadSetCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  return raw.split(";")[0] || "";
}

Main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
