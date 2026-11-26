import assert from 'node:assert/strict';
import test from 'node:test';
import { InterruptedReply, requestReply } from '../src/assistant.js';
import { usesOpenAIResponses } from '../src/chat/openaiResponses.js';
import { listProviderModels } from '../src/chat/modelCatalog.js';

const signal = new AbortController().signal;
const profile = (model) => ({ provider: 'openai', baseUrl: '', model, key: 'fixture-key' });
const user = [{ id: '1', role: 'user', content: 'Check my workspace.' }];
const message = (text, type = 'output_text') => ({ type: 'message', role: 'assistant', status: 'completed',
  content: [type === 'refusal' ? { type, refusal: text } : { type, text, annotations: [] }] });
const completed = output => ({ status: 'completed', output });
const event = data => 'data: ' + JSON.stringify(data) + '\r\n\r\n';
const sse = (...events) => new Response(events.map(event).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
const done = output => ({ type: 'response.completed', response: completed(output) });
const call = (id, name = 'customize_dashboard') => ({ type: 'function_call', name, call_id: id,
  id: 'fc_' + id, status: 'completed', arguments: '{"op":"inspect"}' });
const workspace = execute => ({ today: '2026-11-24', execute, definitions: [
  { name: 'customize_dashboard', description: 'Update dashboard.', parameters: { type: 'object' } },
] });

test('routing is scoped to the official provider and documented exact aliases and snapshots', () => {
  for (const model of ['gpt-5.5-pro', 'gpt-5.4-pro-2026-03-05', 'gpt-5.3-codex', 'gpt-5.1-codex-max', 'o3-pro']) {
    assert.equal(usesOpenAIResponses('openai', model), true);
    assert.equal(usesOpenAIResponses('custom', model), false);
  }
  for (const model of ['gpt-5.4', 'gpt-5.4-pro-experiment', 'gpt-8.8-pro', 'ft:gpt-5.4-pro', 'local-codex']) {
    assert.equal(usesOpenAIResponses('openai', model), false);
  }
});

test('nonstreaming Pro keeps the saved model and returns completed text or refusal from the native JSON transport', async () => {
  for (const [model, type] of [['gpt-5.5-pro', 'output_text'], ['o3-pro-2025-06-10', 'refusal']]) {
    const answer = await requestReply(profile(model), user, signal, async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.signal, signal);
      assert.equal(init.headers.Authorization, 'Bearer fixture-key');
      assert.equal(init.headers.Accept, 'application/json');
      assert.deepEqual(JSON.parse(init.body), { model, store: false, stream: false, input: [{ role: 'user', content: user[0].content }] });
      return Response.json(completed([message('A reply', type)]));
    });
    assert.equal(answer, 'A reply');
  }
});

test('documented GPT-6 chat aliases appear in the catalog and Terra routes a mounted dashboard tool through Responses', async () => {
  const ids = ['gpt-6.2-astra', 'gpt-6.2-sol', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-astra', 'gpt-6-luna'];
  const terra = profile('gpt-6.1-terra');
  const catalog = await listProviderModels(terra, signal, async () => Response.json({ data: ids.map(id => ({ id })) }));
  assert.deepEqual(catalog.map(({ id, kind }) => [id, kind]), ids.map(id => [id, 'chat']));
  assert.equal(usesOpenAIResponses('openai', 'gpt-6.1-terra'), false);
  assert.equal(usesOpenAIResponses('custom', 'gpt-6.1-terra', true), false);
  await requestReply(terra, user, signal, async (url) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    return new Response('data: {"choices":[{"delta":{"content":"Hi."}}]}\n\ndata: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } });
  });
  let requests = 0;
  let executions = 0;
  const answer = await requestReply(terra, user, signal, async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const data = JSON.parse(init.body);
    assert.equal(data.model, terra.model);
    assert.equal(data.stream, true);
    assert.equal(data.tools[0].name, 'customize_dashboard');
    if (++requests === 1) return sse(done([call('layout')]));
    assert.equal(JSON.parse(data.input.at(-1).output).ok, true);
    return sse(done([message('Calendar is visible.')]));
  }, undefined, workspace(async (name) => {
    assert.equal(name, 'customize_dashboard');
    executions++;
    return { ok: true };
  }));
  assert.equal(executions, 1);
  assert.equal(answer, 'Calendar is visible.');
});

