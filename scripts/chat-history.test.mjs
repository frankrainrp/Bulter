import test from "node:test";
import assert from "node:assert/strict";
import { buildChatHistory } from "../apps/web/src/lib/chat-history.ts";

const row = (id, sessionId, role, content, extra = {}) => ({
  id,
  sessionId,
  role,
  content,
  timestamp: new Date(),
  ...extra,
});

test("chat history excludes file-pipeline prompts, errors, and other sessions", () => {
  const history = buildChatHistory([
    row("file", "a", "user", "convert this document", { files: [{ id: "f", name: "a.pdf", size: 1, mime: "application/pdf" }] }),
    row("other", "b", "user", "secret from another chat"),
    row("failed", "a", "assistant", "Error: Too many requests", { isError: true }),
    row("current", "a", "user", "teach me Python in seven days"),
  ], "a");

  assert.deepEqual(history, [{ role: "user", content: "teach me Python in seven days" }]);
});

test("newest unanswered user turn replaces an older failed intent", () => {
  const history = buildChatHistory([
    row("old", "a", "user", "old topic"),
    row("new", "a", "user", "new topic"),
  ], "a");
  assert.deepEqual(history, [{ role: "user", content: "new topic" }]);
});

test("normal alternating conversation history remains intact", () => {
  const history = buildChatHistory([
    row("u1", "a", "user", "question one"),
    row("a1", "a", "assistant", "answer one"),
    row("u2", "a", "user", "question two"),
  ], "a");
  assert.deepEqual(history, [
    { role: "user", content: "question one" },
    { role: "assistant", content: "answer one" },
    { role: "user", content: "question two" },
  ]);
});
