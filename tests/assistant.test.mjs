import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatRequestError, InterruptedReply, defaultModelId, modelProfileError, requestReply, serverEndpoint, serverEndpointError } from '../src/assistant.js';
import { splitReplyImages } from '../src/chat/replyImages.js';
import { blankTask, studyBrief } from '../src/model.js';

const endpoint = 'https://butler.example/api/chat';
const signal = new AbortController().signal;
const messages = [
  { id: 'a', role: 'user', content: 'What is a transaction?' },
  { id: 'b', role: 'assistant', content: 'It groups work into a unit.' },
  { id: 'c', role: 'user', content: 'Give me an example.' },
];
const stream = (text) => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
const delta = (content) => 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\r\n\r\n';

test('the transport retains partial text before the final event', async () => {
  let writer;
  const stream = new ReadableStream({ start(controller) { writer = controller; } });
  const bytes = new TextEncoder();
  const first = Promise.withResolvers();
  const result = requestReply(endpoint, messages, signal, async () =>
    new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }), first.resolve);
  writer.enqueue(bytes.encode(delta('The first part')));
  assert.equal(await first.promise, 'The first part');
  writer.enqueue(bytes.encode(delta(' is complete.') + 'data: [DONE]\r\n\r\n'));
  assert.equal(await result, 'The first part is complete.');
});

test('token-by-token SVG delivery does not count event framing toward answer length', async () => {
  const source = '<svg><path d="M0 0' + ' L1 2'.repeat(1500) + '"/></svg>';
  const wire = [...source].map(delta).join('') + 'data: [DONE]\r\n\r\n';
  assert.ok(wire.length > 256 * 1024);
  assert.equal(await requestReply(endpoint, messages, signal, async () => stream(wire)), source);
});

test('a malformed stream with an unclosed event is bounded independently of valid answers', async () => {
  await assert.rejects(requestReply(endpoint, messages, signal, async () => stream('data: ' + 'x'.repeat(4 * 1024 * 1024))),
    /oversized stream event/);
});

test('an explicit model output limit keeps the unfinished answer and explains the interruption', async () => {
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    stream(delta('<svg>') + 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n')),
    error => error instanceof InterruptedReply && error.partial === '<svg>' && /model reached its output limit/.test(error.message));
});

test('chat endpoint accepts only explicit credential-free HTTPS Butler routes', () => {
  assert.equal(serverEndpoint(' ' + endpoint + ' '), endpoint);
  assert.equal(serverEndpoint(endpoint + '/'), endpoint);
  assert.equal(serverEndpoint('https://butler.example'), endpoint);
  assert.equal(serverEndpoint('https://butler.example/'), endpoint);
  for (const url of [
    'http://butler.example/api/chat', 'https://user:pass@butler.example/api/chat',
    endpoint + '?key=secret', endpoint + '#fragment', 'https://butler.example/v1/chat/completions',
  ]) assert.equal(serverEndpoint(url), undefined);
  assert.match(serverEndpointError('https://butler.example/v1/chat/completions'), /Custom API/);
  assert.match(serverEndpointError('a-key-is-not-an-address'), /workspace server’s HTTPS address/);
});

test('multi-turn messages use the upstream chat wire format without workspace data or cookies', async () => {
  const answer = await requestReply(endpoint, messages, signal, async (url, init) => {
    assert.equal(url, endpoint);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.deepEqual(JSON.parse(init.body), {
      includeTools: false, messages: messages.map(({ role, content }) => ({ role, content })),
    });
    return stream(delta('For example, ') + delta('a transfer. 手續') + 'data: [DONE]\r\n\r\n');
  });
  assert.equal(answer, 'For example, a transfer. 手續');
});

test('failed, truncated and empty replies cannot become assistant messages', async () => {
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    new Response('Private server detail', { status: 503 })), /HTTP 503/);
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    stream(delta('Incomplete 尾📚'))), error => error instanceof InterruptedReply && error.partial === 'Incomplete 尾📚');
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    stream('data: [DONE]\n\n')), /empty reply/);
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    stream('data: {"error":"provider-secret"}\n\ndata: [DONE]\n\n')), /could not generate/);
});

test('direct compatible models use HTTPS, a model ID, and header-only keys', async () => {
  const profile = { provider: 'custom', baseUrl: 'https://models.example/openai/v1/', model: 'local-model', key: 'test-key' };
  assert.match(modelProfileError({ ...profile, baseUrl: 'http://models.example/v1' }), /HTTPS/);
  assert.match(modelProfileError({ ...profile, baseUrl: 'https://models.example/v1?key=example' }), /HTTPS/);
  assert.match(modelProfileError({ ...profile, baseUrl: 'https://models.example/v1/responses' }), /\/chat\/completions/);
  assert.match(modelProfileError({ ...profile, key: 'Bearer test-key' }), /API key/);
  assert.match(modelProfileError({ ...profile, key: '密钥' }), /API key/);
  assert.match(modelProfileError({ ...profile, provider: 'qwen' }), /HTTPS/);
  const answer = await requestReply(profile, messages, signal, async (url, init) => {
    assert.equal(url, 'https://models.example/openai/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    assert.equal(init.redirect, 'error');
    assert.deepEqual(JSON.parse(init.body), {
      model: 'local-model', stream: true,
      messages: messages.map(({ role, content }) => ({ role, content })),
    });
    return stream(delta([{ type: 'text', text: 'OK' }]) + 'data: [DONE]\n\n');
  });
  assert.equal(answer, 'OK');
});

test('Claude uses the Messages request and handles text deltas and message_stop', async () => {
  const profile = { provider: 'claude', baseUrl: '', model: 'claude-test', key: 'test-key' };
  assert.equal(await requestReply(profile, messages, signal, async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'test-key');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(JSON.parse(init.body).stream, true);
    assert.equal(JSON.parse(init.body).max_tokens, 4096);
    return stream('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'
      + 'data: {"type":"message_stop"}\n\n');
  }), 'Hello');
});

