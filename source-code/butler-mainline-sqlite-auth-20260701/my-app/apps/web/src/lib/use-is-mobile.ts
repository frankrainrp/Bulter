"use client";

// ============================================================
// lib/use-is-mobile.ts — 响应式断点 hook
// 项目以 inline style 为主（不便用 CSS media query），用此 hook
// 让组件按视口宽度条件渲染/切换布局。默认断点 768px。
// ============================================================

import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768): boolean {
  // SSR 安全：首屏 false，mount 后按真实视口校正
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
