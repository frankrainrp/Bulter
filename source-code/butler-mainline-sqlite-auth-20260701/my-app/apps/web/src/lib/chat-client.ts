// ============================================================
// lib/chat-client.ts — 客户端 AI 调用层
// 负责：fetch '/api/chat' + SSE 流解析 + tool calling 自动循环
// ============================================================

import type { ToolResult } from "./ai-tools";
import { recordUsage } from "./usage";
import { DEFAULT_MODEL_ID, isValidModelId, type AiModelId } from "./ai-models";

// OpenAI Chat Completion message 格式（含 tool calls）
export interface ApiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
  /**
   * [057] DeepSeek V4 思考模式：assistant 轮的 CoT 推理内容。
   * 多轮 tool calling 时**必须**把上一轮 assistant 的 reasoning_content 原样
   * 回传给 API，否则 DeepSeek 报 400「reasoning_content must be passed back」。
   */
  reasoning_content?: string;
}

export interface ApiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// 流式回调接口
export interface StreamCallbacks {
  /** 文本内容增量 */
  onContentDelta?: (delta: string) => void;
  /** 思考过程增量（仅思考模式 V4 Pro 返回 reasoning_content 时触发） */
  onReasoningDelta?: (delta: string) => void;
  /** 单条 assistant 消息完成（可能含 tool_calls） */
  onAssistantMessage?: (msg: ApiMessage) => void;
  /** AI 决定调用工具时触发，在执行前 */
  onToolCallStart?: (call: ApiToolCall) => void;
  /** 工具执行结果 */
  onToolCallEnd?: (call: ApiToolCall, result: ToolResult) => void;
  /** 错误 */
  onError?: (err: Error) => void;
  /** 全部完成（含可能的多轮 tool calling） */
  onDone?: () => void;
}

export interface StreamOptions {
  messages: ApiMessage[];
  contextSummary?: string;
  userName?: string;
  includeTools?: boolean;
  /** AI 模型 id（来自 lib/ai-models AiModelId）；不传则用服务端默认 */
  model?: string;
  /** G5.1 管家性格 "gentle" | "standard" | "sassy" */
  personality?: string;
  executeToolCall: (call: ApiToolCall) => Promise<ToolResult>;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
  /** 防止无限循环（默认 5） */
  maxRounds?: number;
}

// SSE 流原始 chunk（OpenAI 格式简化）
interface SseChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      /** DeepSeek V4 思考模式 / Reasoner 系列返回的 CoT 推理增量 */
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  /** [087] include_usage 流尾 chunk：choices 为空，仅带 token 用量 */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
}

