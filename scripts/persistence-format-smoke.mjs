import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

const RootDir = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const MongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/c240_fa_persistence_format_test";
const ResetDbBeforeRun = process.argv.includes("--reset-db") || process.env.PERSISTENCE_RESET_DB === "1";
const CleanupDbAfterRun = process.argv.includes("--cleanup-db") || process.env.PERSISTENCE_CLEANUP_DB === "1";

process.env.MONGO_URL = MongoUrl;

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

  const baseUrl = `http://127.0.0.1:${port}`;
  let connection;

  try {
    const { ConnectMongo } = await import("../apps/api/dist/db/MongoDb.js");
    connection = await ConnectMongo();
    if (ResetDbBeforeRun) {
      await connection.db.dropDatabase();
    }

    await WaitForHealth(baseUrl);

    const email = `persistence-${Date.now()}@example.com`;
    const signup = await RequestJson(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      body: {
        email: email.toUpperCase(),
        password: "Password123!",
        name: "Persistence Tester",
      },
    });
    assert.equal(signup.status, 201);
    assert.equal(signup.json.ok, true);
    assert.equal(signup.json.data.user.email, email);

    const cookie = CookiePair(signup.setCookie);
    assert.match(cookie, /^butler_session=/);

    const me = await RequestJson(`${baseUrl}/api/auth/me`, { cookie });
    assert.equal(me.json.ok, true);
    assert.equal(me.json.data.user.email, email);

    const blobPayload = {
      id: "blob-format-1",
      dataUrl: "data:text/plain;base64,SGVsbG8=",
      name: "hello.txt",
      mime: "text/plain",
      createdAt: 1783065600000,
    };
    await ExpectOk(await RequestJson(`${baseUrl}/api/storage/blobs/blob-format-1`, {
      method: "PUT",
      cookie,
      body: blobPayload,
    }));

    const wallpaperPayload = {
      id: "current",
      kind: "image",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      updatedAt: 1783065600001,
    };
    await ExpectOk(await RequestJson(`${baseUrl}/api/storage/wallpapers/current`, {
      method: "PUT",
      cookie,
      body: wallpaperPayload,
    }));

    const taskPayload = {
      id: "task-format-1",
      taskName: "Persistence task",
      weight: 25,
      dueDate: "2026-07-03",
      dueTime: "23:59",
      description: "Task format smoke",
      isGroupWork: false,
      source: "format-test",
      completed: false,
      status: "todo",
      tags: ["format", "mongo"],
      priority: "high",
      notes: "Needs permanent attachments",
      attachments: [{
        id: "att-format-1",
        kind: "blob",
        label: "hello.txt",
        ref: "blob-format-1",
        mime: "text/plain",
        size: 5,
      }],
      noteId: null,
      recurringId: "rec-format-1",
    };
    const tasks = await RequestJson(`${baseUrl}/api/tasks/replace`, {
      method: "PUT",
      cookie,
      body: { items: [taskPayload] },
    });
    await ExpectOk(tasks);
    assert.equal(tasks.json.data[0].attachments[0].ref, "blob-format-1");
    assert.equal(tasks.json.data[0].recurringId, "rec-format-1");

    const notePayload = {
      id: "note-format-1",
      title: "Persistence note",
      content: "Markdown body",
      tags: ["format"],
      pinned: true,
      syncedTodos: ["review persistence"],
      vaultPath: "vault/persistence-note.md",
    };
    const notes = await RequestJson(`${baseUrl}/api/notes/replace`, {
      method: "PUT",
      cookie,
      body: { items: [notePayload] },
    });
    await ExpectOk(notes);
    assert.equal(notes.json.data[0].vaultPath, "vault/persistence-note.md");

    const chatPayload = {
      sessions: [{ id: "sess-format-1", title: "Persistence chat", createdAt: 1783065600002, updatedAt: 1783065600003 }],
      messages: [{
        id: "msg-format-1",
        sessionId: "sess-format-1",
        role: "user",
        content: "Attached file should survive refresh.",
        files: [{
          id: "file-format-1",
          name: "hello.txt",
          size: 5,
          mime: "text/plain",
          blobId: "blob-format-1",
        }],
        timestamp: "2026-07-03T00:00:00.000Z",
      }],
    };
    const chat = await RequestJson(`${baseUrl}/api/chat/history`, {
      method: "PUT",
      cookie,
      body: chatPayload,
    });
    await ExpectOk(chat);
    assert.equal(chat.json.data.messages[0].files[0].blobId, "blob-format-1");

    const panelPayload = {
      id: "custom-format-1",
      label: "Format",
      emoji: "DB",
      content: "Panel body",
      kind: "markdown",
      createdAt: 1783065600004,
      updatedAt: 1783065600005,
    };
    const panel = await RequestJson(`${baseUrl}/api/custom-panels/custom-format-1`, {
      method: "PUT",
      cookie,
      body: panelPayload,
    });
    await ExpectOk(panel);
    assert.equal(panel.json.data.kind, "markdown");

    const recurringPayload = {
      id: "rec-format-1",
      taskName: "Review persistence",
      cadence: "weekly",
      timesPerPeriod: 1,
      dueTime: "23:59",
      active: true,
      createdAt: 1783065600006,
      lastGeneratedPeriod: "w-2026-06-29",
    };
    const recurring = await RequestJson(`${baseUrl}/api/recurring/rec-format-1`, {
      method: "PUT",
      cookie,
      body: recurringPayload,
    });
    await ExpectOk(recurring);
    assert.equal(recurring.json.data.lastGeneratedPeriod, "w-2026-06-29");

    const agent = await RequestJson(`${baseUrl}/api/agent/run`, {
      method: "POST",
      cookie,
      body: {
        actionName: "AddTask",
        confirmed: true,
        data: {
          id: "task-agent-format-1",
          taskName: "Agent persistence task",
          dueDate: "2026-07-04",
          dueTime: "10:00",
          isGroupWork: false,
          completed: false,
          status: "todo",
          priority: "med",
          attachments: [{
            id: "att-agent-format-1",
            kind: "blob",
            label: "hello.txt",
            ref: "blob-format-1",
            mime: "text/plain",
            size: 5,
          }],
        },
      },
    });
    await ExpectOk(agent);
    assert.equal(agent.json.data.attachments[0].ref, "blob-format-1");

    const proof = await AssertMongoFormats(connection.db, { email });

    console.log("persistence format smoke passed");
    console.log(`database preserved: ${connection.db.databaseName}`);
    console.log(`proof user: ${email}`);
    console.log(`proof ownerId: ${proof.ownerId}`);
    console.log("proof ids: task-format-1, note-format-1, msg-format-1, blob-format-1, rec-format-1, custom-format-1");
  } catch (error) {
    console.error(stdout);
    console.error(stderr);
    throw error;
  } finally {
    child.kill("SIGTERM");
    if (connection) {
      if (CleanupDbAfterRun) {
        await connection.db.dropDatabase();
        console.log(`database cleaned: ${connection.db.databaseName}`);
      }
      await connection.close();
    }
  }
}

