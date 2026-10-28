"use client";

// ============================================================
// components/ChatCanvas.tsx — 漫画式对话主区（居中管家版）
//
// 设计：管家绝对定位贴主区底部水平居中，处于输入框后层（z-index < 输入区）；
//      历史区 / 输入区对称居中（max-width 800），不再左偏；
//      AI 消息墨绿描边白底气泡，用户消息墨绿淡底气泡；
//      InputPod 自带白底自然遮挡管家下半身，营造"踩在输入框后"的层次。
// ============================================================

import React, { useRef, useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, File as FileIcon, Brain, ChevronDown, Copy, RefreshCw, Check as CheckIcon, TrendingUp, LayoutDashboard, Workflow } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ProcessingPipeline as Pipeline, UploadedFile, DdlItem } from "@/lib/types";
import type { PendingBatch } from "@/lib/pending";
import { getModelMeta, type AiModelId } from "@/lib/ai-models";
import ProcessingPipeline from "./ProcessingPipeline";
import ButlerCharacter, { type ButlerPose } from "./ButlerCharacter";
import { useIsMobile } from "@/lib/use-is-mobile";
import ConfirmCard from "./ConfirmCard";
import InputPod from "./InputPod";
import { useT, type TFunc } from "@/lib/i18n";

export type Message = ChatMessage;

// 新对话快捷提示词：3 类（进度追踪 / 面板创建 / AI 工作流）。文案走 i18n key。
const PROMPT_GROUPS: { id: string; titleKey: string; icon: React.ReactNode; promptKeys: string[] }[] = [
  {
    id: "progress",
    titleKey: "chat.prompt.progress.title",
    icon: <TrendingUp size={15} color="var(--color-primary)" />,
    promptKeys: ["chat.prompt.progress.1", "chat.prompt.progress.2", "chat.prompt.progress.3"],
  },
  {
    id: "panel",
    titleKey: "chat.prompt.panel.title",
    icon: <LayoutDashboard size={15} color="var(--color-primary)" />,
    promptKeys: ["chat.prompt.panel.1", "chat.prompt.panel.2", "chat.prompt.panel.3"],
  },
  {
    id: "workflow",
    titleKey: "chat.prompt.workflow.title",
    icon: <Workflow size={15} color="var(--color-primary)" />,
    promptKeys: ["chat.prompt.workflow.1", "chat.prompt.workflow.2", "chat.prompt.workflow.3"],
  },
];

// 对话栏 / 历史流的最大宽度（居中布局）
const CONTENT_MAX = 800;

// 时段问候（本地，零 token）→ 返回 i18n key
function greetingTimeKey(): string {
  const h = new Date().getHours();
  if (h < 6) return "chat.greet.night";
  if (h < 11) return "chat.greet.morning";
  if (h < 14) return "chat.greet.noon";
  if (h < 18) return "chat.greet.afternoon";
  return "chat.greet.evening";
}

interface ChatCanvasProps {
  messages: ChatMessage[];
  pipelines: Record<string, Pipeline>;
  pendingBatches: Record<string, PendingBatch>;
  butlerPose: ButlerPose;
  onAcceptBatch: (batchId: string) => void;
  onRejectBatch: (batchId: string) => void;
  onDropChange: (batchId: string, changeId: string) => void;
  onQuickAction: (prompt: string) => void;
  isLoading?: boolean;
  onJumpToTasks: () => void;
  onJumpToCalendar: () => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onStop?: () => void;
  /** 重新生成：抹掉该 assistant 消息及之后所有消息，重发上一条 user */
  onRegenerate?: (assistantMessageId: string) => void;
  attachedFiles: UploadedFile[];
  onAttach: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  selectedModel?: AiModelId;
  onSelectModel?: (id: AiModelId) => void;
  // Epic 4.1 今日 Hero 卡(欢迎屏显示)
  ddls?: DdlItem[];
  onJumpToTask?: (taskId: string) => void;
  // G1.1 Demo 数据按钮(仅在 ddls/notes 都为空时显示)
  onLoadDemo?: () => void;
  hasAnyData?: boolean;
  // G2.1 / G5.2 透传给 TodayHero
  streakDays?: number;
  bestHourLabel?: string | null;
  // Phase D 管家位置（"left" | "center" | "right" | "hidden"）
  butlerPosition?: "left" | "center" | "right" | "hidden";
  // [065] 每日仪式 · 今日简报（每天首次打开顶部出现一次）
  showDailyBrief?: boolean;
  onStartFocus?: () => void;
  onDismissBrief?: () => void;
}

