"use client";

// ============================================================
// components/WallpaperLayer.tsx — [066] 壁纸渲染层
//
// 固定全屏，z-index:-1（在 body 网格底之上、所有玻璃胶囊内容之下）。
// 有壁纸 → 渲染 <img>/<video> + 暗化遮罩；无壁纸 → 不渲染（露出 body 网格底）。
// 监听 WALLPAPER_EVENT 即时切换；ObjectURL 生命周期严格管理防泄漏。
// ============================================================

import React, { useEffect, useState } from "react";
import { getWallpaper, getWallpaperDim, WALLPAPER_EVENT } from "@/lib/wallpaper";

// 内置默认壁纸：管家纹样深绿底（用户未上传时铺这张，玻璃胶囊浮在其上）
const DEFAULT_WALLPAPER = "/assets/wallpaper.png";

type WpState = { kind: "image" | "video"; url: string } | null;

export default function WallpaperLayer() {
  const [wp, setWp] = useState<WpState>(null);
  const [dim, setDim] = useState(0.2);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;

    const load = async () => {
      setDim(getWallpaperDim());
      let cur;
      try {
        cur = await getWallpaper();
      } catch {
        cur = undefined;
      }
      if (cancelled) return;
      // 先释放旧 URL
      if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
      if (cur) {
        currentUrl = URL.createObjectURL(cur.blob);
        setWp({ kind: cur.kind, url: currentUrl });
      } else {
        setWp(null);
      }
    };

    load();
    const onChange = () => { load(); };
    window.addEventListener(WALLPAPER_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(WALLPAPER_EVENT, onChange);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  // 无用户壁纸 → 铺内置默认壁纸（深绿管家纹样，本身已够暗，不额外加遮罩）
  const isDefault = !wp;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {wp && wp.kind === "video" ? (
        <video
          src={wp.url}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: `url(${wp ? wp.url : DEFAULT_WALLPAPER})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      {/* 暗化遮罩：保证玻璃胶囊上的文字在亮壁纸上仍可读（默认深绿壁纸无需）*/}
      {!isDefault && dim > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />
      )}
    </div>
  );
}
