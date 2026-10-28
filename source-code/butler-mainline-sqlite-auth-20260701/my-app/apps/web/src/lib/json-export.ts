// ============================================================
// lib/json-export.ts — 任务列表 JSON 导出/导入
//
// 导出：一键下载 butler-tasks-YYYY-MM-DD.json（可放 iCloud/Dropbox 同步）
// 导入：从用户选的 .json 文件合并（按 id 去重，新数据覆盖旧）
// ============================================================

import type { DdlItem } from "./types";

interface ExportShape {
  version: 1;
  exportedAt: string;
  ddls: DdlItem[];
}

export function exportToJson(ddls: DdlItem[]): void {
  const payload: ExportShape = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ddls,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `butler-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File, existing: DdlItem[]): Promise<{ ok: true; merged: DdlItem[]; added: number; updated: number } | { ok: false; error: string }> {
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return { ok: false, error: "JSON 顶层不是对象" };
    const obj = parsed as Partial<ExportShape>;
    const incoming = obj.ddls;
    if (!Array.isArray(incoming)) return { ok: false, error: "缺少 ddls 数组" };

    const existingMap = new Map(existing.map((d) => [d.id, d]));
    let added = 0, updated = 0;
    for (const item of incoming) {
      if (!item || typeof item !== "object" || typeof (item as DdlItem).id !== "string") continue;
      const it = item as DdlItem;
      if (existingMap.has(it.id)) {
        existingMap.set(it.id, it);
        updated++;
      } else {
        existingMap.set(it.id, it);
        added++;
      }
    }
    return { ok: true, merged: Array.from(existingMap.values()), added, updated };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 触发隐藏 file input 让用户选 .json 文件 */
export function pickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const f = input.files?.[0] || null;
      resolve(f);
    };
    // 用户取消时 onchange 不触发；超时兜底
    setTimeout(() => resolve(null), 60_000);
    input.click();
  });
}
