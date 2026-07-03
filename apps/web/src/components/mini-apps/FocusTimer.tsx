"use client";

// ============================================================
// components/mini-apps/FocusTimer.tsx — 学习专注计时器
//
// 番茄钟风格：25 / 45 / 60 min 预设 + 自定义时长
// 倒计时显示 mm:ss、环形进度
// 开始 / 暂停 / 重置
// 完成时声效（暂用 console + alert，Phase 3 Tauri 后接系统通知）
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Target, Link2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { playSound } from "@/lib/sound";
import type { DdlItem } from "@/lib/types";
import { useT } from "@/lib/i18n";

const PRESETS = [
  { label: "25 min", min: 25 },
  { label: "45 min", min: 45 },
  { label: "60 min", min: 60 },
];

interface Props {
  /** Epic 5.1 联动:当前任务列表,可选关联到具体 task */
  ddls?: DdlItem[];
  /** 结束时把"专注 25min"追加到 task.notes */
  onAppendTaskNote?: (taskId: string, line: string) => void;
}

export default function FocusTimer({ ddls = [], onAppendTaskNote }: Props) {
  const toast = useToast();
  const { t } = useT();
  const [totalSec, setTotalSec] = useState(25 * 60);  // 总时长
  const [remainSec, setRemainSec] = useState(25 * 60); // 剩余秒
  const [running, setRunning] = useState(false);
  // Epic 5.1 关联任务
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const totalSecRef = useRef(totalSec);
  useEffect(() => { totalSecRef.current = totalSec; }, [totalSec]);
  const linkedRef = useRef(linkedTaskId);
  useEffect(() => { linkedRef.current = linkedTaskId; }, [linkedTaskId]);

  const todoTasks = ddls.filter((d) => !d.completed && (d.status ?? "todo") !== "done").slice(0, 8);

  // 倒计时 tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemainSec((s) => {
        // [056] 5 分钟剩余时极轻 tick 提醒
        if (s === 301) playSound("focus-5min");
        if (s <= 1) {
          setRunning(false);
          playSound("focus-end"); // [056]
          // 用 Toast 替代 alert（Phase 3 接 Tauri 后升级原生通知）
          toast.success(t("focus.done"), { duration: 8000 });
          // Epic 5.1 把这次专注追加到关联任务的 notes
          const tid = linkedRef.current;
          if (tid && onAppendTaskNote) {
            const min = Math.round(totalSecRef.current / 60);
            const stamp = new Date().toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" });
            onAppendTaskNote(tid, t("focus.noteLine", { min, stamp }));
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const setPreset = (min: number) => {
    setRunning(false);
    setTotalSec(min * 60);
    setRemainSec(min * 60);
  };

  const onPlay = () => {
    if (remainSec === 0) {
      // 倒计时结束后再点 = 重新开始
      setRemainSec(totalSec);
    }
    setRunning(true);
    playSound("focus-start"); // [056]
  };
  const onPause = () => setRunning(false);
  const onReset = () => {
    setRunning(false);
    setRemainSec(totalSec);
  };

  const mm = Math.floor(remainSec / 60).toString().padStart(2, "0");
  const ss = (remainSec % 60).toString().padStart(2, "0");
  const progress = totalSec > 0 ? 1 - remainSec / totalSec : 0;
  const ringSize = 180;
  const stroke = 10;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      {/* 标题 + 图标 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-muted)" }}>
        <Target size={14} />
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            margin: 0,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Focus Timer
        </h3>
      </div>

      {/* 倒计时环 */}
      <div style={{ position: "relative", width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize}>
          {/* 背景圆环 */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="var(--color-primary-soft)"
            strokeWidth={stroke}
          />
          {/* 进度圆环 */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        {/* 中央：时间 mm:ss */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: "var(--color-primary)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {mm}:{ss}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-muted)",
              margin: "6px 0 0",
            }}
          >
            {running ? t("focus.running") : remainSec === 0 ? t("focus.finished") : t("focus.ready")}
          </p>
        </div>
      </div>

      {/* 控制：播放/暂停/重置 */}
      <div style={{ display: "flex", gap: 8 }}>
        {running ? (
          <CircleBtn onClick={onPause} primary>
            <Pause size={18} />
          </CircleBtn>
        ) : (
          <CircleBtn onClick={onPlay} primary>
            <Play size={18} style={{ marginLeft: 2 }} />
          </CircleBtn>
        )}
        <CircleBtn onClick={onReset} disabled={remainSec === totalSec && !running}>
          <RotateCcw size={16} />
        </CircleBtn>
      </div>

      {/* Epic 5.1 关联任务选择器（只在有未完成任务时显示） */}
      {todoTasks.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              letterSpacing: 0.4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Link2 size={10} /> {t("focus.linkTask")}
          </label>
          <select
            value={linkedTaskId ?? ""}
            onChange={(e) => setLinkedTaskId(e.target.value || null)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: linkedTaskId ? "var(--color-primary-soft)" : "var(--color-bg)",
              color: linkedTaskId ? "var(--color-primary)" : "var(--color-text-muted)",
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">{t("focus.noLink")}</option>
            {todoTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.taskName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 时长预设 */}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {PRESETS.map((p) => {
          const isActive = totalSec === p.min * 60;
          return (
            <button
              key={p.min}
              onClick={() => setPreset(p.min)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                background: isActive ? "var(--color-primary-soft)" : "var(--color-bg)",
                color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.12s",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--color-text-faint)",
          margin: 0,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {t("focus.phaseHint")}
      </p>
    </div>
  );
}

function CircleBtn({
  children, onClick, primary, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: primary ? "none" : "1px solid var(--color-border)",
        background: disabled
          ? "var(--color-border-soft)"
          : primary
          ? h
            ? "var(--color-primary-hover)"
            : "var(--color-primary)"
          : h
          ? "var(--color-surface)"
          : "var(--color-bg)",
        color: primary ? "white" : "var(--color-text-muted)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