test('streamed Responses display live text and return the canonical final message without doubling it', async () => {
  let streamController;
  const live = Promise.withResolvers();
  const stream = new ReadableStream({ start(value) { streamController = value; } });
  const result = requestReply(profile('gpt-5.3-codex'), user, signal, async (_, init) => {
    assert.equal(JSON.parse(init.body).stream, true);
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  }, live.resolve);
  const bytes = new TextEncoder();
  streamController.enqueue(bytes.encode(event({ type: 'response.refusal.delta', delta: 'I cannot' })));
  assert.equal(await live.promise, 'I cannot');
  streamController.enqueue(bytes.encode(event(done([message('I cannot access that file.', 'refusal')]))));
  assert.equal(await result, 'I cannot access that file.');
});

test('tool continuation replays ordered completed reasoning/messages/calls with awaited workspace results', async () => {
  const reasoning = { type: 'reasoning', id: 'rs_one', encrypted_content: 'opaque', summary: [] };
  const initial = [reasoning, { ...message('Checking.'), phase: 'commentary' }, call('test')];
  const gate = Promise.withResolvers();
  const started = Promise.withResolvers();
  let count = 0;
  const run = requestReply(profile('gpt-5.4-pro'), user, signal, async (_, init) => {
    const data = JSON.parse(init.body);
    assert.equal(data.store, false);
    assert.equal(data.previous_response_id, undefined);
    assert.deepEqual(data.include, ['reasoning.encrypted_content']);
    assert.equal(data.tools[0].name, 'customize_dashboard');
    assert.equal(data.tools[0].strict, false);
    if (++count === 1) return sse(done(initial));
    assert.deepEqual(data.input, [{ role: 'user', content: user[0].content }, ...initial,
      { type: 'function_call_output', call_id: 'test', output: '{"ok":true,"data":["calendar"]}' }]);
    return sse(done([message('You have a calendar.')]));
  }, undefined, workspace(async (name, args) => {
    assert.equal(name, 'customize_dashboard');
    assert.deepEqual(args, { op: 'inspect' });
    started.resolve();
    await gate.promise;
    return { ok: true, data: ['calendar'] };
  }));
  await started.promise;
  assert.equal(count, 1);
  gate.resolve();
  assert.equal(await run, 'Checking.\n\nYou have a calendar.');
});

test('unavailable calls execute no local tool and duplicate or malformed calls fail before any changes', async () => {
  for (const output of [[call('id'), call('id')], [call('id'), { ...call('id2'), arguments: 'bad json' }]]) {
    await assert.rejects(requestReply(profile('gpt-5-pro'), user, signal, async () => sse(done(output)), undefined,
      workspace(() => assert.fail('a malformed batch must not run'))), /tool/);
  }
  let round = 0;
  const value = await requestReply(profile('o3-pro'), user, signal, async (_, init) => {
    if (++round === 1) return Response.json(completed([call('unknown', 'not_enabled')]));
    const last = JSON.parse(init.body).input.at(-1);
    assert.equal(JSON.parse(last.output).ok, false);
    return Response.json(completed([message('Unavailable.')]));
  }, undefined, workspace(() => assert.fail('unlisted tool')));
  assert.equal(value, 'Unavailable.');
});

test('incomplete responses retain text and skip tool execution, and a cancelled lookup never sends another request', async () => {
  await assert.rejects(requestReply(profile('gpt-5-pro'), user, signal, async () => sse(
    { type: 'response.output_text.delta', delta: 'Partial' },
    { type: 'response.incomplete', response: { status: 'incomplete', output: [call('incomplete')] } }),
  undefined, workspace(() => assert.fail('unfinished response'))),
  error => error instanceof InterruptedReply && error.partial === 'Partial');
  const controller = new AbortController();
  let requests = 0;
  await assert.rejects(requestReply(profile('gpt-5-pro'), user, controller.signal, async () => {
    requests++;
    return sse(done([call('a'), call('b')]));
  }, undefined, workspace(async () => {
    controller.abort();
    return { ok: true };
  })), InterruptedReply);
  assert.equal(requests, 1);
});
