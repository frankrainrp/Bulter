"use client";

// ============================================================
// components/ProcessingPipeline.tsx — 4 步处理流水线可视化
// Stage E：替换 DecoLayered 为白底墨绿卡，去 AI 头像（与漫画风对齐）
// ============================================================

import React from "react";
import {
  Loader2, Check, X as XIcon, FileText,
  ScanText, Brain, CalendarPlus, Database, ChevronRight,
} from "lucide-react";
import type { ProcessingPipeline as Pipeline, PipelineStep } from "@/lib/types";
import { getStepDetail } from "@/lib/mock-pipeline";
import { useT } from "@/lib/i18n";

const STEP_ICONS: Record<PipelineStep["id"], React.ReactNode> = {
  ocr:      <ScanText size={14} />,
  extract:  <Brain size={14} />,
  calendar: <CalendarPlus size={14} />,
  persist:  <Database size={14} />,
};

interface Props {
  pipeline: Pipeline;
  onJumpToTasks?: () => void;
  onJumpToCalendar?: () => void;
}

export default function ProcessingPipeline({ pipeline, onJumpToTasks, onJumpToCalendar }: Props) {
  const { t } = useT();
  const { file, steps, status, extractedCount } = pipeline;
  const isComplete = status === "completed";

  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      {/* 标题行 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <FileText size={14} color="var(--color-primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
          {t("pipe.parsing")}{" "}
          <span style={{ color: "var(--color-primary)" }}>{file.name}</span>
        </span>
        {isComplete && extractedCount !== undefined && (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-success)",
              fontWeight: 600,
              background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            {t("pipe.extracted", { n: extractedCount })}
          </span>
        )}
      </div>

      {steps.map((step, idx) => (
        <StepRow key={step.id} step={step} isLast={idx === steps.length - 1} />
      ))}

      {/* 完成态：跳转操作 */}
      {isComplete && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px dashed var(--color-border)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {onJumpToTasks && <JumpBtn label={t("pipe.viewTasks")} onClick={onJumpToTasks} />}
          {onJumpToCalendar && <JumpBtn label={t("pipe.viewCalendar")} onClick={onJumpToCalendar} />}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, isLast }: { step: PipelineStep; isLast: boolean }) {
  const { t } = useT();
  const detail = getStepDetail(step.id);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        <StepIcon step={step} />
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 18,
              background: step.status === "success" ? "var(--color-success)" : "var(--color-border)",
              marginTop: 4,
              transition: "background 0.3s",
              opacity: step.status === "success" ? 0.4 : 1,
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: step.status === "running" ? 600 : 500,
              color:
                step.status === "pending"
                  ? "var(--color-text-faint)"
                  : step.status === "failed"
                  ? "var(--color-danger)"
                  : "var(--color-text)",
              transition: "color 0.2s",
            }}
          >
            {step.label}
          </span>
          {step.status === "running" && (
            <span
              style={{
                fontSize: 10,
                color: "var(--color-primary)",
                fontWeight: 600,
                animation: "pipeline-pulse 1.4s ease-in-out infinite",
              }}
            >
              {t("pipe.inProgress")}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-faint)",
            margin: "2px 0 0",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {step.detail || detail}
        </p>
      </div>

      <style>{`
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function StepIcon({ step }: { step: PipelineStep }) {
  const size = 24;
  if (step.status === "pending") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {STEP_ICONS[step.id]}
      </div>
    );
  }
  if (step.status === "running") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-primary-soft)",
          border: "1px solid var(--color-primary)",
          color: "var(--color-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "step-spin 1s linear infinite",
        }}
      >
        <Loader2 size={14} />
        <style>{`@keyframes step-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      </div>
    );
  }
  if (step.status === "success") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-success)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={14} strokeWidth={3} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-danger)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <XIcon size={14} strokeWidth={3} />
    </div>
  );
}

function JumpBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid var(--color-primary)",
        background: hov ? "var(--color-primary)" : "var(--color-primary-soft)",
        color: hov ? "white" : "var(--color-primary)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {label}
      <ChevronRight size={12} />
    </button>
  );
}