// ============================================================
// 用户消息：简单墨绿淡底气泡（右对齐）
// ============================================================
function UserBubble({ msg }: { msg: ChatMessage }) {
  const hasFiles = msg.files && msg.files.length > 0;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        className="comic-bubble ap-bubble ap-bubble-user"
        style={{
          position: "relative",
          maxWidth: "80%",
          background: "var(--color-primary-soft)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
          borderRadius: "var(--radius-card)",
          padding: "10px 14px",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      >
        {hasFiles && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: msg.content ? 6 : 0,
            }}
          >
            {msg.files!.map((f) => (
              <UserFileChip key={f.id} file={f} />
            ))}
          </div>
        )}
        {msg.content && (
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text)",
              lineHeight: 1.55,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </p>
        )}
      </div>
    </div>
  );
}

function UserFileChip({ file }: { file: UploadedFile }) {
  const isImage = file.mime.startsWith("image/");
  const isPdf = file.mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const Icon = isImage ? ImageIcon : isPdf ? FileText : FileIcon;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 6,
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        fontSize: 11,
        color: "var(--color-text)",
        maxWidth: 220,
      }}
    >
      <Icon size={12} color="var(--color-primary)" style={{ flexShrink: 0 }} />
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: 500,
        }}
      >
        {file.name}
      </span>
    </div>
  );
}

// ============================================================
// 思考折叠面板（V4 思考模式 reasoning_content）
//   - 思考中（还没出正文）：默认展开
//   - 思考结束（content 已开始）：默认折叠成"已思考"
//   - 用户手动 toggle 后以用户偏好为准
// ============================================================
function ReasoningPanel({
  reasoning, thinkingActive,
}: { reasoning: string; thinkingActive: boolean }) {
  const { t } = useT();
  const [forced, setForced] = useState<boolean | null>(null);
  const open = forced ?? thinkingActive;
  return (
    <div
      style={{
        marginBottom: 10,
        borderRadius: 10,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-soft)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setForced(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "6px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          color: "var(--color-text-muted)",
          textAlign: "left",
        }}
      >
        <Brain size={13} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>
          {thinkingActive ? t("chat.thinking") : t("chat.thought")}
        </span>
        {thinkingActive && (
          <span
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--color-primary)",
              animation: "cursor-blink 0.8s steps(2) infinite",
            }}
          />
        )}
        <span style={{ flex: 1 }} />
        <ChevronDown
          size={13}
          color="var(--color-text-faint)"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: "0 10px 10px",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderTop: "1px solid var(--color-border-soft)",
            paddingTop: 8,
            maxHeight: 280,
            overflowY: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          {reasoning}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 管家漫画对话框（无头像，墨绿粗边白底，尾巴指向左下管家）
// ============================================================
function MessageToolbar({
  content, isError, onRegenerate, alwaysVisible,
}: {
  content: string;
  isError?: boolean;
  onRegenerate?: () => void;
  /** error 消息常显工具栏；普通消息仅 hover 显示 */
  alwaysVisible?: boolean;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 老浏览器降级（少见）
      console.warn("[copy] clipboard API unavailable");
    }
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginTop: 8,
        opacity: alwaysVisible ? 1 : 0,
        transition: "opacity 0.15s",
      }}
      className={alwaysVisible ? "" : "msg-toolbar"}
    >
      <button
        onClick={handleCopy}
        aria-label={copied ? t("chat.copied") : t("chat.copy")}
        title={copied ? t("chat.copied") : t("chat.copy")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          fontSize: 11,
          fontFamily: "inherit",
          color: copied ? "var(--color-success)" : "var(--color-text-muted)",
          background: "transparent",
          border: "1px solid var(--color-border-soft)",
          borderRadius: 6,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        {copied ? <CheckIcon size={11} /> : <Copy size={11} />}
        {copied ? t("chat.copied") : t("chat.copy")}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label={isError ? t("chat.retry") : t("chat.regen")}
          title={isError ? t("chat.retry") : t("chat.regen")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            fontSize: 11,
            fontFamily: "inherit",
            color: isError ? "var(--color-danger, #dc2626)" : "var(--color-text-muted)",
            background: "transparent",
            border: `1px solid ${isError ? "var(--color-danger, #dc2626)" : "var(--color-border-soft)"}`,
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isError ? "var(--color-danger-soft)" : "var(--color-surface)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <RefreshCw size={11} />
          {isError ? t("chat.retry") : t("chat.regen")}
        </button>
      )}
    </div>
  );
}

