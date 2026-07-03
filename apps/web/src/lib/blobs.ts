// ============================================================
// lib/blobs.ts — 附件文件存储（Express storage bucket）
// ============================================================

import type { StoredBlob } from "./types";
import { blobToDataUrl, dataUrlToBlob, deleteStorageItem, deleteStorageItems, getStorageItem, putStorageItem } from "./storage-client";

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const BUCKET = "blobs";

type StoredBlobPayload = Omit<StoredBlob, "data"> & { dataUrl: string };

export async function saveBlob(file: File): Promise<StoredBlob> {
  const id = uid();
  const dataUrl = await blobToDataUrl(file);
  const record: StoredBlob = {
    id,
    data: file,
    mime: file.type || "application/octet-stream",
    name: file.name,
    createdAt: Date.now(),
  };
  await putStorageItem<StoredBlobPayload>(BUCKET, id, {
    id,
    dataUrl,
    mime: record.mime,
    name: record.name,
    createdAt: record.createdAt,
  });
  return record;
}

export async function getBlob(id: string): Promise<StoredBlob | undefined> {
  const payload = await getStorageItem<StoredBlobPayload>(BUCKET, id);
  if (!payload) return undefined;
  return {
    id: payload.id,
    data: await dataUrlToBlob(payload.dataUrl),
    mime: payload.mime,
    name: payload.name,
    createdAt: payload.createdAt,
  };
}

export async function deleteBlob(id: string): Promise<void> {
  await deleteStorageItem(BUCKET, id);
}

export async function deleteBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await deleteStorageItems(BUCKET, ids);
}

/** 生成 blob: URL，用于 iframe/img 预览。调用方记得 URL.revokeObjectURL 释放 */
export async function getBlobUrl(id: string): Promise<{ url: string; mime: string; name: string } | null> {
  const rec = await getBlob(id);
  if (!rec) return null;
  return { url: URL.createObjectURL(rec.data), mime: rec.mime, name: rec.name };
}
