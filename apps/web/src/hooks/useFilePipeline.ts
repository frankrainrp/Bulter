"use client";

import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { TFunc } from "@/lib/i18n";
import { INITIAL_STEPS } from "@/lib/mock-pipeline";
import { makeBatch, makeChangeId, type PendingBatch, type PendingChange } from "@/lib/pending";
import type { ChatMessage, DdlItem, ProcessingPipeline, UploadedFile } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// Runs the attachment-to-review flow: parse/OCR the document, filter it for
// deadline-relevant text, ask the backend extractor for structured tasks, then
// stage the results in the same confirmation queue used by AI tool calls.
interface UseFilePipelineArgs {
  activeSessionIdRef: MutableRefObject<string | null>;
  addPendingBatch: (batch: PendingBatch) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  t: TFunc;
}

export function useFilePipeline({
  activeSessionIdRef,
  addPendingBatch,
  setMessages,
  t,
}: UseFilePipelineArgs) {
  const [pipelines, setPipelines] = useState<Record<string, ProcessingPipeline>>({});
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);

  const handleAttach = useCallback((fileList: FileList) => {
    const list: UploadedFile[] = Array.from(fileList).map((file) => ({
      id: uid(),
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      file,
    }));
    setAttachedFiles((prev) => [...prev, ...list]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const runRealPipeline = useCallback(async (uploaded: UploadedFile) => {
    const pipelineId = uid();
    const messageId = uid();
    const sid = activeSessionIdRef.current;
    if (!sid) return;

    const initial: ProcessingPipeline = {
      id: pipelineId,
      file: uploaded,
      steps: INITIAL_STEPS.map((step) => ({ ...step })),
      status: "running",
      startedAt: Date.now(),
    };
    setPipelines((prev) => ({ ...prev, [pipelineId]: initial }));
    setMessages((prev) => [
      ...prev,
      { id: messageId, sessionId: sid, role: "pipeline", content: "", pipelineId, timestamp: new Date() },
    ]);

    const setStep = (idx: number, status: "running" | "success" | "failed", detail?: string) => {
      setPipelines((prev) => {
        const cur = prev[pipelineId];
        if (!cur) return prev;
        return {
          ...prev,
          [pipelineId]: {
            ...cur,
            steps: cur.steps.map((step, i) => i === idx ? { ...step, status, ...(detail ? { detail } : {}) } : step),
          },
        };
      });
    };

    const finishPipeline = (status: "completed" | "failed", extractedCount?: number) => {
      setPipelines((prev) => {
        const cur = prev[pipelineId];
        if (!cur) return prev;
        return {
          ...prev,
          [pipelineId]: {
            ...cur,
            status,
            finishedAt: Date.now(),
            ...(extractedCount !== undefined ? { extractedCount } : {}),
          },
        };
      });
    };

    try {
      setStep(0, "running");
      if (!uploaded.file) throw new Error(t("pg.fileLost"));

      if (uploaded.file.size > 10 * 1024 * 1024) {
        setStep(0, "running", t("pg.bigFile", { mb: (uploaded.file.size / 1024 / 1024).toFixed(1) }));
      }

      // Load heavier parsing code only when a file is actually submitted.
      const { parseDocument, filterDdlRelevant } = await import("@/lib/document-parser");
      const parsed = await parseDocument(uploaded.file);
      if (parsed.ok !== true) {
        const hint = parsed.needsConfig ? t("pg.ocrHint") : "";
        setStep(0, "failed", parsed.error + hint);
        finishPipeline("failed");
        return;
      }

      const sourceLabel = parsed.source === "unpdf"
        ? t("pg.localParse")
        : parsed.source.startsWith("ocr-")
          ? `OCR (${parsed.source.replace("ocr-", "")})`
          : parsed.source;

      const keywordFiltered = filterDdlRelevant(parsed.text);
      let finalMd = keywordFiltered;
      let semDetail = t("pg.kwOnly");
      try {
        setStep(0, "running", t("pg.parseProgress", {
          label: sourceLabel,
          pages: parsed.pages,
          chars: parsed.text.length,
          kw: keywordFiltered.length,
        }));
        // Semantic filtering is an optimization. If it fails, keyword filtering
        // remains the safe fallback and the pipeline continues.
        const { filterBySemantic } = await import("@/lib/semantic-filter");
        const sem = await filterBySemantic(parsed.text, { topK: 30, minSim: 0.35 });
        if (sem.kept > 0) {
          finalMd = sem.text;
          semDetail = `-> semantic kept ${sem.kept}/${sem.total} segments, ${sem.text.length} chars (top sim ${sem.topSim.toFixed(2)})`;
        }
      } catch (e) {
        console.warn("semantic filter unavailable, fallback to keyword only:", e);
      }
      setStep(0, "success", t("pg.parseDone", {
        label: sourceLabel,
        pages: parsed.pages,
        chars: parsed.text.length,
        kw: keywordFiltered.length,
        sem: semDetail,
      }));

      setStep(1, "running");
      const today = new Date();
      const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      // The backend owns model calls and schema validation for extracted DDLs;
      // the browser only submits filtered markdown and receives safe items.
      const res = await fetch("/express-api/extract-ddls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: finalMd, filename: uploaded.name, currentDate: isoToday }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStep(1, "failed", json.error || t("pg.extractFail"));
        finishPipeline("failed");
        return;
      }

      const items: Array<Omit<DdlItem, "id" | "source" | "completed">> = json.items || [];
      setStep(1, "success", t("pg.extractN", { n: items.length }));

      setStep(2, "running");
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStep(2, "success", t("pg.calSkip"));

      setStep(3, "running");
      const newDdls: DdlItem[] = items.map((item) => ({
        ...item,
        id: uid(),
        source: `${uploaded.name} (pending review)`,
        completed: false,
        weight: item.weight ?? null,
        dueTime: item.dueTime || "23:59",
        description: item.description || "",
        isGroupWork: item.isGroupWork ?? false,
      }));

      const batch = makeBatch(
        sid,
        "pdf-extract",
        t("pg.pdfBatchIntro", { name: uploaded.name, n: newDdls.length }),
      );
      batch.changes = newDdls.map<PendingChange>((d) => ({
        id: makeChangeId(),
        kind: "create",
        summary: `${d.taskName} · ${d.dueDate || t("tasks.date.tbd")}${d.dueTime ? " " + d.dueTime : ""}${d.weight != null ? ` · ${d.weight}%` : ""}`,
        draft: d,
      }));
      addPendingBatch(batch);
      setStep(3, "success", `Detected ${newDdls.length} item(s) and added them to the review queue`);
      finishPipeline("completed", newDdls.length);
    } catch (err) {
      const msg = (err as Error).message;
      setPipelines((prev) => {
        const cur = prev[pipelineId];
        if (!cur) return prev;
        const newSteps = cur.steps.map((step) => (
          step.status === "running" ? { ...step, status: "failed" as const, detail: msg } : step
        ));
        return { ...prev, [pipelineId]: { ...cur, steps: newSteps, status: "failed", finishedAt: Date.now() } };
      });
    }
  }, [activeSessionIdRef, addPendingBatch, setMessages, t]);

  return {
    pipelines,
    attachedFiles,
    setAttachedFiles,
    handleAttach,
    handleRemoveAttachment,
    runRealPipeline,
  };
}