test('provider presets and Qwen workspace routes send the documented chat contract', async () => {
  const endpoints = {
    openai: 'https://api.openai.com/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions',
    xai: 'https://api.x.ai/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    qwen: 'https://example.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
  };
  for (const [provider, expected] of Object.entries(endpoints)) {
    const model = defaultModelId(provider);
    const profile = { provider, model, baseUrl: provider === 'qwen' ? expected.replace('/chat/completions', '') : '', key: 'fixture-key' };
    assert.ok(model);
    await requestReply(profile, messages, signal, async (url, init) => {
      assert.equal(url, expected);
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.Authorization, 'Bearer fixture-key');
      assert.equal(init.headers['x-api-key'], undefined);
      assert.equal(JSON.parse(init.body).model, model);
      assert.ok(!init.body.includes('fixture-key'));
      return stream(delta('OK') + 'data: [DONE]\n\n');
    });
  }
  const qwen = { provider: 'qwen', model: 'qwen-plus', key: 'fixture-key' };
  assert.match(modelProfileError({ ...qwen, baseUrl: 'https://other.aliyuncs.com/compatible-mode/v1' }), /Model Studio/);
  assert.match(modelProfileError({ ...qwen, baseUrl: 'https://dashscope.aliyuncs.com/api/chat' }), /Model Studio/);
});

test('HTTP errors guide recovery without displaying service-provided payloads', async () => {
  for (const [status, settings] of [[401, true], [403, true], [404, true], [429, false], [503, false]]) {
    await assert.rejects(requestReply(endpoint, messages, signal, async () =>
      new Response('Private server detail', { status })), (error) => error instanceof ChatRequestError
        && error.checkSettings === settings && error.message.includes(`HTTP ${status}`)
        && !error.message.includes('Private server detail'));
  }
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    new Response(delta('unexpected'), { headers: { 'Content-Type': 'text/event-stream-other' } })), /did not return/);
});

test('HTTP 429 separates provider credits, spend, usage and short-term request limits', async () => {
  const errors = [
    [{ code: 'credit_balance_exhausted', type: 'insufficient_quota' }, /credit balance is exhausted/],
    [{ code: 'project_spend_limit_exceeded', type: 'insufficient_quota' }, /spending limit was reached/],
    [{ code: 'organization_usage_limit_exceeded' }, /usage limit was reached/],
    [{ type: 'insufficient_quota' }, /insufficient API quota/],
    [{ type: 'rate_limit_error', code: 'slow_down' }, /Wait at least 12 seconds/],
    [{ code: 'unknown' }, /Wait at least 12 seconds/],
  ];
  for (const [error, expected] of errors) {
    await assert.rejects(requestReply(endpoint, messages, signal, async () =>
      Response.json({ error: { ...error, message: 'Private provider detail' } }, {
        status: 429, headers: { 'Retry-After': '12' },
      })), (cause) => expected.test(cause.message) && !cause.message.includes('Private provider detail'));
  }
  const oversized = JSON.stringify({ error: { code: 'insufficient_quota', message: 'x'.repeat(9000) } });
  await assert.rejects(requestReply(endpoint, messages, signal, async () =>
    new Response(oversized, { status: 429 })), /without a specific cause/);
});

test('offline brief places actual dated, unscheduled and completed tasks in the right groups', () => {
  const task = (id, date, status = 'todo') => ({ ...blankTask(id, date), taskName: id, status });
  const result = studyBrief([
    task('today-open', '2026-11-23'), task('today-done', '2026-11-23', 'done'),
    task('past-done', '2026-11-22', 'done'), task('overdue', '2026-11-21', 'in_progress'),
    task('future', '2026-11-24'), task('unscheduled', ''),
  ], '2026-11-23');
  assert.deepEqual(Object.fromEntries(Object.entries(result).map(([key, value]) =>
    [key, Array.isArray(value) ? value.map(({ id }) => id) : value])), {
    today: ['today-open'], overdue: ['overdue'], next: ['future'], unscheduled: ['unscheduled'], doneToday: 1,
  });
});

test('the completion event finishes a reply without waiting for transport EOF', { timeout: 500 }, async () => {
  const bytes = new TextEncoder().encode(delta('理解') + 'data: [DONE]\r\n\r\n');
  const split = bytes.findIndex((byte) => byte > 127) + 1;
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, split));
      controller.enqueue(bytes.subarray(split, bytes.length - 1));
      controller.enqueue(bytes.subarray(bytes.length - 1));
    },
    cancel() { cancelled = true; },
  });
  assert.equal(await requestReply(endpoint, messages, signal, async () =>
    new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })), '理解');
  assert.equal(cancelled, true);
});

test('streamed HTTPS images keep the first tile identity as more images arrive', async () => {
  const first = 'https://images.example/one.png';
  const second = 'https://images.example/two.png';
  const before = splitReplyImages(`\n ![First](${first})\n`);
  const received = await requestReply(endpoint, messages, signal, async () => stream(
    delta([{ type: 'text', text: `![First](${first})` }, { type: 'image_url', image_url: { url: second } }])
    + 'data: [DONE]\n\n',
  ));
  const result = splitReplyImages(received);
  assert.deepEqual(result.images, [before.images[0], { id: 1, uri: second, label: 'Image 2' }]);
  assert.equal(result.text, '');
  assert.deepEqual(splitReplyImages('![No](http://images.example/no.png)').images, []);
});
