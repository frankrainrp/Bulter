import { ChatRequestError, InterruptedReply, errorForResponse } from '../assistant.js';

// The model pages document these exact aliases/snapshots as Responses-only.
// GPT-5.5 Pro and the older o-series Pro models do not support streaming.
const bufferedModels = new Set([
  'gpt-5.5-pro',
  'gpt-5.5-pro-2026-04-23',
  'o3-pro',
  'o3-pro-2025-06-10',
  'o1-pro',
  'o1-pro-2025-03-19',
]);
const streamingModels = new Set([
  'gpt-5.4-pro',
  'gpt-5.4-pro-2026-03-05',
  'gpt-5.2-pro',
  'gpt-5.2-pro-2025-12-11',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex-max',
  'gpt-5-codex',
  'codex-mini-latest',
]);

// These public chat aliases all support Responses function calling. Some versions
// require it for tools or would otherwise require turning off reasoning.
const generalChatModels = new Set([
  'gpt-6.2-astra',
  'gpt-6.2-sol',
  'gpt-6.1-terra',
  'gpt-6.1-sol',
  'gpt-6-astra',
  'gpt-6-sol',
  'gpt-6-luna',
]);

export function usesOpenAIResponses(provider, id, withTools = false) {
  return (
    provider === 'openai' &&
    (bufferedModels.has(id) || streamingModels.has(id) || (withTools && generalChatModels.has(id)))
  );
}

const maxAnswer = 2_000_000;
const maxEvent = 12 * 1024 * 1024;
const invalid = 'OpenAI returned an invalid response.';

function asItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(invalid);
  return value;
}

function parseItem(value) {
  try {
    return asItem(JSON.parse(value));
  } catch {
    throw new Error(invalid);
  }
}

function checkAnswer(text) {
  if (text.length > maxAnswer)
    throw new Error('This answer exceeds two million characters. Ask for the result in sections.');
}

function replyText(output) {
  const messages = [];
  for (const item of output) {
    if (item.type !== 'message') continue;
    if (item.role !== 'assistant' || !Array.isArray(item.content)) throw new Error(invalid);
    const parts = [];
    for (const raw of item.content) {
      const part = asItem(raw);
      const text = part.type === 'refusal' ? part.refusal : part.type === 'output_text' ? part.text : undefined;
      if (typeof text === 'string') parts.push(text);
    }
    if (parts.length) messages.push(parts.join(''));
  }
  return messages.join('\n\n');
}

function stopped(signal, partial) {
  if (signal.aborted) throw new InterruptedReply(partial);
}

