"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ChatMessage, DdlItem, Note } from "@/lib/types";
import {
  applyBatch,
  extractCustomPanelDrafts,
  extractNoteDrafts,
  makeBatch,
  type PendingBatch,
  type PendingChange,
} from "@/lib/pending";
import { putCustomPanel } from "@/lib/custom-panels";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// Owns the review queue for AI/PDF-generated writes. Task changes, note drafts,
// and custom-panel drafts stay pending until the user accepts the batch.
interface UsePendingBatchesArgs {
  activeSessionIdRef: MutableRefObject<string | null>;
  ddlsRef: MutableRefObject<DdlItem[]>;
  setDdls: Dispatch<SetStateAction<DdlItem[]>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export function usePendingBatches({
  activeSessionIdRef,
  ddlsRef,
  setDdls,
  setNotes,
  setMessages,
}: UsePendingBatchesArgs) {
  const [pendingBatches, setPendingBatches] = useState<Record<string, PendingBatch>>({});
  const pendingBatchesRef = useRef(pendingBatches);
  const currentBatchIdRef = useRef<string | null>(null);
  // Guards against double-clicks or repeated accept events applying the same
  // batch more than once.
  const acceptedBatchIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pendingBatchesRef.current = pendingBatches;
  }, [pendingBatches]);

  const pushConfirmMessage = useCallback((sessionId: string, batchId: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: "msg-" + uid(),
        sessionId,
        role: "confirm",
        content: "",
        confirmBatchId: batchId,
        timestamp: new Date(),
      },
    ]);
  }, [setMessages]);

  const resetCurrentBatch = useCallback(() => {
    currentBatchIdRef.current = null;
  }, []);

  const addPendingBatch = useCallback((batch: PendingBatch) => {
    setPendingBatches((prev) => ({ ...prev, [batch.id]: batch }));
    pushConfirmMessage(batch.sessionId, batch.id);
  }, [pushConfirmMessage]);

  const addPendingChange = useCallback((change: PendingChange) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;

    // Tool calls in one assistant turn should appear as one confirmation card,
    // so subsequent changes append to the current batch until chat resets it.
    const existingBatchId = currentBatchIdRef.current;
    if (!existingBatchId) {
      const batch = makeBatch(sid, "ai-chat", "Please review the following proposed changes:");
      currentBatchIdRef.current = batch.id;
      setPendingBatches((prev) => ({ ...prev, [batch.id]: { ...batch, changes: [change] } }));
      pushConfirmMessage(sid, batch.id);
      return;
    }

    setPendingBatches((prev) => {
      const cur = prev[existingBatchId];
      if (!cur) return prev;
      return { ...prev, [existingBatchId]: { ...cur, changes: [...cur.changes, change] } };
    });
  }, [activeSessionIdRef, pushConfirmMessage]);

  const handleAcceptBatch = useCallback((batchId: string) => {
    if (acceptedBatchIdsRef.current.has(batchId)) return;

    const batch = pendingBatchesRef.current[batchId];
    if (!batch || batch.status !== "pending") return;
    acceptedBatchIdsRef.current.add(batchId);

    // Task changes update the task list first; other draft types are extracted
    // below because they belong to separate state/persistence paths.
    const { next, stats } = applyBatch(ddlsRef.current, batch);
    setDdls(next);

    const noteDrafts = extractNoteDrafts(batch);
    if (noteDrafts.length > 0) {
      setNotes((prevNotes) => {
        const existingIds = new Set(prevNotes.map((note) => note.id));
        const freshDrafts = noteDrafts.filter((note) => !existingIds.has(note.id));
        return freshDrafts.length > 0 ? [...freshDrafts, ...prevNotes] : prevNotes;
      });
    }

    const panelDrafts = extractCustomPanelDrafts(batch);
    if (panelDrafts.length > 0) {
      void (async () => {
        for (const panel of panelDrafts) {
          try {
            await putCustomPanel(panel);
          } catch (e) {
            console.warn("[pending] put custom panel failed", e);
          }
        }
      })();
    }

    console.log(
      "[pending] accepted batch",
      batchId,
      stats,
      noteDrafts.length > 0 ? `+${noteDrafts.length} notes` : "",
      panelDrafts.length > 0 ? `+${panelDrafts.length} custom panels` : "",
    );

    setPendingBatches((prev) => {
      const current = prev[batchId];
      if (!current || current.status !== "pending") return prev;
      return { ...prev, [batchId]: { ...current, status: "accepted" } };
    });
  }, [ddlsRef, setDdls, setNotes]);

  const handleRejectBatch = useCallback((batchId: string) => {
    setPendingBatches((prev) => {
      const batch = prev[batchId];
      if (!batch || batch.status !== "pending") return prev;
      return { ...prev, [batchId]: { ...batch, status: "rejected" } };
    });
  }, []);

  const handleDropChange = useCallback((batchId: string, changeId: string) => {
    setPendingBatches((prev) => {
      const batch = prev[batchId];
      if (!batch || batch.status !== "pending") return prev;
      return {
        ...prev,
        [batchId]: { ...batch, changes: batch.changes.filter((change) => change.id !== changeId) },
      };
    });
  }, []);

  return {
    pendingBatches,
    resetCurrentBatch,
    addPendingBatch,
    addPendingChange,
    handleAcceptBatch,
    handleRejectBatch,
    handleDropChange,
  };
}
