// ============================================================
// lib/wallpaper.ts — [066] 壁纸系统
//
// root 背景可替换为用户上传的图片或视频，浮在玻璃胶囊之后。
// 图片/视频原始二进制存 IndexedDB（wallpapers 表，主键固定 "current"）。
// 暗化程度（保证玻璃上文字可读）存 localStorage。
// 无壁纸时回退到 globals.css 的 body 网格/光晕底。
// WallpaperLayer 监听 WALLPAPER_EVENT 即时换壁纸。
// ============================================================

import { getDb } from "./db";
import type { Wallpaper } from "./types";

export const WALLPAPER_ID = "current";
export const WALLPAPER_EVENT = "butler-wallpaper-change";

/** 上传上限：图片 10MB / 视频 60MB（IndexedDB 能扛，但别太离谱拖慢加载）*/
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

const DIM_KEY = "butler.wallpaper.dim";
const DEFAULT_DIM = 0.2;

// ---------- IndexedDB CRUD ----------

export async function setWallpaper(file: File): Promise<Wallpaper> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error("只支持图片或视频文件");
  }
  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    throw new Error(
      `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 ${cap / 1024 / 1024} MB`,
    );
  }
  const wp: Wallpaper = {
    id: WALLPAPER_ID,
    kind: isVideo ? "video" : "image",
    blob: file,
    updatedAt: Date.now(),
  };
  await getDb().wallpapers.put(wp);
  dispatchChange();
  return wp;
}

export async function getWallpaper(): Promise<Wallpaper | undefined> {
  return getDb().wallpapers.get(WALLPAPER_ID);
}

export async function clearWallpaper(): Promise<void> {
  await getDb().wallpapers.delete(WALLPAPER_ID);
  dispatchChange();
}

// ---------- 暗化（legibility scrim）----------

export function getWallpaperDim(): number {
  if (typeof window === "undefined") return DEFAULT_DIM;
  try {
    const v = localStorage.getItem(DIM_KEY);
    if (v === null) return DEFAULT_DIM;
    return Math.max(0, Math.min(0.7, parseFloat(v)));
  } catch {
    return DEFAULT_DIM;
  }
}

export function setWallpaperDim(v: number): void {
  try { localStorage.setItem(DIM_KEY, String(Math.max(0, Math.min(0.7, v)))); } catch { /* silent */ }
  dispatchChange();
}

// ---------- 变更通知 ----------

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLPAPER_EVENT));
}
