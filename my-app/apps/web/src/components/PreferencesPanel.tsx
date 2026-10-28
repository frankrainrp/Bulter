"use client";

// ============================================================
// components/PreferencesPanel.tsx — 用户偏好设置 modal
//
// Epic 3 个性化:
//   - 亮/暗主题切换 (data-theme on <html>)
//   - 字体大小档位 (--font-base 变量)
//   - localStorage 持久化
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useT, type Lang } from "@/lib/i18n";
import { X, Moon, Feather, Pencil, Type, Heart, MessageSquare, Flame, Palette, RotateCcw, Upload, User, AlignLeft, AlignCenter, AlignRight, EyeOff, Volume2, VolumeX, Languages } from "lucide-react";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  applyStoredAccent,
  getStoredAccent,
  normalizeHex,
  setStoredAccent,
} from "@/lib/theme";
import { clearCustomAsset, getCustomAsset, setCustomAsset } from "@/lib/butler-asset";
import { getWallpaper, setWallpaper, clearWallpaper, getWallpaperDim, setWallpaperDim } from "@/lib/wallpaper";
import {
  type ButlerPosition,
  getButlerPosition,
  getHiddenTabs,
  setButlerPosition,
  toggleHiddenTab,
} from "@/lib/layout-prefs";
import type { NavId } from "@/lib/types";
import {
  type SoundPrefs,
  type SoundCategory,
  DEFAULT_SOUND_PREFS,
  getSoundPrefs,
  setSoundPrefs,
  playSound,
} from "@/lib/sound";

export type Theme = "paper" | "dark" | "retro";
type FontSize = "sm" | "md" | "lg";
export type Personality = "gentle" | "standard" | "sassy";

const THEME_KEY = "butler.theme";
const FONT_KEY = "butler.fontSize";
const PERSONALITY_KEY = "butler.personality";

// 默认 = 纸感（anti-polish）。dark = 原墨绿玻璃「简单」主题；retro = 复古。
// legacy "light"/null 一律归一到 paper。
function normalizeTheme(raw: string | null): Theme {
  if (raw === "dark") return "dark";
  if (raw === "retro") return "retro";
  return "paper";
}

export function applyStoredPreferences() {
  if (typeof document === "undefined") return;
  try {
    const theme = normalizeTheme(localStorage.getItem(THEME_KEY));
    document.documentElement.dataset.theme = theme;
    const font = (localStorage.getItem(FONT_KEY) as FontSize | null) ?? "md";
    document.documentElement.dataset.fontSize = font;
  } catch { /* silent */ }
  // Phase B: 应用用户自定义 primary 色（无则跳过，保留 globals.css 默认）
  applyStoredAccent();
}

/** 读当前主题（dark 默认；light 归一到 dark）*/
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "paper";
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "paper";
  }
}

/** 设置主题：写 data-theme + localStorage（与偏好设置面板共用同一持久化）*/
export function setStoredTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* silent */
  }
}

