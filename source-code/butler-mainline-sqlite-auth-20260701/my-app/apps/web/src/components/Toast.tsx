"use client";

// ============================================================
// components/Toast.tsx — 全局 Toast 通知系统
//
// 设计:
//   - Context + useToast hook
//   - 顶右 stack 渲染（不阻塞主区交互）
//   - 4 档:success / info / warning / error
//   - 可选 action 按钮（用于 Undo / 跳转 等）
//   - 自动消失（默认 3s,带 action 时默认 5s,可自定义）
//   - 同 id 多次调用会覆盖（防止重复 toast 堆叠）
// ============================================================

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { playSound } from "@/lib/sound";
import { useT } from "@/lib/i18n";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** 显示文本(支持简单换行) */
  message: string;
  kind?: ToastKind;
  /** 自动消失毫秒（0 = 永不消失,需用户手动关）;默认 3000,带 action 时 5000 */
  duration?: number;
  /** 可选 action 按钮（如 [撤销] [打开]） */
  action?: ToastAction;
  /** 同 id 后续调用会覆盖前一条（防重复） */
  id?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (message: string, opts?: Omit<ToastOptions, "kind" | "message">) => string;
  info: (message: string, opts?: Omit<ToastOptions, "kind" | "message">) => string;
  warning: (message: string, opts?: Omit<ToastOptions, "kind" | "message">) => string;
  error: (message: string, opts?: Omit<ToastOptions, "kind" | "message">) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_META: Record<ToastKind, { color: string; bg: string; icon: React.ReactNode }> = {
  success: { color: "var(--color-success)", bg: "rgba(45,122,77,0.10)",  icon: <CheckCircle2 size={16} /> },
  info:    { color: "var(--color-primary)", bg: "var(--color-primary-soft)", icon: <Info size={16} /> },
  warning: { color: "var(--color-warning)", bg: "rgba(245,158,11,0.12)", icon: <AlertTriangle size={16} /> },
  error:   { color: "var(--color-danger)",  bg: "rgba(220,38,38,0.10)",  icon: <XCircle size={16} /> },
};

const uid = () => "t-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((opts: ToastOptions): string => {
    const id = opts.id ?? uid();
    const duration = opts.duration ?? (opts.action ? 5000 : 3000);
    setItems((prev) => {
      // 同 id 覆盖
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, { ...opts, id, kind: opts.kind ?? "info", createdAt: Date.now() }];
    });
    // 清旧 timer
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    }
    // [056] 音效（opt-in 守卫内置在 playSound 里）
    const kind = opts.kind ?? "info";
    playSound(`toast-${kind}` as const);
    return id;
  }, [dismiss]);

  const success = useCallback((m: string, o?: Omit<ToastOptions, "kind" | "message">) =>
    show({ ...o, message: m, kind: "success" }), [show]);
  const info = useCallback((m: string, o?: Omit<ToastOptions, "kind" | "message">) =>
    show({ ...o, message: m, kind: "info" }), [show]);
  const warning = useCallback((m: string, o?: Omit<ToastOptions, "kind" | "message">) =>
    show({ ...o, message: m, kind: "warning" }), [show]);
  const error = useCallback((m: string, o?: Omit<ToastOptions, "kind" | "message">) =>
    show({ ...o, message: m, kind: "error" }), [show]);

  // unmount 时清掉所有 timer
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss, success, info, warning, error }}>
      {children}
      <ToastStack items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

// ============================================================
// 渲染层
// ============================================================
function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 68,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 360,
      }}
    >
      {items.map((t) => (
        <ToastRow key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { t } = useT();
  const meta = KIND_META[item.kind ?? "info"];
  // error toast 进场后抖动一下（配 toast-error 音）
  const isError = item.kind === "error";
  return (
    <div
      className={isError ? "fx-shake" : undefined}
      style={{
        pointerEvents: "auto",
        background: "var(--color-surface)",
        border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
        borderLeft: `4px solid ${meta.color}`,
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "var(--shadow-card-hover)",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        animation: "toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        fontFamily: "inherit",
      }}
    >
      <span style={{ color: meta.color, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text)",
            margin: 0,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.message}
        </p>
        {item.action && (
          <button
            onClick={() => {
              item.action!.onClick();
              onDismiss();
            }}
            style={{
              marginTop: 6,
              padding: "3px 10px",
              borderRadius: 5,
              border: `1px solid ${meta.color}`,
              background: meta.bg,
              color: meta.color,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label={t("common.close")}
        style={{
          width: 20,
          height: 20,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--color-text-faint)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <X size={12} />
      </button>
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
