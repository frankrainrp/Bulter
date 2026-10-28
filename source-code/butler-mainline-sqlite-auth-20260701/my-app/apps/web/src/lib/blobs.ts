// ============================================================
// lib/blobs.ts — 附件文件二进制存储（Dexie blobs 表）
// ============================================================

import type { StoredBlob } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export async function saveBlob(file: File): Promise<StoredBlob> {
  const { getDb } = await import("./db");
  const record: StoredBlob = {
    id: uid(),
    data: file,
    mime: file.type || "application/octet-stream",
    name: file.name,
    createdAt: Date.now(),
  };
  await getDb().blobs.put(record);
  return record;
}

export async function getBlob(id: string): Promise<StoredBlob | undefined> {
  const { getDb } = await import("./db");
  return getDb().blobs.get(id);
}

export async function deleteBlob(id: string): Promise<void> {
  const { getDb } = await import("./db");
  await getDb().blobs.delete(id);
}

export async function deleteBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { getDb } = await import("./db");
  await getDb().blobs.bulkDelete(ids);
}

/** 生成 blob: URL，用于 iframe/img 预览。调用方记得 URL.revokeObjectURL 释放 */
export async function getBlobUrl(id: string): Promise<{ url: string; mime: string; name: string } | null> {
  const rec = await getBlob(id);
  if (!rec) return null;
  return { url: URL.createObjectURL(rec.data), mime: rec.mime, name: rec.name };
}