/** 思考点：AI 首字未到时的「管家斟酌中」指示（3 点错相跳动）*/
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-primary)",
            animation: "dot-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

/** 管家头顶漫画思考框：thinking 阶段缩放弹入，思考完淡出（纯 CSS，零素材）。
 *  主泡 + 两个递减尾泡指向左下管家头，内嵌 TypingDots 跳动点。 */
function ThoughtBubble({ visible }: { visible: boolean }) {
  const bubble: React.CSSProperties = {
    position: "absolute",
    background: "var(--color-surface)",
    border: "1.5px solid var(--color-primary)",
    borderRadius: "50%",
    boxShadow: "var(--shadow-bubble)",
  };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        bottom: "88%",
        left: "calc(50% + 14px)",
        width: 64,
        height: 48,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.5)",
        transformOrigin: "bottom left",
        // 出现弹入 / 消失舒缓（拉长淡出，避免"啪"地消失）
        transition: visible
          ? "opacity 0.3s ease, transform 0.4s cubic-bezier(.5,1.7,.45,1)"
          : "opacity 0.7s ease, transform 0.6s ease",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {/* 主泡（内含跳动点）*/}
      <div style={{ ...bubble, left: 8, top: 0, width: 54, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <TypingDots />
      </div>
      {/* 尾泡（指向左下管家头）*/}
      <div style={{ ...bubble, left: 6, top: 33, width: 12, height: 12 }} />
      <div style={{ ...bubble, left: 0, top: 42, width: 7, height: 7 }} />
    </div>
  );
}