export function getStoredPersonality(): Personality {
  if (typeof window === "undefined") return "standard";
  try {
    const p = localStorage.getItem(PERSONALITY_KEY) as Personality | null;
    return p ?? "standard";
  } catch { return "standard"; }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PreferencesPanel({ open, onClose }: Props) {
  const isMobile = useIsMobile();
  const { t, lang, setLang } = useT();
  const [theme, setTheme] = useState<Theme>("paper");
  const [font, setFont] = useState<FontSize>("md");
  const [personality, setPersonality] = useState<Personality>("standard");
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  // Phase C 自定义形象状态
  const [customPreview, setCustomPreview] = useState<{ url: string; w: number; h: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // [066] 壁纸状态
  const [wpKind, setWpKind] = useState<"image" | "video" | null>(null);
  const [wpDim, setWpDim] = useState(0.2);
  const [wpUploading, setWpUploading] = useState(false);
  const [wpErr, setWpErr] = useState<string | null>(null);
  const wpInputRef = useRef<HTMLInputElement>(null);
  // Phase D 布局
  const [butlerPos, setButlerPos] = useState<ButlerPosition>("center");
  const [hiddenTabs, setHiddenTabsState] = useState<Set<NavId>>(new Set());
  // [056] 音效
  const [soundPrefs, setSoundPrefsState] = useState<SoundPrefs>(DEFAULT_SOUND_PREFS);

  // [055 F#5] customPreview 用 ref 同步最新值，避免 handleUpload 闭包陷阱：
  // 并发上传时第二次读到 stale closure 的 customPreview → 第一次 URL 永远 revoke 不掉
  const customPreviewRef = useRef(customPreview);
  customPreviewRef.current = customPreview;

  // 进 panel 时读 localStorage + 自定义形象
  useEffect(() => {
    if (!open) return;
    try {
      const storedTheme = normalizeTheme(localStorage.getItem(THEME_KEY));
      const f = (localStorage.getItem(FONT_KEY) as FontSize | null) ?? "md";
      const p = (localStorage.getItem(PERSONALITY_KEY) as Personality | null) ?? "standard";
      setTheme(storedTheme);
      setFont(f);
      setPersonality(p);
      setAccent(getStoredAccent());
      setButlerPos(getButlerPosition());
      setHiddenTabsState(getHiddenTabs());
      setSoundPrefsState(getSoundPrefs());
      setWpDim(getWallpaperDim());
    } catch { /* silent */ }
    // [066] 读当前壁纸类型（用于显示状态，不创建预览 URL，省内存）
    void getWallpaper().then((w) => { if (open) setWpKind(w?.kind ?? null); }).catch(() => {});
    // 加载自定义形象（用于预览）
    // [055 F#2] cancelled 标志：panel 在 IIFE await 期间关闭 → 跳过 URL.createObjectURL 防 leak
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const asset = await getCustomAsset();
        if (cancelled) return; // panel 已关，不再创建 URL
        if (asset) {
          const url = URL.createObjectURL(asset.blob);
          createdUrl = url;
          setCustomPreview({ url, w: asset.width, h: asset.height });
        } else {
          setCustomPreview(null);
        }
      } catch { /* silent */ }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open]);

  // 上传 → trim → 存 + 即时预览
  const handleUpload = async (file: File) => {
    setUploadErr(null);
    setUploading(true);
    try {
      const asset = await setCustomAsset(file);
      // [055 F#5] 用 ref 拿最新 customPreview，避免闭包陷阱（并发上传旧 URL 永不 revoke）
      const prev = customPreviewRef.current;
      if (prev) URL.revokeObjectURL(prev.url);
      const url = URL.createObjectURL(asset.blob);
      const next = { url, w: asset.width, h: asset.height };
      setCustomPreview(next);
      customPreviewRef.current = next; // 立即更新 ref，下一次并发上传可见
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleClearCustom = async () => {
    try {
      await clearCustomAsset();
      // [055 F#5] 同样用 ref
      const prev = customPreviewRef.current;
      if (prev) URL.revokeObjectURL(prev.url);
      setCustomPreview(null);
      customPreviewRef.current = null;
    } catch { /* silent */ }
  };

  // [066] 壁纸上传 / 清除 / 暗化
  const handleWallpaperUpload = async (file: File) => {
    setWpUploading(true);
    setWpErr(null);
    try {
      const wp = await setWallpaper(file); // 存 IndexedDB + dispatch（WallpaperLayer 即时换）
      setWpKind(wp.kind);
    } catch (e) {
      setWpErr(e instanceof Error ? e.message : t("prefs.uploadFail"));
    } finally {
      setWpUploading(false);
    }
  };
  const handleClearWallpaper = async () => {
    try {
      await clearWallpaper();
      setWpKind(null);
    } catch { /* silent */ }
  };
  const handleWpDimChange = (v: number) => {
    setWpDim(v);
    setWallpaperDim(v); // localStorage + dispatch
  };

  const applyButlerPos = (p: ButlerPosition) => {
    setButlerPos(p);
    setButlerPosition(p); // localStorage + dispatch event
  };
  const handleToggleHiddenTab = (id: NavId) => {
    const next = toggleHiddenTab(id);
    setHiddenTabsState(new Set(next));
  };

  const TAB_LABELS: Record<NavId, string> = {
    chat: "Chat", tasks: "Tasks", calendar: "Calendar", notes: "Notes",
  };
  const ALL_TABS: NavId[] = ["chat", "tasks", "calendar", "notes"];

  // [056] 音效 helpers
  const applySoundPrefs = (next: SoundPrefs) => {
    setSoundPrefsState(next);
    setSoundPrefs(next);
  };
  const toggleSoundEnabled = () => {
    const next = { ...soundPrefs, enabled: !soundPrefs.enabled };
    applySoundPrefs(next);
    if (next.enabled) {
      // 启用时立刻给一声 ai-reply 反馈，证明它在响
      setTimeout(() => playSound("ai-reply"), 50);
    }
  };
  const toggleSoundCategory = (cat: SoundCategory) => {
    applySoundPrefs({
      ...soundPrefs,
      categories: { ...soundPrefs.categories, [cat]: !soundPrefs.categories[cat] },
    });
  };
  const SOUND_CATEGORY_LABELS: Record<SoundCategory, string> = {
    task: t("prefs.sound.task"),
    chat: t("prefs.sound.chat"),
    toast: t("prefs.sound.toast"),
    achievement: t("prefs.sound.achievement"),
    focus: t("prefs.sound.focus"),
    panel: t("prefs.sound.panel"),
  };

  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch { /* silent */ }
  };
  const applyFont = (f: FontSize) => {
    setFont(f);
    document.documentElement.dataset.fontSize = f;
    try { localStorage.setItem(FONT_KEY, f); } catch { /* silent */ }
  };
  const applyPersonality = (p: Personality) => {
    setPersonality(p);
    try { localStorage.setItem(PERSONALITY_KEY, p); } catch { /* silent */ }
  };
  const applyAccent = (hex: string | null) => {
    const target = hex ?? DEFAULT_ACCENT;
    const norm = normalizeHex(target) ?? DEFAULT_ACCENT;
    setAccent(norm);
    setStoredAccent(hex); // null → 移除存储恢复默认
  };

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 80,
          animation: "fade-in 0.18s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={t("prefs.title")}
        style={{
          position: "fixed",
          ...(isMobile
            ? {
                // 手机：底部 sheet（贴底全宽，顶部圆角，上滑入场）
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "90vh",
                borderRadius: "20px 20px 0 0",
                animation: "sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : {
                // 桌面：居中圆角浮层
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 420,
                maxWidth: "92vw",
                maxHeight: "90vh",
                borderRadius: 14,
                animation: "modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              }),
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)",
          zIndex: 81,
          color: "var(--color-text)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <h2 style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            {t("prefs.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", cursor: "pointer",
              color: "var(--color-text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {/* [072] 语言（中英主语言切换）*/}
          <Section title={t("prefs.section.language")}>
            <SegRow>
              <SegBtn active={lang === "en"} onClick={() => setLang("en")} icon={<Languages size={14} />} label={t("prefs.language.en")} />
              <SegBtn active={lang === "zh"} onClick={() => setLang("zh")} icon={<Languages size={14} />} label={t("prefs.language.zh")} />
            </SegRow>
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 6, lineHeight: 1.5 }}>
              {t("prefs.language.hint")}
            </p>
          </Section>

          {/* 主题：纸感(默认) / 简单(原墨绿玻璃) / 复古 */}
          <Section title={t("prefs.section.theme")}>
            <SegRow>
              <SegBtn active={theme === "paper"} onClick={() => applyTheme("paper")} icon={<Pencil size={14} />} label={t("theme.paper")} />
              <SegBtn active={theme === "dark"} onClick={() => applyTheme("dark")} icon={<Moon size={14} />} label={t("theme.simple")} />
              <SegBtn active={theme === "retro"} onClick={() => applyTheme("retro")} icon={<Feather size={14} />} label={t("theme.retro")} />
            </SegRow>
          </Section>

          {/* Phase B 主题色 */}
          <Section title={t("prefs.section.accent")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {ACCENT_PRESETS.map((p) => (
                <SwatchBtn
                  key={p.value}
                  active={accent.toUpperCase() === p.value.toUpperCase()}
                  color={p.value}
                  label={p.label}
                  onClick={() => applyAccent(p.value)}
                />
              ))}
              {/* 自定义 color picker：HTML5 input type=color */}
              <label
                title={t("prefs.accent.custom")}
                style={{
                  position: "relative",
                  width: 30, height: 30, borderRadius: 8,
                  border: "1px dashed var(--color-border)",
                  background: "var(--color-bg)",
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-text-muted)",
                  overflow: "hidden",
                }}
              >
                <Palette size={14} />
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => applyAccent(e.target.value)}
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    opacity: 0, cursor: "pointer", border: "none", padding: 0,
                  }}
                />
              </label>
              {accent.toUpperCase() !== DEFAULT_ACCENT.toUpperCase() && (
                <button
                  onClick={() => applyAccent(null)}
                  title={t("prefs.accent.resetTitle")}
                  aria-label={t("prefs.accent.resetAria")}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg)",
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-text-muted)",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg)")}
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 8, lineHeight: 1.5 }}>
              hover / soft 自动派生；暗色模式会自动提亮以保持对比度
            </p>
          </Section>

          {/* 字体大小 */}
          <Section title={t("prefs.section.font")}>
            <SegRow>
              <SegBtn active={font === "sm"} onClick={() => applyFont("sm")} icon={<Type size={12} />} label={t("prefs.font.sm")} />
              <SegBtn active={font === "md"} onClick={() => applyFont("md")} icon={<Type size={14} />} label={t("prefs.font.md")} />
              <SegBtn active={font === "lg"} onClick={() => applyFont("lg")} icon={<Type size={16} />} label={t("prefs.font.lg")} />
            </SegRow>
          </Section>

          {/* Phase D 布局：Tab 显示/隐藏 + 管家位置 */}
          <Section title={t("prefs.section.layout")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 管家位置 4 档 */}
              <div>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 6px", fontWeight: 500 }}>{t("prefs.butlerPos")}</p>
                <SegRow>
                  <SegBtn active={butlerPos === "left"}   onClick={() => applyButlerPos("left")}   icon={<AlignLeft size={12} />} label={t("prefs.pos.left")} />
                  <SegBtn active={butlerPos === "center"} onClick={() => applyButlerPos("center")} icon={<AlignCenter size={12} />} label={t("prefs.pos.center")} />
                  <SegBtn active={butlerPos === "right"}  onClick={() => applyButlerPos("right")}  icon={<AlignRight size={12} />} label={t("prefs.pos.right")} />
                  <SegBtn active={butlerPos === "hidden"} onClick={() => applyButlerPos("hidden")} icon={<EyeOff size={12} />} label={t("prefs.pos.hidden")} />
                </SegRow>
              </div>
              {/* Tab 显示/隐藏 */}
              <div>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 6px", fontWeight: 500 }}>{t("prefs.showTab")}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ALL_TABS.map((id) => {
                    const visible = !hiddenTabs.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => handleToggleHiddenTab(id)}
                        style={{
                          padding: "5px 11px",
                          borderRadius: 6,
                          border: visible ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          background: visible ? "var(--color-primary-soft)" : "var(--color-bg)",
                          color: visible ? "var(--color-primary)" : "var(--color-text-faint)",
                          fontSize: 12, fontWeight: 500, cursor: "pointer",
                          fontFamily: "inherit",
                          textDecoration: visible ? "none" : "line-through",
                        }}
                      >
                        {TAB_LABELS[id]}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 6, lineHeight: 1.5 }}>
                  点击切换显示;Tab 顺序可在顶栏直接拖拽
                </p>
              </div>
            </div>
          </Section>

          {/* [056] 音效 — opt-in（默认关，防扰民） */}
          <Section title={t("prefs.section.sound")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 主开关 */}
              <button
                onClick={toggleSoundEnabled}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: soundPrefs.enabled ? "var(--color-primary-soft)" : "var(--color-bg)",
                  color: soundPrefs.enabled ? "var(--color-primary)" : "var(--color-text-muted)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {soundPrefs.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {soundPrefs.enabled ? t("prefs.sound.enabled") : t("prefs.sound.disabled")}
              </button>

              {/* 分类开关 + 音量 + 静音时段（仅启用时显示）*/}
              {soundPrefs.enabled && (
                <>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 6px", fontWeight: 500 }}>{t("prefs.sound.category")}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(Object.keys(SOUND_CATEGORY_LABELS) as SoundCategory[]).map((cat) => (
                        <label
                          key={cat}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "5px 4px",
                            fontSize: 12, color: "var(--color-text)",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={soundPrefs.categories[cat]}
                            onChange={() => toggleSoundCategory(cat)}
                            style={{ accentColor: "var(--color-primary)" }}
                          />
                          {SOUND_CATEGORY_LABELS[cat]}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 音量 */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0, fontWeight: 500 }}>{t("prefs.sound.volume")}</p>
                      <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "ui-monospace, monospace" }}>
                        {Math.round(soundPrefs.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={soundPrefs.volume}
                      onChange={(e) => applySoundPrefs({ ...soundPrefs, volume: parseFloat(e.target.value) })}
                      onMouseUp={() => playSound("ai-reply")}
                      style={{ width: "100%", accentColor: "var(--color-primary)" }}
                    />
                  </div>

                  {/* 静音时段 */}
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={soundPrefs.quietHours !== null}
                        onChange={(e) => applySoundPrefs({
                          ...soundPrefs,
                          quietHours: e.target.checked ? (soundPrefs.quietHours ?? { start: 22, end: 8 }) : null,
                        })}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      启用静音时段
                    </label>
                    {soundPrefs.quietHours && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "var(--color-text-muted)", paddingLeft: 22 }}>
                        从
                        <input
                          type="number" min={0} max={23} value={soundPrefs.quietHours.start}
                          onChange={(e) => applySoundPrefs({ ...soundPrefs, quietHours: { start: Math.max(0, Math.min(23, parseInt(e.target.value || "0", 10))), end: soundPrefs.quietHours!.end } })}
                          style={{ width: 50, padding: "3px 6px", border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, fontFamily: "inherit" }}
                        />
                        点 到
                        <input
                          type="number" min={0} max={23} value={soundPrefs.quietHours.end}
                          onChange={(e) => applySoundPrefs({ ...soundPrefs, quietHours: { start: soundPrefs.quietHours!.start, end: Math.max(0, Math.min(23, parseInt(e.target.value || "0", 10))) } })}
                          style={{ width: 50, padding: "3px 6px", border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, fontFamily: "inherit" }}
                        />
                        点
                      </div>
                    )}
                  </div>
                </>
              )}
              <p style={{ fontSize: 11, color: "var(--color-text-faint)", lineHeight: 1.5, margin: 0 }}>
                音效完全在浏览器内合成（无外部文件，无网络）；默认关闭以防扰民
              </p>
            </div>
          </Section>

          {/* Phase C 管家形象 */}
          <Section title={t("prefs.section.butler")}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {/* 预览框 */}
              <div style={{
                width: 64, height: 64, borderRadius: 10,
                border: "1px dashed var(--color-border)",
                background: "var(--color-surface)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}>
                {customPreview ? (
                  <img
                    src={customPreview.url}
                    alt={t("prefs.butler.alt")}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <User size={22} color="var(--color-text-faint)" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 10px", borderRadius: 6,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-bg)",
                      color: "var(--color-text)",
                      fontSize: 12, fontWeight: 500,
                      cursor: uploading ? "wait" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <Upload size={12} /> {uploading ? t("prefs.processing") : customPreview ? t("prefs.replace") : t("prefs.upload")}
                  </button>
                  {customPreview && (
                    <button
                      onClick={handleClearCustom}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 10px", borderRadius: 6,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-bg)",
                        color: "var(--color-text-muted)",
                        fontSize: 12, fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <RotateCcw size={12} /> 恢复默认
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 6, lineHeight: 1.5, margin: "6px 0 0" }}>
                  {customPreview
                    ? `已上传 ${customPreview.w}×${customPreview.h}px（替换全部 7 姿势）`
                    : t("prefs.butler.hint")}
                </p>
                {uploadErr && (
                  <p style={{ fontSize: 11, color: "var(--color-danger)", marginTop: 4, margin: "4px 0 0" }}>
                    ⚠️ {uploadErr}
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  if (e.target) e.target.value = ""; // 允许重复上传同名文件
                }}
              />
            </div>
          </Section>

          {/* [066] 壁纸 */}
          <Section title={t("prefs.section.wallpaper")}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => wpInputRef.current?.click()}
                disabled={wpUploading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg)", color: "var(--color-text)",
                  fontSize: 12, fontWeight: 500,
                  cursor: wpUploading ? "wait" : "pointer", fontFamily: "inherit",
                }}
              >
                <Upload size={12} /> {wpUploading ? t("prefs.processing") : t("prefs.wp.upload")}
              </button>
              {wpKind && (
                <button
                  onClick={handleClearWallpaper}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 6,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg)", color: "var(--color-text-muted)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <RotateCcw size={12} /> 恢复默认
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: "6px 0 0", lineHeight: 1.5 }}>
              {wpKind
                ? t("prefs.wp.current", { kind: wpKind === "video" ? t("prefs.wp.video") : t("prefs.wp.image") })
                : t("prefs.wp.hint")}
            </p>
            {wpErr && (
              <p style={{ fontSize: 11, color: "var(--color-danger)", margin: "4px 0 0" }}>⚠️ {wpErr}</p>
            )}
            {/* 暗化滑块：保证壁纸上玻璃文字可读 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 }}>{t("prefs.wp.dim")}</span>
              <input
                type="range"
                min={0} max={0.7} step={0.05}
                value={wpDim}
                onChange={(e) => handleWpDimChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "var(--color-primary)" }}
              />
              <span style={{ fontSize: 11, color: "var(--color-text-faint)", width: 34, textAlign: "right" }}>
                {Math.round(wpDim * 100)}%
              </span>
            </div>
            <input
              ref={wpInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleWallpaperUpload(f);
                if (e.target) e.target.value = "";
              }}
            />
          </Section>

          {/* G5.1 管家性格 */}
          <Section title={t("prefs.section.personality")}>
            <SegRow>
              <SegBtn active={personality === "gentle"}   onClick={() => applyPersonality("gentle")}   icon={<Heart size={12} />} label={t("personality.gentle")} />
              <SegBtn active={personality === "standard"} onClick={() => applyPersonality("standard")} icon={<MessageSquare size={12} />} label={t("personality.standard")} />
              <SegBtn active={personality === "sassy"}    onClick={() => applyPersonality("sassy")}    icon={<Flame size={12} />} label={t("personality.sassy")} />
            </SegRow>
            <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 6, lineHeight: 1.5 }}>
              影响 AI 对话语气;切换后立刻生效(下一条消息开始)
            </p>
          </Section>
        </div>

        <footer
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            fontSize: 11,
            color: "var(--color-text-faint)",
            textAlign: "center",
          }}
        >
          {t("prefs.footer")}
        </footer>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pop {
          from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes sheet-up {
          from { transform: translateY(100%); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function SegRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      {children}
    </div>
  );
}

function SwatchBtn({
  active, color, label, onClick,
}: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${label} ${color}`}
      aria-label={label}
      style={{
        width: 30, height: 30, borderRadius: 8,
        border: active ? "2px solid var(--color-text)" : "1px solid var(--color-border)",
        background: color,
        cursor: "pointer",
        padding: 0,
        boxShadow: active ? "0 0 0 2px var(--color-bg) inset" : "none",
        transition: "transform 0.12s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
    />
  );
}

function SegBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 10px",
        border: "none",
        background: active ? "var(--color-primary-soft)" : "transparent",
        color: active ? "var(--color-primary)" : "var(--color-text-muted)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {icon} {label}
    </button>
  );
}