// ============================================================
// 主入口：自动多轮 tool calling
// ============================================================
export async function streamChat(opts: StreamOptions): Promise<void> {
  const maxRounds = opts.maxRounds ?? 5;
  let messages = [...opts.messages];

  for (let round = 0; round < maxRounds; round++) {
    const { assistantMsg, hadToolCalls } = await streamOneRound({
      messages,
      contextSummary: opts.contextSummary,
      userName: opts.userName,
      includeTools: opts.includeTools,
      model: opts.model,
      personality: opts.personality,
      callbacks: opts.callbacks,
      signal: opts.signal,
    });

    messages.push(assistantMsg);
    opts.callbacks.onAssistantMessage?.(assistantMsg);

    if (!hadToolCalls) break;

    // 执行所有 tool_calls，收集 tool result 消息
    const toolResultMessages: ApiMessage[] = [];
    for (const call of assistantMsg.tool_calls ?? []) {
      opts.callbacks.onToolCallStart?.(call);
      let result: ToolResult;
      try {
        result = await opts.executeToolCall(call);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result = { ok: false, message: `工具执行异常：${msg}` };
      }
      opts.callbacks.onToolCallEnd?.(call, result);
      toolResultMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
    messages = [...messages, ...toolResultMessages];
  }

  opts.callbacks.onDone?.();
}

// ============================================================
// 单轮流式调用
// ============================================================
async function streamOneRound(opts: {
  messages: ApiMessage[];
  contextSummary?: string;
  userName?: string;
  includeTools?: boolean;
  model?: string;
  personality?: string;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<{ assistantMsg: ApiMessage; hadToolCalls: boolean }> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: opts.messages,
        contextSummary: opts.contextSummary,
        userName: opts.userName,
        includeTools: opts.includeTools !== false,
        model: opts.model,
        personality: opts.personality,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    // 用户主动中止：静默 throw 让外层 streamChat for-loop 退出，不触发 onError
    if (err instanceof Error && (err.name === "AbortError" || err.name === "DOMException")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    opts.callbacks.onError?.(new Error(`网络请求失败：${msg}`));
    throw err;
  }

  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.error || detail;
    } catch { /* ignore */ }
    const err = new Error(detail);
    opts.callbacks.onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  // [057] 累积本轮 reasoning_content，多轮 tool calling 时必须回传给 DeepSeek
  let reasoning = "";
  // 跟踪本轮是否已有过有效数据增量 — 若服务端尾部又发 error chunk（理论上
  // 已被服务端 [chat/route] 抑制，这里是双保险），不再触发 onError 误显
  // "出错了" 气泡，仅 console.warn。
  let hasReceivedDelta = false;
  const toolCallsAcc: Map<number, ApiToolCall> = new Map();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 按 \n\n 分隔事件
    let sepIdx;
    while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
      const rawEvent = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      // 提取 data: 行
      const dataLines = rawEvent
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      const data = dataLines.join("");

      if (!data) continue;
      if (data === "[DONE]") continue;

      let chunk: SseChunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }

      if (chunk.error) {
        if (hasReceivedDelta) {
          // 良性尾部错误：内容/思考/工具已完整流出，不打扰用户
          // eslint-disable-next-line no-console
          console.warn("[chat-client] tail error after data (suppressed):", chunk.error);
        } else {
          opts.callbacks.onError?.(new Error(chunk.error));
        }
        continue;
      }

      // [087] 真实成本计量：流尾 usage chunk → 按所选模型单价折 ¥ 记入当前 5h 窗口
      if (chunk.usage) {
        const model: AiModelId =
          opts.model && isValidModelId(opts.model) ? opts.model : DEFAULT_MODEL_ID;
        recordUsage(model, chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
        continue;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      // 文本增量
      if (delta.content) {
        content += delta.content;
        hasReceivedDelta = true;
        opts.callbacks.onContentDelta?.(delta.content);
      }

      // 思考增量（V4 思考模式 / Reasoner）
      if (delta.reasoning_content) {
        hasReceivedDelta = true;
        reasoning += delta.reasoning_content; // [057] 累积以便回传
        opts.callbacks.onReasoningDelta?.(delta.reasoning_content);
      }

      // tool_calls 增量（分片拼装）
      if (delta.tool_calls) {
        hasReceivedDelta = true;
        for (const tcDelta of delta.tool_calls) {
          const existing = toolCallsAcc.get(tcDelta.index) ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (tcDelta.id) existing.id = tcDelta.id;
          if (tcDelta.function?.name) existing.function.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) existing.function.arguments += tcDelta.function.arguments;
          toolCallsAcc.set(tcDelta.index, existing);
        }
      }
    }
  }

  const tool_calls = Array.from(toolCallsAcc.values());
  const hadToolCalls = tool_calls.length > 0;

  const assistantMsg: ApiMessage = {
    role: "assistant",
    content: content || null,
    ...(hadToolCalls ? { tool_calls } : {}),
    // [057] 思考模式：带 tool_calls 的 assistant 轮必须回传 reasoning_content，
    // 否则下一轮 DeepSeek 报 400。无 tool call 时不回传（无需续轮）。
    ...(hadToolCalls && reasoning ? { reasoning_content: reasoning } : {}),
  };

  return { assistantMsg, hadToolCalls };
}