function ButlerBubble({
  content, reasoning, isTyping, showReasoning = true, isError, onRegenerate,
}: {
  content: string;
  reasoning?: string;
  isTyping?: boolean;
  /** 是否渲染思考折叠面板（Flash 模式默认 false,reasoning 仍持久化但不展示） */
  showReasoning?: boolean;
  /** error 消息：红色边框 + 永显 retry */
  isError?: boolean;
  /** 重新生成 / 重试 callback；缺省则不显示该按钮 */
  onRegenerate?: () => void;
}) {
  const hasReasoning = showReasoning && !!(reasoning && reasoning.trim());
  // 思考过程已结束的判断：reasoning 存在但正文已经开始（content 非空）
  const thinkingActive = hasReasoning && !content;
  const borderColor = isError ? "var(--color-danger)" : "var(--color-primary)";
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }} className="bubble-wrap">
      <div
        className="comic-bubble ap-bubble ap-bubble-ai"
        style={{
          position: "relative",
          maxWidth: "90%",
          background: "var(--color-surface)",
          border: isError ? `1.5px solid ${borderColor}` : "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "12px 16px",
          boxShadow: "var(--shadow-bubble)",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      >
        {hasReasoning && (
          <ReasoningPanel reasoning={reasoning!} thinkingActive={thinkingActive} />
        )}
        <div
          className="ai-md"
          style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.65 }}
        >
          {isTyping && !content ? (
            /* 首字未到：管家斟酌中的思考点 */
            <TypingDots />
          ) : (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || " "}</ReactMarkdown>
              {isTyping && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    background: "var(--color-primary)",
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "cursor-blink 1s steps(2) infinite",
                  }}
                />
              )}
            </>
          )}
        </div>
        {/* 工具栏：流式中（isTyping）隐藏；error 时常显；其他 hover 显示 */}
        {!isTyping && content && (
          <MessageToolbar
            content={content}
            isError={isError}
            onRegenerate={onRegenerate}
            alwaysVisible={isError}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function ChatCanvas(props: ChatCanvasProps) {
  const {
    messages,
    pipelines,
    pendingBatches,
    butlerPose,
    onAcceptBatch,
    onRejectBatch,
    onDropChange,
    onQuickAction,
    isLoading = false,
    onJumpToTasks,
    onJumpToCalendar,
    inputValue,
    onInputChange,
    onSend,
    onStop,
    onRegenerate,
    attachedFiles,
    onAttach,
    onRemoveAttachment,
    selectedModel,
    onSelectModel,
    ddls = [],
    onJumpToTask,
    onLoadDemo,
    hasAnyData = false,
    streakDays = 0,
    bestHourLabel,
    butlerPosition = "center",
    showDailyBrief = false,
    onStartFocus,
    onDismissBrief,
  } = props;

  const { t } = useT();

  // Phase D 管家位置 → 容器定位
  // hidden 时整个不渲染；left/right 改 left% + transform origin
  const butlerStyle = ((): React.CSSProperties | null => {
    if (butlerPosition === "hidden") return null;
    const base: React.CSSProperties = {
      position: "absolute",
      bottom: 0,
      pointerEvents: "none",
      zIndex: 1,
    };
    if (butlerPosition === "left") {
      return { ...base, left: 24, transform: "none" };
    }
    if (butlerPosition === "right") {
      return { ...base, right: 24, transform: "none" };
    }
    return { ...base, left: "50%", transform: "translateX(-50%)" };
  })();
  const historyRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // 思考模式时才展示 reasoning 折叠面板；Flash 模式即使 API 返回轻量 CoT 也不渲染
  const showReasoning = !!(selectedModel && getModelMeta(selectedModel).thinking);

  // 自动滚到底 — 用户向上滚后禁用
  useEffect(() => {
    if (!autoScroll) return;
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, pipelines, pendingBatches, autoScroll]);

  const onScroll = () => {
    const el = historyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // 最新一条 assistant id（用于在最新气泡末尾显示 typing cursor）
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const isEmpty = messages.length === 0;
  const isMobile = useIsMobile();

  // 需求1：管家默认隐藏，仅 AI 活动（pose 非 standing 空闲态）时升起出现
  const butlerActive = butlerPose !== "standing";
  // 需求3：思考阶段（首字未到）头顶显示漫画思考框
  const isThinking = butlerPose === "thinking" || butlerPose === "thinking-hard" || butlerPose === "rare-thinking";

  return (
    <main
      className="ap-chat"
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "transparent",
        position: "relative",
      }}
    >
      {/* 浮动管家 — Phase D 位置可配；需求1：standing(空闲)时透明下沉隐藏，
          AI 活动时升起出现；需求3：thinking 时头顶漫画思考框 */}
      {butlerStyle && (
        <div style={butlerStyle}>
          <div
            style={{
              position: "relative",
              opacity: butlerActive ? 1 : 0,
              transform: butlerActive ? "translateY(0)" : "translateY(18px)",
              // 出现利落(回弹) / 消失舒缓：退场延迟 0.3s 让管家多停留，再 1s 缓缓淡下沉
              transition: butlerActive
                ? "opacity 0.4s ease, transform 0.5s cubic-bezier(.34,1.4,.5,1)"
                : "opacity 1s ease 0.3s, transform 1s ease 0.3s",
            }}
          >
            <ThoughtBubble visible={isThinking} />
            <ButlerCharacter pose={butlerPose} scale={isMobile ? 0.24 : 0.33} />
          </div>
        </div>
      )}

      {/* 历史区 */}
      <div
        ref={historyRef}
        onScroll={onScroll}
        className="message-stream"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "14px 12px 10px" : "24px 32px 14px",
          minHeight: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        {isEmpty ? (
          /* Claude 式新对话：问候 + 居中输入框 + 3 类快捷提示词 */
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 22,
              maxWidth: 720,
              width: "100%",
              margin: "0 auto",
              padding: "12px 0",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h2 className="font-display" style={{ fontSize: 27, fontWeight: 700, color: "var(--color-text)", margin: 0, letterSpacing: "-0.4px" }}>
                {t("chat.greetingLine", { time: t(greetingTimeKey()) })}
              </h2>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                {t("chat.subtitle")}
              </p>
            </div>

            {/* 居中输入框（新对话焦点）*/}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <InputPod
                value={inputValue}
                onChange={onInputChange}
                onSend={onSend}
                onStop={onStop}
                isLoading={isLoading}
                attachedFiles={attachedFiles}
                onAttach={onAttach}
                onRemoveAttachment={onRemoveAttachment}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
              />
            </div>

            {/* 3 类快捷提示词 */}
            <PromptSuggestions onPick={onQuickAction} onLoadDemo={!hasAnyData ? onLoadDemo : undefined} />

            <p style={{ fontSize: 11, color: "var(--color-text-faint)", margin: 0 }}>
              {t("chat.disclaimer")}
            </p>
          </div>
        ) : (
          /* 历史消息流：去 max-width 居中容器,让 AI 气泡彻底贴 main 左 padding */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {messages.map((msg) => {
              if (msg.role === "user") return <UserBubble key={msg.id} msg={msg} />;
              if (msg.role === "pipeline" && msg.pipelineId) {
                const pipeline = pipelines[msg.pipelineId];
                if (!pipeline) return null;
                return (
                  <ProcessingPipeline
                    key={msg.id}
                    pipeline={pipeline}
                    onJumpToTasks={onJumpToTasks}
                    onJumpToCalendar={onJumpToCalendar}
                  />
                );
              }
              if (msg.role === "confirm" && msg.confirmBatchId) {
                const batch = pendingBatches[msg.confirmBatchId];
                if (!batch) return null;
                // 核实卡居中浮在管家上方（区别于普通 AI 消息的左对齐,强调"等待你决策"）
                return (
                  <div key={msg.id} className="comic-bubble" style={{ display: "flex", justifyContent: "center" }}>
                    <ConfirmCard
                      batch={batch}
                      onAccept={onAcceptBatch}
                      onReject={onRejectBatch}
                      onDropChange={onDropChange}
                    />
                  </div>
                );
              }
              // assistant
              const isTyping = isLoading && msg.id === lastAssistantId;
              return (
                <ButlerBubble
                  key={msg.id}
                  content={msg.content}
                  reasoning={msg.reasoning}
                  isTyping={isTyping}
                  showReasoning={showReasoning}
                  isError={msg.isError}
                  onRegenerate={onRegenerate ? () => onRegenerate(msg.id) : undefined}
                />
              );
            })}
            {/* 流式中：assistant 消息尚未建出（首个 delta 之前）→ 占位 typing 气泡 */}
            {isLoading && lastAssistantId === null && (
              <ButlerBubble content="" isTyping />
            )}
          </div>
        )}
      </div>

      {/* 输入区（仅有对话时贴底；新对话时输入框居中在上方）*/}
      {!isEmpty && (
        <div
          style={{
            padding: isMobile ? "8px 10px 10px" : "12px 32px 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ width: "100%", maxWidth: CONTENT_MAX, display: "flex", justifyContent: "center" }}>
            <InputPod
              value={inputValue}
              onChange={onInputChange}
              onSend={onSend}
              onStop={onStop}
              isLoading={isLoading}
              attachedFiles={attachedFiles}
              onAttach={onAttach}
              onRemoveAttachment={onRemoveAttachment}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
            />
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--color-text-faint)",
              margin: 0,
            }}
          >
            {t("chat.disclaimer")}
          </p>
        </div>
      )}

      <style>{`
        @keyframes bubble-pop {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes cursor-blink {
          to { background: transparent; }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .ai-md p { margin: 0 0 6px; }
        .ai-md p:last-child { margin-bottom: 0; }
        .ai-md ul, .ai-md ol { margin: 4px 0 6px; padding-left: 20px; }
        .ai-md li { margin: 2px 0; }
        .ai-md code { background: var(--color-primary-soft); padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12.5px; color: var(--color-primary); }
        .ai-md pre { background: var(--color-code-bg); color: var(--color-code-text); padding: 10px; border-radius: 8px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; margin: 6px 0; }
        .ai-md pre code { background: transparent; color: inherit; padding: 0; }
        .ai-md a { color: var(--color-primary); text-decoration: underline; }
        .ai-md strong { font-weight: 600; }
        .ai-md table { border-collapse: collapse; margin: 6px 0; font-size: 12.5px; }
        .ai-md th, .ai-md td { border: 1px solid var(--color-border); padding: 4px 8px; text-align: left; }
        .ai-md th { background: var(--color-surface); font-weight: 600; }
        /* hover ButlerBubble 显示工具栏（error 永显走 inline alwaysVisible） */
        .bubble-wrap:hover .msg-toolbar { opacity: 1 !important; }
      `}</style>
    </main>
  );
}

