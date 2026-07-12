import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("completed review groups close before later streamed changes arrive", () => {
  const batches = read("apps/web/src/hooks/usePendingBatches.ts");

  assert.match(
    batches,
    /acceptedBatchIdsRef\.current\.add\(batchId\);[\s\S]*currentBatchIdRef\.current === batchId[\s\S]*currentBatchIdRef\.current = null/,
  );
  assert.match(
    batches,
    /const handleRejectBatch[\s\S]*currentBatchIdRef\.current === batchId[\s\S]*currentBatchIdRef\.current = null/,
  );
});

test("all confirmation groups remain inside the scrollable chat message stream", () => {
  const chat = read("apps/web/src/components/ChatCanvas.tsx");
  const card = read("apps/web/src/components/ConfirmCard.tsx");

  assert.match(chat, /className="message-stream"[\s\S]*overflowY: "auto"/);
  assert.match(chat, /messages\.map[\s\S]*msg\.role === "confirm"[\s\S]*<ConfirmCard/);
  assert.doesNotMatch(chat, /dockedConfirmMessage|dockedConfirmBatch/);
  assert.doesNotMatch(card, /overflowY: "auto"|maxHeight: "min\(46vh/);
});
