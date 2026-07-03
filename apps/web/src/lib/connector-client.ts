"use client";

// ============================================================
// lib/connector-client.ts — 客户端取数（P1 引擎地基）
//
// fetchSource(source)：
//   - static → 直接返回内联 data
//   - http   → POST /express-api/connector 代理 → 按 source.path 取出目标数组/对象
// 统一返回 { ok, data } | { ok:false, error }，给 GeneratedPanelView 渲染。
// ============================================================

import type { DataSource } from "./panel-schema";
import { getByPath, asArray, applyTransforms } from "./panel-schema";
import { getLocalDataset } from "./panel-local";

export type SourceResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/** A1.1：对取到的数据应用 transforms（仅当是行数组时；非数组原样返回）*/
function withTransforms(source: DataSource, data: unknown): unknown {
  if (!source.transforms || source.transforms.length === 0) return data;
  if (data == null) return data;
  return applyTransforms(asArray(data), source.transforms);
}

export async function fetchSource(source: DataSource, signal?: AbortSignal): Promise<SourceResult> {
  if (source.kind === "static") {
    return { ok: true, data: withTransforms(source, source.data ?? []) };
  }
  // A1.2 local → 读本地用户数据注册表
  if (source.kind === "local") {
    if (!source.dataset) return { ok: false, error: "Local data source is missing dataset." };
    return { ok: true, data: withTransforms(source, getLocalDataset(source.dataset)) };
  }
  // http → 经后端连接器代理
  if (!source.url) return { ok: false, error: "HTTP data source is missing url." };
  try {
    const res = await fetch("/express-api/connector", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: source.url,
        method: source.method ?? "GET",
        headers: source.headers,
        query: source.query,
        body: source.body,
      }),
      signal,
    });
    const json = (await res.json()) as { ok: boolean; data?: unknown; error?: string };
    if (!json.ok) return { ok: false, error: json.error ?? "Connector request failed." };
    let extracted = getByPath(json.data, source.path);
    // pivot：键值对象 → 行数组（如汇率 {EUR:0.9} → [{currency:"EUR",rate:0.9}]）
    if (source.pivot && extracted && typeof extracted === "object" && !Array.isArray(extracted)) {
      const keyName = source.pivot.keyName || "key";
      const valueName = source.pivot.valueName || "value";
      extracted = Object.entries(extracted as Record<string, unknown>).map(([k, v]) => ({ [keyName]: k, [valueName]: v }));
    }
    return { ok: true, data: withTransforms(source, extracted) };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: false, error: "Cancelled" };
    return { ok: false, error: (e as Error).message };
  }
}
