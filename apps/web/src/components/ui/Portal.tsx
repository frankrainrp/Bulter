"use client";

// ============================================================
// components/ui/Portal.tsx — 把浮层渲染到 document.body
// 目的：让弹窗/下拉/抽屉等"独立子容器"逃离胶囊面板的
// overflow:hidden + backdrop-filter（后者会把 position:fixed
// 困在面板内），避免被截断。
// ============================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
