"use client";

// ============================================================
// components/InputPod.tsx — 悬浮底栏输入舱（含文件上传 + 拖拽）
// ============================================================

import React, { useRef, useEffect, useState } from "react";
import { Paperclip, ChevronDown, FileText, Image as ImageIcon, X, File as FileIcon, Check, Square } from "lucide-react";
import type { UploadedFile } from "@/lib/types";
import { AI_MODELS, type AiModelId, type AiModelMeta, getModelMeta } from "@/lib/ai-models";
import { GlassButton } from "@/components/ui/Glass";
import Portal from "@/components/ui/Portal";
import { useUsage, formatCountdown } from "@/lib/usage";
import { useT } from "@/lib/i18n";

interface InputPodProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  /** 生成中点击此回调中止流式响应（与 onSend 同按钮位置切换） */
  onStop?: () => void;
  isLoading?: boolean;
  attachedFiles: UploadedFile[];
  onAttach: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  /** 当前选中的模型 id */
  selectedModel?: AiModelId;
  onSelectModel?: (id: AiModelId) => void;
}

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,image/*";

export default function InputPod({
  value, onChange, onSend, onStop, isLoading = false,
  attachedFiles, onAttach, onRemoveAttachment,
  selectedModel = "deepseek-v4-flash",
  onSelectModel,
}: InputPodProps) {
  const { t } = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // 模型下拉用 Portal 渲染到 body（逃离输入舱/胶囊的 overflow），需记录按钮位置
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const [modelMenuPos, setModelMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const modelMeta = getModelMeta(selectedModel);

  const toggleModelMenu = () => {
    if (!modelMenuOpen && modelBtnRef.current) {
      const r = modelBtnRef.current.getBoundingClientRect();
      // 下拉向上弹：bottom 锚到按钮上沿之上 6px
      setModelMenuPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    }
    setModelMenuOpen((v) => !v);
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文 IME 选词期间回车不发送：e.nativeEvent.isComposing 是现代标准
    // keyCode === 229 是 Safari/旧浏览器兜底（IME composition 期间 keyCode 固定 229）
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const canSend = !isLoading && (!!(value ?? "").trim() || attachedFiles.length > 0);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttach(e.target.files);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAttach(e.dataTransfer.files);
    }
  };

  return (
    <div style={{
      width: "100%",
      maxWidth: 720,
    }}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: dragActive ? "var(--color-primary-soft)" : "var(--color-bg)",
          border: `1px solid ${
            dragActive ? "var(--color-primary)" :
            focused ? "var(--color-primary)" : "var(--color-border)"
          }`,
          borderRadius: 14,
          boxShadow: focused || dragActive
            ? "0 0 0 3px var(--color-primary-soft), 0 4px 16px rgba(0,0,0,0.06)"
            : "0 1px 2px rgba(0,0,0,0.04)",
          overflow: "hidden",
          transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
          position: "relative",
        }}>
        {/* 拖拽提示遮罩 */}
        {dragActive && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            background: "var(--color-primary-soft)",
            color: "var(--color-primary)", fontSize: 13, fontWeight: 600,
            letterSpacing: 0.2,
          }}>
            {t("input.dropHint")}
          </div>
        )}

        {/* 附件 chips */}
        {attachedFiles.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            padding: "10px 12px 0",
          }}>
            {attachedFiles.map((f) => (
              <FileChip key={f.id} file={f} onRemove={() => onRemoveAttachment(f.id)} />
            ))}
          </div>
        )}

        {/* 上层 textarea */}
        <div style={{ padding: "12px 16px 4px" }}>
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              attachedFiles.length > 0
                ? t("input.placeholderFiles")
                : t("input.placeholder")
            }
            rows={1}
            style={{
              width: "100%",
              background: "transparent",
              resize: "none",
              outline: "none",
              border: "none",
              fontSize: 14,
              color: "var(--color-text)",
              lineHeight: 1.6,
              minHeight: 44,
              maxHeight: 200,
              fontFamily: "inherit",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          />
        </div>

        {/* 下层：模型 badge + 工具 | 发送 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 12px 10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            {/* 模型选择器 */}
            <button
              id="model-selector-btn"
              ref={modelBtnRef}
              onClick={toggleModelMenu}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: modelMenuOpen ? "var(--color-primary-soft)" : "var(--color-surface)",
                border: `1px solid ${modelMenuOpen ? "var(--color-primary)" : "var(--color-border)"}`,
                padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                fontSize: 12, color: "var(--color-text)", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <ModelDot tier={modelMeta.tier} />
              <span style={{ fontWeight: 500 }}>{modelMeta.label}</span>
              <ChevronDown size={12} color="var(--color-text-muted)" style={{
                transform: modelMenuOpen ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.15s",
              }} />
            </button>

            {modelMenuOpen && modelMenuPos && (
              <Portal>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 80 }}
                  onClick={() => setModelMenuOpen(false)}
                />
                <div
                  style={{
                    position: "fixed",
                    left: modelMenuPos.left,
                    bottom: modelMenuPos.bottom,
                    width: 280,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow-modal)",
                    overflow: "hidden",
                    zIndex: 81,
                  }}
                >
                  {AI_MODELS.map((m, idx) => (
                    <ModelOption
                      key={m.id}
                      meta={m}
                      isActive={m.id === selectedModel}
                      isLast={idx === AI_MODELS.length - 1}
                      onClick={() => {
                        onSelectModel?.(m.id);
                        setModelMenuOpen(false);
                      }}
                    />
                  ))}
                </div>
              </Portal>
            )}

            {/* 附件 */}
            <button
              id="attach-btn"
              aria-label={t("input.attach")}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer", background: "transparent", color: "var(--color-text-faint)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-faint)"; }}
            >
              <Paperclip size={15} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              style={{ display: "none" }}
              onChange={handleFilePick}
            />
          </div>

          {/* 右侧：用量圆环 + 发送/停止 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* [088] 用量圆环：本时段免费额度消耗百分比，放发送钮旁 */}
            <UsageRing />

            {/* 发送 / 停止按钮 — 生成中切换为方形 stop（液态玻璃圆钮）*/}
            {isLoading && onStop ? (
              <GlassButton
                id="stop-btn"
                aria-label={t("input.stop")}
                onClick={onStop}
                variant="primary"
                circle
                style={{ width: 36, height: 36 }}
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </GlassButton>
            ) : (
              <GlassButton
                id="send-btn"
                aria-label={t("input.send")}
                onClick={onSend}
                disabled={!canSend}
                variant="primary"
                circle
                style={{ width: 36, height: 36 }}
              >
                <ServiceBell size={18} />
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- [088] 用量圆环 ----
// 本时段（5h 窗口）免费额度消耗百分比，环形进度 + 中心 % + 悬浮明细。
// 耗尽转危险色、≥80% 转琥珀。点击/悬浮 title 提示余量与回满倒计时。
function UsageRing() {
  const { t } = useT();
  const u = useUsage().window;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const pct = u.budget > 0 ? Math.min(100, Math.round((u.spend / u.budget) * 100)) : 0;
  const size = 30;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = u.exhausted
    ? "var(--color-danger)"
    : pct >= 80
    ? "#f59e0b"
    : "var(--color-primary)";
  const reset = formatCountdown(u.resetAt, now);

  return (
    <div
      title={t("usage.ringTitle", { spend: u.spend.toFixed(2), budget: u.budget.toFixed(2), pct, reset })}
      aria-label={t("usage.ringAria", { pct })}
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s" }}
        />
      </svg>
      <span
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8.5, fontWeight: 700, color, letterSpacing: -0.3,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ---- 文件 chip ----
function FileChip({ file, onRemove }: { file: UploadedFile; onRemove: () => void }) {
  const { t } = useT();
  const [hov, setHov] = useState(false);
  const isImage = file.mime.startsWith("image/");
  const isPdf = file.mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const Icon = isImage ? ImageIcon : isPdf ? FileText : FileIcon;
  const color = isPdf ? "#dc2626" : isImage ? "#10b981" : "#6366f1";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 8px 5px 8px", borderRadius: 8,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-soft)",
        fontSize: 12, color: "var(--color-text)",
        maxWidth: 220,
        transition: "background 0.15s",
      }}
    >
      <Icon size={14} color={color} style={{ flexShrink: 0 }} />
      <span style={{
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        fontWeight: 500, maxWidth: 140,
      }}>{file.name}</span>
      <span style={{ color: "var(--color-text-faint)", fontSize: 10, flexShrink: 0 }}>
        {formatSize(file.size)}
      </span>
      <button
        aria-label={t("input.removeAttachment")}
        onClick={onRemove}
        style={{
          width: 18, height: 18, borderRadius: 4, border: "none",
          background: hov ? "var(--color-border-soft)" : "transparent",
          cursor: "pointer", color: "var(--color-text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "background 0.15s",
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 餐厅前台服务铃铛（台铃）：点一下"叮"——呼应管家签名服务铃音效 [060]，
 *  发送 = 按铃唤管家的巴甫洛夫闭环。currentColor 跟随按钮文字色。 */
function ServiceBell({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* 顶部按钮 + 短杆 */}
      <circle cx="12" cy="3.6" r="1.7" fill="currentColor" />
      <rect x="11.2" y="4.8" width="1.6" height="2.4" rx="0.8" fill="currentColor" />
      {/* 半圆钟体 */}
      <path d="M3.6 17.4 C3.6 12.8 7.4 8.9 12 8.9 C16.6 8.9 20.4 12.8 20.4 17.4 Z" fill="currentColor" />
      {/* 底座托盘 */}
      <rect x="2" y="17.2" width="20" height="2.6" rx="1.3" fill="currentColor" />
    </svg>
  );
}

// ============================================================
// 模型相关：tier 圆点 + 紧凑下拉项
// ============================================================
function ModelDot({ tier }: { tier: "low" | "mid" | "high" }) {
  const color = tier === "low" ? "#22c55e" : tier === "mid" ? "#f59e0b" : "#ef4444";
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

/** 紧凑的下拉项：左侧 3px 墨绿条标记 active */
function ModelOption({
  meta, isActive, isLast, onClick,
}: {
  meta: AiModelMeta;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isPlaceholder = !!meta.placeholder; // #12 接口预留：不可选
  // 注意：不再用 inline style 残留改 background。背景完全由 state 派生
  const bg = isActive
    ? "var(--color-primary-soft)"
    : hov && !isPlaceholder
    ? "var(--color-surface)"
    : "var(--color-bg)";
  return (
    <button
      onClick={isPlaceholder ? undefined : onClick}
      disabled={isPlaceholder}
      aria-disabled={isPlaceholder}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 12px",
        border: "none",
        borderLeft: `3px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
        borderBottom: isLast ? "none" : "1px solid var(--color-border-soft)",
        background: bg,
        cursor: isPlaceholder ? "not-allowed" : "pointer",
        opacity: isPlaceholder ? 0.55 : 1,
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ModelDot tier={meta.tier} />
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: isActive ? "var(--color-primary)" : "var(--color-text)",
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-faint)" }}>
          {meta.tagline}
        </span>
        {isActive && <Check size={13} color="var(--color-primary)" style={{ marginLeft: 4 }} />}
      </div>
    </button>
  );
}
