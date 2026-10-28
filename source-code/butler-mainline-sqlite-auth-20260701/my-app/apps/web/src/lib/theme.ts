// ============================================================
// lib/theme.ts — Phase B 颜色自定义工具
//
// 用户选一个 primary hex → 派生 light/dark 两套 (primary + hover + soft)
// 注入到一个 <style id="butler-accent-override"> 元素覆盖 globals.css 的
// :root / html[data-theme="dark"] 默认值。
//
// 设计要点：
// - light mode 直接用用户选色，dark mode 自动提亮（深色背景需要更高对比度）
// - hover = primary +5L；soft = 高去饱和的浅底色（light）/ 深底色（dark）
// - localStorage "butler.accent" 持久化（hex 字符串）；空 = 用默认墨绿
// ============================================================

export const ACCENT_KEY = "butler.accent";
export const DEFAULT_ACCENT = "#4A7C99"; // 钢蓝（与 globals.css :root 一致）

/** UI 用快捷预设 — 横排 swatch 一键应用 */
export const ACCENT_PRESETS: Array<{ label: string; value: string }> = [
  { label: "钢蓝青", value: "#4A7C99" }, // 默认 teal/steel
  { label: "海军蓝", value: "#1E3A5F" },
  { label: "紫罗兰", value: "#5B3A8E" },
  { label: "玫瑰红", value: "#9D2B4F" },
  { label: "杏橙", value: "#A8541E" },
  { label: "石墨灰", value: "#374151" },
];

// ---------- 颜色换算 ----------

/** "#RRGGBB" / "#RGB" → [r, g, b] (0-255) */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

/** [r, g, b] (0-255) → [h (0-360), s (0-100), l (0-100)] */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** [h (0-360), s (0-100), l (0-100)] → "#RRGGBB" */
function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; b = 0; }
  else if (h < 120){ r = x; g = c; b = 0; }
  else if (h < 180){ r = 0; g = c; b = x; }
  else if (h < 240){ r = 0; g = x; b = c; }
  else if (h < 300){ r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }
  const toHex = (n: number) => {
    const v = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** "#RRGGBB" → "#RRGGBB"（标准化 + 校验，失败返回 null） */
export function normalizeHex(input: string): string | null {
  const rgb = hexToRgb(input);
  if (!rgb) return null;
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// ---------- 派生策略 ----------

/**
 * 从用户选色派生 light/dark 两套 primary/hover/soft。
 *
 * - light mode：用户选色直接 primary；hover = +5L；soft = 强去饱和 + 高亮度（淡底）
 * - dark mode：若用户选色偏暗（L<50）自动提亮到 L=68 保对比度；否则沿用；
 *   hover = +5L；soft = 低亮度暗底（L=18）
 */
export function deriveAccentScheme(baseHex: string) {
  const rgb = hexToRgb(baseHex);
  const fallback = DEFAULT_ACCENT;
  if (!rgb) return deriveAccentScheme(fallback);
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // light mode
  const lightPrimary = baseHex.toUpperCase();
  const lightHover   = hslToHex(h, s, Math.min(92, l + 5));
  const lightSoft    = hslToHex(h, Math.max(15, s - 50), 92);

  // dark mode — 暗色 bg 需要更高亮度的 primary 才能视觉跳出
  const darkL = l < 50 ? 68 : Math.min(78, l + 8);
  const darkS = Math.max(35, Math.min(70, s));
  const darkPrimary = hslToHex(h, darkS, darkL);
  const darkHover   = hslToHex(h, darkS, Math.min(85, darkL + 5));
  const darkSoft    = hslToHex(h, Math.max(20, s - 25), 18);

  return {
    light: { primary: lightPrimary, primaryHover: lightHover, primarySoft: lightSoft },
    dark:  { primary: darkPrimary,  primaryHover: darkHover,  primarySoft: darkSoft },
  };
}

// ---------- DOM 应用 ----------

const STYLE_EL_ID = "butler-accent-override";

/**
 * 把派生的颜色注入到一个 <style id="butler-accent-override"> 元素，
 * 覆盖 globals.css 的 :root / html[data-theme="dark"] 默认值。
 * 传 null / DEFAULT_ACCENT 时移除 style 元素，回到默认墨绿。
 */
export function applyAccentColor(hex: string | null) {
  if (typeof document === "undefined") return;
  // 默认或空 → 移除覆盖
  if (!hex || hex.toUpperCase() === DEFAULT_ACCENT.toUpperCase()) {
    document.getElementById(STYLE_EL_ID)?.remove();
    return;
  }
  const norm = normalizeHex(hex);
  if (!norm) return;
  const scheme = deriveAccentScheme(norm);
  const css = `
:root {
  --color-primary: ${scheme.light.primary};
  --color-primary-hover: ${scheme.light.primaryHover};
  --color-primary-soft: ${scheme.light.primarySoft};
}
html[data-theme="dark"] {
  --color-primary: ${scheme.dark.primary};
  --color-primary-hover: ${scheme.dark.primaryHover};
  --color-primary-soft: ${scheme.dark.primarySoft};
}
`.trim();
  let el = document.getElementById(STYLE_EL_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_EL_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/** localStorage 读 + 应用（用于 mount 时防闪烁） */
export function applyStoredAccent() {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    applyAccentColor(stored);
  } catch { /* silent */ }
}

/** 持久化并应用 */
export function setStoredAccent(hex: string | null) {
  try {
    if (!hex || hex.toUpperCase() === DEFAULT_ACCENT.toUpperCase()) {
      localStorage.removeItem(ACCENT_KEY);
    } else {
      const norm = normalizeHex(hex);
      if (norm) localStorage.setItem(ACCENT_KEY, norm);
    }
  } catch { /* silent */ }
  applyAccentColor(hex);
}

export function getStoredAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    return localStorage.getItem(ACCENT_KEY) ?? DEFAULT_ACCENT;
  } catch { return DEFAULT_ACCENT; }
}
