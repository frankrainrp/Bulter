// ============================================================
// lib/butler-asset.ts — Phase C 用户自定义管家形象
//
// 用户上传 PNG/JPG → Canvas 白底抠图（threshold 240）→ getBBox crop →
// 存 IndexedDB butlerAssets 表 (poseName="default") → ButlerCharacter
// 优先用用户上传，否则回退到内置 7 姿势 PNG。
//
// 实现镜像 scripts/trim_butler_poses.py 的逻辑（PIL → Canvas API）。
// "default" 是 MVP：1 张图替换 7 姿势；后续可支持 perpose 上传。
// ============================================================

import { getDb } from "./db";
import type { ButlerAsset } from "./types";

export const DEFAULT_POSE_KEY = "default";
const WHITE_THRESHOLD = 240;
/** 上传上限 4MB（防 IndexedDB 撑爆） */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// ---------- Canvas 白底抠图 + bbox crop ----------

/** 把 File 解码为 HTMLImageElement */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片解码失败")); };
    img.src = url;
  });
}

interface TrimResult { blob: Blob; width: number; height: number }

/**
 * 客户端 trim：白底（threshold 240）→ alpha=0 → 找 bbox → crop 输出 PNG。
 * 镜像 scripts/trim_butler_poses.py 的 PIL 实现。
 */
async function trimAndCrop(file: File): Promise<TrimResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 4 MB`);
  }
  const img = await loadImage(file);

  // 第一遍：抠白底
  const c1 = document.createElement("canvas");
  c1.width = img.naturalWidth;
  c1.height = img.naturalHeight;
  const ctx1 = c1.getContext("2d", { willReadFrequently: true });
  if (!ctx1) throw new Error("Canvas 上下文不可用");
  ctx1.drawImage(img, 0, 0);

  const imgData = ctx1.getImageData(0, 0, c1.width, c1.height);
  const pixels = imgData.data;
  // 白底（near-white） → alpha=0
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      pixels[i + 3] = 0;
    }
  }
  // 同时找 bbox（避免再扫一遍）
  let minX = c1.width, minY = c1.height, maxX = 0, maxY = 0;
  let hasAny = false;
  for (let y = 0; y < c1.height; y++) {
    for (let x = 0; x < c1.width; x++) {
      const idx = (y * c1.width + x) * 4 + 3;
      if (pixels[idx] > 0) {
        hasAny = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!hasAny) throw new Error("抠图后图像全透明（可能是纯白图）");

  ctx1.putImageData(imgData, 0, 0);

  // 第二遍：crop
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const c2 = document.createElement("canvas");
  c2.width = cropW;
  c2.height = cropH;
  const ctx2 = c2.getContext("2d");
  if (!ctx2) throw new Error("Canvas 上下文不可用");
  ctx2.drawImage(c1, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const blob: Blob = await new Promise((resolve, reject) => {
    c2.toBlob((b) => b ? resolve(b) : reject(new Error("PNG 编码失败")), "image/png");
  });
  return { blob, width: cropW, height: cropH };
}

// ---------- IndexedDB CRUD ----------

export async function setCustomAsset(file: File, poseName: string = DEFAULT_POSE_KEY): Promise<ButlerAsset> {
  const { blob, width, height } = await trimAndCrop(file);
  const asset: ButlerAsset = {
    poseName,
    blob,
    width,
    height,
    updatedAt: Date.now(),
  };
  await getDb().butlerAssets.put(asset);
  dispatchAssetChange();
  return asset;
}

export async function getCustomAsset(poseName: string = DEFAULT_POSE_KEY): Promise<ButlerAsset | undefined> {
  return getDb().butlerAssets.get(poseName);
}

export async function getAllCustomAssets(): Promise<ButlerAsset[]> {
  return getDb().butlerAssets.toArray();
}

export async function clearCustomAsset(poseName: string = DEFAULT_POSE_KEY): Promise<void> {
  await getDb().butlerAssets.delete(poseName);
  dispatchAssetChange();
}

export async function clearAllCustomAssets(): Promise<void> {
  await getDb().butlerAssets.clear();
  dispatchAssetChange();
}

// ---------- 变更通知 ----------
// ButlerCharacter 监听此事件后重新加载自定义资产 → 即时换肤

export const BUTLER_ASSET_EVENT = "butler-asset-change";

function dispatchAssetChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUTLER_ASSET_EVENT));
}