async function AssertMongoFormats(db, { email }) {
  const user = await db.collection("users").findOne({ email });
  assert.ok(user, "user document missing");
  assert.equal(user.email, email);
  assert.match(user.passwordHash, /^pbkdf2_sha256\$\d+\$/);

  const session = await db.collection("sessions").findOne({ userId: String(user._id) });
  assert.ok(session, "session document missing");
  assert.equal(typeof session.sessionId, "string");
  assert.ok(session.expiresAt instanceof Date);

  const task = await db.collection("tasks").findOne({ clientId: "task-format-1" });
  assert.ok(task, "task document missing");
  assert.equal(task.ownerId, String(user._id));
  assert.equal(task.taskName, "Persistence task");
  assert.equal(task.recurringId, "rec-format-1");
  assert.equal(task.attachments[0].kind, "blob");
  assert.equal(task.attachments[0].ref, "blob-format-1");
  assert.equal(task.attachments[0].size, 5);

  const agentTask = await db.collection("tasks").findOne({ clientId: "task-agent-format-1" });
  assert.ok(agentTask, "agent task document missing");
  assert.equal(agentTask.ownerId, String(user._id));
  assert.equal(agentTask.attachments[0].ref, "blob-format-1");

  const note = await db.collection("notes").findOne({ clientId: "note-format-1" });
  assert.ok(note, "note document missing");
  assert.equal(note.ownerId, String(user._id));
  assert.equal(note.vaultPath, "vault/persistence-note.md");
  assert.deepEqual(note.syncedTodos, ["review persistence"]);

  const chatSession = await db.collection("chatsessions").findOne({ clientId: "sess-format-1" });
  assert.ok(chatSession, "chat session document missing");
  assert.equal(chatSession.ownerId, String(user._id));
  assert.equal(chatSession.updatedAtMs, 1783065600003);

  const chatMessage = await db.collection("chatmessages").findOne({ clientId: "msg-format-1" });
  assert.ok(chatMessage, "chat message document missing");
  assert.equal(chatMessage.ownerId, String(user._id));
  assert.equal(chatMessage.files[0].blobId, "blob-format-1");
  assert.equal(chatMessage.files[0].mime, "text/plain");

  const customPanel = await db.collection("custompanels").findOne({ clientId: "custom-format-1" });
  assert.ok(customPanel, "custom panel document missing");
  assert.equal(customPanel.ownerId, String(user._id));
  assert.equal(customPanel.data.kind, "markdown");
  assert.equal(customPanel.data.content, "Panel body");

  const recurring = await db.collection("recurringtasks").findOne({ clientId: "rec-format-1" });
  assert.ok(recurring, "recurring task document missing");
  assert.equal(recurring.ownerId, String(user._id));
  assert.equal(recurring.data.cadence, "weekly");
  assert.equal(recurring.data.lastGeneratedPeriod, "w-2026-06-29");

  const blob = await db.collection("storageitems").findOne({ bucket: "blobs", clientId: "blob-format-1" });
  assert.ok(blob, "blob storage document missing");
  assert.equal(blob.ownerId, String(user._id));
  assert.equal(blob.data.dataUrl, "data:text/plain;base64,SGVsbG8=");
  assert.equal(blob.data.mime, "text/plain");

  const wallpaper = await db.collection("storageitems").findOne({ bucket: "wallpapers", clientId: "current" });
  assert.ok(wallpaper, "wallpaper storage document missing");
  assert.equal(wallpaper.ownerId, String(user._id));
  assert.equal(wallpaper.data.kind, "image");
  assert.match(wallpaper.data.dataUrl, /^data:image\/png;base64,/);

  const agentLog = await db.collection("agentlogs").findOne({ ownerId: String(user._id), actionName: "AddTask" });
  assert.ok(agentLog, "agent log document missing");
  assert.equal(agentLog.ownerId, String(user._id));
  assert.equal(agentLog.ok, true);
  assert.equal(agentLog.input.id, "task-agent-format-1");
  assert.equal(agentLog.result.attachments[0].ref, "blob-format-1");

  return { ownerId: String(user._id) };
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
      const health = await RequestJson(`${baseUrl}/api/health`);
      if (health.json.ok && health.json.data.mongoReadyState === 1) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("API did not become healthy in time.");
}

async function RequestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${JSON.stringify(json)}`);
  }
  return {
    status: response.status,
    json,
    setCookie: response.headers.get("set-cookie") || "",
  };
}

async function ExpectOk(result) {
  assert.equal(result.json.ok, true);
  return result.json.data;
}

function CookiePair(setCookie) {
  return setCookie.split(";")[0] || "";
}

Main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
