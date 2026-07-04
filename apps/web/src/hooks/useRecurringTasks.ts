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
import { useToast } from "@/components/Toast";
import type { DdlItem, RecurringTask } from "@/lib/types";
import {
  bulkPutRecurring,
  getAllRecurring,
  materializeDue,
  putRecurring,
} from "@/lib/recurring";

interface UseRecurringTasksArgs {
  hydrated?: boolean;
  ddlsRef: MutableRefObject<DdlItem[]>;
  setDdls: Dispatch<SetStateAction<DdlItem[]>>;
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTags(tags?: string[]): string {
  return [...(tags ?? [])].map(normalizeText).filter(Boolean).sort().join(",");
}

function routineKey(routine: RecurringTask): string {
  return [
    normalizeText(routine.taskName),
    routine.cadence,
    Math.max(1, Math.min(routine.timesPerPeriod || 1, 31)),
    routine.dueTime || "23:59",
    normalizeText(routine.description),
    normalizeTags(routine.tags),
  ].join("|");
}

function isRecurringInstance(item: DdlItem): boolean {
  return Boolean(item.recurringId) || item.source === "Recurring task";
}

function recurringInstanceKey(item: DdlItem): string {
  return [
    normalizeText(item.taskName),
    item.dueDate || "",
    item.dueTime || "23:59",
    normalizeText(item.description),
    normalizeTags(item.tags),
  ].join("|");
}

function preferRecurringInstance(current: DdlItem, candidate: DdlItem): DdlItem {
  const currentDone = current.completed || current.status === "done";
  const candidateDone = candidate.completed || candidate.status === "done";
  return candidateDone && !currentDone ? candidate : current;
}

function dedupeRecurringInstances(items: DdlItem[]): { items: DdlItem[]; removed: number } {
  const out: DdlItem[] = [];
  const positions = new Map<string, number>();
  let removed = 0;

  for (const item of items) {
    if (!isRecurringInstance(item)) {
      out.push(item);
      continue;
    }

    const key = recurringInstanceKey(item);
    const existingIndex = positions.get(key);
    if (existingIndex === undefined) {
      positions.set(key, out.length);
      out.push(item);
      continue;
    }

    out[existingIndex] = preferRecurringInstance(out[existingIndex], item);
    removed += 1;
  }

  return { items: out, removed };
}

function mergeRecurringInstances(prev: DdlItem[], newTasks: DdlItem[]): { items: DdlItem[]; added: number; removed: number } {
  const dedupedPrev = dedupeRecurringInstances(prev);
  const seen = new Set(
    dedupedPrev.items
      .filter(isRecurringInstance)
      .map(recurringInstanceKey),
  );
  const toAdd: DdlItem[] = [];

  for (const task of newTasks) {
    const key = recurringInstanceKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    toAdd.push(task);
  }

  return {
    items: toAdd.length > 0 ? [...dedupedPrev.items, ...toAdd] : dedupedPrev.items,
    added: toAdd.length,
    removed: dedupedPrev.removed,
  };
}

export function useRecurringTasks({ hydrated, ddlsRef, setDdls }: UseRecurringTasksArgs) {
  const toast = useToast();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const materializeInFlightRef = useRef<Promise<void> | null>(null);
  const materializeRerunRequestedRef = useRef(false);

  const runMaterializeOnce = useCallback(async () => {
    try {
      const currentDedupe = dedupeRecurringInstances(ddlsRef.current);
      if (currentDedupe.removed > 0) {
        setDdls((prev) => dedupeRecurringInstances(prev).items);
      }

      const routines = await getAllRecurring();
      if (routines.length === 0) return;

      const { newTasks, updatedRoutines, changed } = materializeDue(routines);
      const preview = mergeRecurringInstances(currentDedupe.items, newTasks);
      if (preview.added > 0 || preview.removed > 0) {
        setDdls((prev) => mergeRecurringInstances(prev, newTasks).items);
      }
      if (preview.added > 0) {
        toast.info(`Generated ${preview.added} recurring task instance(s)`, { id: "recurring-materialize" });
      }
      if (changed) await bulkPutRecurring(updatedRoutines);
    } catch (e) {
      console.warn("[recurring] materialize failed", e);
    }
  }, [ddlsRef, setDdls, toast]);

  const runMaterialize = useCallback(async () => {
    if (materializeInFlightRef.current) {
      materializeRerunRequestedRef.current = true;
      return materializeInFlightRef.current;
    }

    const run = (async () => {
      do {
        materializeRerunRequestedRef.current = false;
        await runMaterializeOnce();
      } while (materializeRerunRequestedRef.current);
    })();

    materializeInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (materializeInFlightRef.current === run) {
        materializeInFlightRef.current = null;
      }
    }
  }, [runMaterializeOnce]);

  const addRecurring = useCallback((routine: RecurringTask) => {
    void (async () => {
      try {
        const routines = await getAllRecurring().catch(() => []);
        const existing = routines.find((item) => routineKey(item) === routineKey(routine));
        if (existing) {
          if (!existing.active) {
            await putRecurring({ ...existing, active: true, lastGeneratedPeriod: undefined });
          }
          await runMaterialize();
          return;
        }

        await putRecurring(routine);
        await runMaterialize();
      } catch (e) {
        console.warn("[recurring] add failed", e);
      }
    })();
  }, [runMaterialize]);

  useEffect(() => {
    if (!hydrated) return;

    void runMaterialize();
    const interval = setInterval(runMaterialize, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hydrated, runMaterialize]);

  return {
    recurringOpen,
    setRecurringOpen,
    runMaterialize,
    addRecurring,
  };
}
