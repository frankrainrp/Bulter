"use client";

// ============================================================
// lib/research-client.ts — 多小队并行调研编排（P3）
//
// runResearch(goal, onProgress)：
//   1. plan：拆 3-4 个小队
//   2. investigate：Promise.all **并行** fan-out 各小队（真并行 = 并发 fetch）
//   3. assemble：代码确定性拼成 GeneratedPanelSpec
// onProgress 回调驱动「小队进度」UI（每个小队独立 running→done/error）。
// ============================================================

import type { GeneratedPanelSpec } from "./panel-schema";
import { assembleSpec, type ResearchPlan, type SquadFinding } from "./research-assembler";

export type SquadStatus = "pending" | "running" | "done" | "error";
export interface SquadState {
  title: string;
  question: string;
  status: SquadStatus;
}
export type ResearchPhase = "planning" | "investigating" | "assembling" | "done" | "error";
export interface ResearchProgress {
  phase: ResearchPhase;
  squads: SquadState[];
  error?: string;
}

export type ResearchResult =
  | { ok: true; spec: GeneratedPanelSpec }
  | { ok: false; error: string };

async function postJSON<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return (await res.json()) as T;
}

export async function runResearch(
  goal: string,
  onProgress: (p: ResearchProgress) => void,
  signal?: AbortSignal,
): Promise<ResearchResult> {
  // ---- 1. plan ----
  onProgress({ phase: "planning", squads: [] });
  let plan: ResearchPlan;
  try {
    const r = await postJSON<{ ok: boolean; plan?: ResearchPlan; error?: string }>(
      "/api/research/plan",
      { goal },
      signal,
    );
    if (r.ok !== true || !r.plan) {
      onProgress({ phase: "error", squads: [], error: r.error ?? "拆解失败" });
      return { ok: false, error: r.error ?? "拆解失败" };
    }
    plan = r.plan;
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "已取消" : (e as Error).message;
    onProgress({ phase: "error", squads: [], error: msg });
    return { ok: false, error: msg };
  }

  // ---- 2. investigate（并行）----
  const squads: SquadState[] = plan.squads.map((s) => ({ title: s.title, question: s.question, status: "pending" }));
  const emit = (phase: ResearchPhase) => onProgress({ phase, squads: squads.map((s) => ({ ...s })) });
  emit("investigating");

  const findings: (SquadFinding | null)[] = await Promise.all(
    plan.squads.map(async (sq, i) => {
      squads[i].status = "running";
      emit("investigating");
      try {
        const r = await postJSON<{ ok: boolean; finding?: SquadFinding }>(
          "/api/research/squad",
          { goal, squadTitle: sq.title, question: sq.question },
          signal,
        );
        if (r.ok === true && r.finding) {
          squads[i].status = "done";
          emit("investigating");
          return r.finding;
        }
        squads[i].status = "error";
        emit("investigating");
        return null;
      } catch {
        squads[i].status = "error";
        emit("investigating");
        return null;
      }
    }),
  );

  if (signal?.aborted) return { ok: false, error: "已取消" };

  // ---- 3. assemble（确定性，无 AI）----
  emit("assembling");
  const spec = assembleSpec(plan, findings);
  emit("done");
  return { ok: true, spec };
}
