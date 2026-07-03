// ============================================================
// lib/chat-client.ts — 客户端 AI 调用层
// 负责：fetch '/express-api/chat' + SSE 流解析 + tool calling 自动循环
//
// 数据流总览：
// 1. UI 组件把当前 messages/context/model/personality 传进 streamChat。
// 2. streamOneRound 通过 /express-api/chat 请求 Express 后端，后端再转发给 DeepSeek。
// 3. 浏览器逐段读取 SSE，把 content/reasoning/tool_calls 分别拼回完整 assistant 消息。
// 4. 如果 assistant 要调工具，则调用 executeToolCall 在前端本地执行，并把 tool result 作为下一轮消息回传。
// 5. 没有 tool_calls 时结束整次对话，触发 onDone。
// ============================================================

import type { ToolResult } from "./ai-tools";
import { recordUsage } from "./usage";
import { DEFAULT_MODEL_ID, isValidModelId, type AiModelId } from "./ai-models";

// OpenAI Chat Completion message 格式（含 tool calls）
export interface ApiMessage {
  /** system/user/assistant/tool 与 OpenAI Chat Completions 协议保持一致 */
  role: "system" | "user" | "assistant" | "tool";
  /** assistant 发起 tool call 时 content 可以为 null */
  content: string | null;
  /** assistant 消息上携带的工具调用列表；由 SSE 增量拼装出来 */
  tool_calls?: ApiToolCall[];
  /** tool 消息必须带 tool_call_id，用来对应上一轮 assistant 的某个 tool call */
  tool_call_id?: string;
  /**
   * [057] DeepSeek V4 思考模式：assistant 轮的 CoT 推理内容。
   * 多轮 tool calling 时**必须**把上一轮 assistant 的 reasoning_content 原样
   * 回传给 API，否则 DeepSeek 报 400「reasoning_content must be passed back」。
   */
  reasoning_content?: string;
}

// 单个函数式工具调用。
// function.arguments 是模型输出的 JSON 字符串，真正解析和执行在 tool-executor.ts 中完成。
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
  /** 工具执行函数由页面注入，chat-client 只负责编排“模型要求调用 -> 执行 -> 回传结果” */
  executeToolCall: (call: ApiToolCall) => Promise<ToolResult>;
  callbacks: StreamCallbacks;
  /** AbortController 信号，用于用户点击停止生成时中断 fetch/reader */
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
  // maxRounds 是保险丝：如果模型不断要求调用工具，最多循环 N 轮后停止，避免无限扣费/卡 UI。
  const maxRounds = opts.maxRounds ?? 5;
  // messages 是本次对话的“滚动上下文”。每一轮都会追加 assistant 消息和 tool 消息。
  let messages = [...opts.messages];

  for (let round = 0; round < maxRounds; round++) {
    // 先请求模型生成一轮 assistant 输出。输出可能是普通文本，也可能包含一个或多个 tool_calls。
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

    // 把完整 assistant 消息加入上下文，并通知 UI 持久化/展示本轮消息。
    messages.push(assistantMsg);
    opts.callbacks.onAssistantMessage?.(assistantMsg);

    // 没有工具调用，说明模型已经给出最终回答，本次 streamChat 可以结束。
    if (!hadToolCalls) break;

    // 执行所有 tool_calls，收集 tool result 消息
    const toolResultMessages: ApiMessage[] = [];
    for (const call of assistantMsg.tool_calls ?? []) {
      // onToolCallStart/onToolCallEnd 只负责 UI 状态，如显示“正在调用工具”。
      opts.callbacks.onToolCallStart?.(call);
      let result: ToolResult;
      try {
        // 真正的业务变更由外部 executeToolCall 完成，chat-client 不直接认识 DDL/Note/Panel 数据结构。
        result = await opts.executeToolCall(call);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 工具异常也要转成 tool result 回给模型，让模型能自然解释失败，而不是整条聊天崩掉。
        result = { ok: false, message: `Tool execution failed: ${msg}` };
      }
      opts.callbacks.onToolCallEnd?.(call, result);
      toolResultMessages.push({
        role: "tool",
        tool_call_id: call.id,
        // OpenAI 协议要求 tool 消息 content 是字符串，所以把结构化结果 JSON 化。
        content: JSON.stringify(result),
      });
    }
    // 下一轮模型会同时看到 assistant 的 tool_calls 和对应 tool result，从而生成最终自然语言回复。
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
    // Express 后端暴露为 /express-api/chat；它会再代理到 DeepSeek 并保持 SSE 返回。
    res = await fetch("/express-api/chat", {
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
    opts.callbacks.onError?.(new Error(`Network request failed: ${msg}`));
    throw err;
  }

  if (!res.ok || !res.body) {
    // 非 2xx 或无 body 都无法继续读取 SSE。尽量从 JSON body 中提取后端 error 字段。
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
  // buffer 保存尚未凑齐完整 SSE 事件的残片。
  let buffer = "";
  // content/reasoning/toolCallsAcc 分别累积本轮 assistant 的三类输出。
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
    // TextDecoder stream:true 可以处理 UTF-8 多字节字符被网络分片切开的情况。
    buffer += decoder.decode(value, { stream: true });

    // SSE 按 \n\n 分隔事件
    let sepIdx;
    while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
      const rawEvent = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      // 提取 data: 行
      // 一个 SSE event 可能有多行 data，这里合并后再 JSON.parse。
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
        // 遇到非 JSON data 时跳过，保持流式 UI 不被单个坏包打断。
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
          // OpenAI/DeepSeek 会把同一个 tool_call 拆成多个 delta。
          // index 表示第几个工具调用，id/name/arguments 可能分批抵达，所以这里按 index 聚合。
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
    // 只有确实有工具调用时才带 tool_calls 字段，保持普通 assistant 消息简洁。
    ...(hadToolCalls ? { tool_calls } : {}),
    // [057] 思考模式：带 tool_calls 的 assistant 轮必须回传 reasoning_content，
    // 否则下一轮 DeepSeek 报 400。无 tool call 时不回传（无需续轮）。
    ...(hadToolCalls && reasoning ? { reasoning_content: reasoning } : {}),
  };

  return { assistantMsg, hadToolCalls };
}