async function readResponse(response, stream, signal, prefix, onProgress, onActivity) {
  const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (!response.body || type !== (stream ? 'text/event-stream' : 'application/json')) {
    void response.body?.cancel().catch(() => {});
    throw new ChatRequestError('OpenAI returned an unexpected response format.', true);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel);
  let buffer = '';
  let partial = prefix;
  try {
    for (;;) {
      stopped(signal, partial);
      const { done, value } = await reader.read().catch(() => {
        throw new InterruptedReply(partial);
      });
      stopped(signal, partial);
      buffer += decoder.decode(value, { stream: !done });
      if (done && !stream) return parseItem(buffer);
      if (stream) {
        let receivedText = false;
        let activity = false;
        for (let boundary = /\r?\n\r?\n/.exec(buffer); boundary; boundary = /\r?\n\r?\n/.exec(buffer)) {
          if (boundary.index > maxEvent) throw new Error(invalid);
          const frame = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (!data || data === '[DONE]') continue;
          const event = parseItem(data);
          if (event.type === 'response.completed' || event.type === 'response.incomplete') {
            const terminal = asItem(event.response);
            if (event.type === 'response.incomplete') {
              const output = Array.isArray(terminal.output) ? terminal.output.map(asItem) : [];
              const finalText = replyText(output);
              const interrupted = finalText ? prefix + finalText : partial;
              checkAnswer(interrupted);
              throw new InterruptedReply(interrupted, 'OpenAI stopped before finishing the response.');
            }
            return terminal;
          }
          if (event.type === 'error' || event.type === 'response.failed') {
            throw new InterruptedReply(partial, 'OpenAI could not finish the response.');
          }
          if (event.type === 'response.output_text.delta' || event.type === 'response.refusal.delta') {
            if (typeof event.delta !== 'string') throw new Error(invalid);
            partial += event.delta;
            checkAnswer(partial);
            receivedText = true;
          } else {
            activity = true;
          }
        }
        if (receivedText) onProgress?.(partial);
        else if (activity) onActivity?.();
      }
      if (buffer.length > maxEvent) throw new Error('OpenAI returned an oversized response.');
      if (done) throw new InterruptedReply(partial);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}

function toolCalls(output, seen) {
  return output
    .filter((item) => item.type === 'function_call')
    .map((item) => {
      const { call_id, name, arguments: argumentsJson } = item;
      if (
        typeof call_id !== 'string' ||
        !/^[\x21-\x7e]{1,200}$/.test(call_id) ||
        seen.has(call_id) ||
        typeof name !== 'string' ||
        !/^[\w-]{1,64}$/.test(name) ||
        typeof argumentsJson !== 'string' ||
        argumentsJson.length > 4096 ||
        (item.status && item.status !== 'completed')
      )
        throw new Error('Invalid OpenAI tool call.');
      let args;
      try {
        args = JSON.parse(argumentsJson);
      } catch {
        throw new Error('OpenAI returned invalid tool arguments.');
      }
      if (!args || typeof args !== 'object' || Array.isArray(args))
        throw new Error('OpenAI returned invalid tool arguments.');
      seen.add(call_id);
      return { callId: call_id, name, args };
    });
}

export async function requestOpenAIResponse(
  profile,
  messages,
  signal,
  request,
  guidance,
  onProgress,
  tools,
  onActivity
) {
  const input = messages.slice(-11).map(({ role, content }) => ({ role, content: content.slice(0, 8000) }));
  const definitions =
    tools?.definitions.map(({ name, description, parameters }) => ({
      type: 'function',
      name,
      description,
      parameters,
      strict: false,
    })) ?? [];
  const stream = !bufferedModels.has(profile.model);
  const seenCalls = new Set();
  let prefix = '';
  for (let round = 0; ; round++) {
    stopped(signal, prefix);
    const payload = {
      model: profile.model,
      input,
      store: false,
      stream,
      ...(definitions.length && {
        instructions: guidance,
        tools: definitions,
        include: ['reasoning.encrypted_content'],
      }),
    };
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      signal,
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
        Authorization: 'Bearer ' + profile.key,
      },
    }).catch(() => {
      stopped(signal, prefix);
      throw new ChatRequestError('Couldn’t reach OpenAI. Check your network and try again.');
    });
    if (!response.ok) throw await errorForResponse(response, true);
    const result = await readResponse(response, stream, signal, prefix, onProgress, onActivity);
    const output = Array.isArray(result.output) ? result.output.map(asItem) : [];
    const text = replyText(output);
    const answer = prefix + text;
    checkAnswer(answer);
    stopped(signal, answer);
    if (result.status === 'incomplete')
      throw new InterruptedReply(answer, 'OpenAI stopped before finishing the response.');
    if (result.status !== 'completed') throw new InterruptedReply(answer, 'OpenAI could not finish the response.');
    const calls = toolCalls(output, seenCalls);
    if (!calls.length) {
      if (!text.trim()) throw new Error('OpenAI returned an empty reply.');
      return answer.trim();
    }
    if (!tools || !definitions.length)
      throw new Error('The model requested a tool while workspace tools were off.');
    if (round >= 3 || seenCalls.size > 8)
      throw new Error('The model reached the workspace tool limit for this reply.');
    // In stateless mode the completed output (including encrypted reasoning and call IDs)
    // must be replayed in its original order ahead of the local function results.
    input.push(...output);
    for (const call of calls) {
      stopped(signal, answer);
      const allowed = definitions.some((definition) => definition.name === call.name);
      const result = allowed
        ? await tools.execute(call.name, call.args)
        : { ok: false, message: 'That tool is unavailable in this workspace.' };
      input.push({ type: 'function_call_output', call_id: call.callId, output: JSON.stringify(result) });
    }
    if (text.trim()) prefix += text.trimEnd() + '\n\n';
    onActivity?.();
  }
}