// ============================================================
// 新对话快捷提示词（Claude 式 3 类卡片）
// ============================================================
function PromptSuggestions({ onPick, onLoadDemo }: { onPick: (prompt: string) => void; onLoadDemo?: () => void }) {
  const isMobile = useIsMobile();
  const { t } = useT();
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)", // 手机端也三栏并排，省竖向空间
          gap: isMobile ? 8 : 12,
          alignItems: "start", // 折叠卡各自自然高度，展开某张不撑高同行其它卡
        }}
      >
        {PROMPT_GROUPS.map((g) => (
          <PromptGroupCard key={g.id} group={g} onPick={onPick} isMobile={isMobile} t={t} />
        ))}
      </div>
      {onLoadDemo && (
        <button
          onClick={onLoadDemo}
          style={{
            alignSelf: "center",
            padding: "7px 16px",
            border: "1px solid var(--color-border)",
            borderRadius: 999,
            background: "var(--color-surface)",
            color: "var(--color-text-muted)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-primary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
        >
          {t("chat.demo")}
        </button>
      )}
    </div>
  );
}

// 提示词卡：默认只显标题（点开才展开具体提示词）
function PromptGroupCard({
  group, onPick, isMobile, t,
}: {
  group: { id: string; titleKey: string; icon: React.ReactNode; promptKeys: string[] };
  onPick: (prompt: string) => void;
  isMobile?: boolean;
  t: TFunc;
}) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        // 手机端展开时跨满整行，避免提示词被挤进 1/3 窄列；折叠时三栏并排
        gridColumn: isMobile && open ? "1 / -1" : undefined,
        border: `1px solid ${open ? "var(--color-primary)" : "var(--color-border)"}`,
        borderRadius: 14,
        background: "var(--color-surface)",
        padding: open ? "12px 12px 8px" : isMobile ? "10px 8px" : "12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        transition: "border-color 0.15s",
      }}
    >
      {/* 标题行（默认态：可点开）*/}
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: isMobile && !open ? 4 : 6,
          justifyContent: isMobile && !open ? "center" : "flex-start",
          width: "100%", padding: isMobile && !open ? "2px 0" : "2px 4px",
          border: "none", background: "transparent",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        {group.icon}
        <span style={{
          flex: isMobile && !open ? "0 1 auto" : 1,
          fontSize: 12.5, fontWeight: 700,
          color: open || hov ? "var(--color-text)" : "var(--color-text-muted)",
          transition: "color 0.12s",
          whiteSpace: "nowrap",
        }}>{t(group.titleKey)}</span>
        {/* 折叠态手机端隐藏 chevron 省横向空间 */}
        {!(isMobile && !open) && (
          <ChevronDown
            size={14}
            color="var(--color-text-faint)"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.18s", flexShrink: 0 }}
          />
        )}
      </button>

      {/* 展开态：具体提示词 */}
      {open && group.promptKeys.map((k) => {
        const text = t(k);
        return <PromptLine key={k} text={text} onClick={() => onPick(text)} />;
      })}
    </div>
  );
}

function PromptLine({ text, onClick }: { text: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "7px 8px",
        borderRadius: 8,
        border: "none",
        background: hov ? "var(--color-bg)" : "transparent",
        color: hov ? "var(--color-text)" : "var(--color-text-muted)",
        fontSize: 12.5,
        lineHeight: 1.4,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {text}
    </button>
  );
}
