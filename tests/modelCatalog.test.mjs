import assert from 'node:assert/strict';
import test from 'node:test';
import { listProviderModels } from '../src/chat/modelCatalog.js';

const signal = new AbortController().signal;
const fixture = (provider, overrides) => ({ provider, baseUrl: '', key: 'fixture-key', model: '', ...overrides });
const classify = rows => Object.fromEntries(rows.map(model => [model.id, model.kind]));

test('OpenAI-compatible catalogs use the saved key, the configured API path, and no message or model ID', async () => {
  const urls = {
    openai: 'https://api.openai.com/v1/models',
    groq: 'https://api.groq.com/openai/v1/models',
    mistral: 'https://api.mistral.ai/v1/models',
    xai: 'https://api.x.ai/v1/models',
    deepseek: 'https://api.deepseek.com/models',
    custom: 'https://my.example/base/v1/models',
  };
  for (const [provider, expected] of Object.entries(urls)) {
    const profile = fixture(provider, { baseUrl: 'https://my.example/base/v1/chat/completions' });
    const models = await listProviderModels(profile, signal, async (url, init) => {
      assert.equal(url, expected);
      assert.equal(init.method, 'GET');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, 'Bearer fixture-key');
      assert.equal(init.signal, signal);
      return Response.json({ data: [
        { id: 'gpt-4o' }, { id: 'gpt-4o' }, { id: 'gpt-image-1' }, { id: 'text-embedding-3-small' },
        { id: 'gpt-4o-mini-tts' }, { id: 'gpt-5.4-pro' }, { id: 'gpt-3.5-turbo-instruct' }, { id: 'new-deployment' },
        { id: 'retired', archived: true }, { id: 'inactive', active: false }, { id: '\n' }, null,
      ] });
    });
    assert.deepEqual(classify(models), {
      'gpt-4o': 'chat', 'gpt-image-1': 'image', 'text-embedding-3-small': 'other',
      'gpt-4o-mini-tts': 'other', 'gpt-5.4-pro': provider === 'openai' ? 'chat' : 'other', 'gpt-3.5-turbo-instruct': 'other',
      'new-deployment': 'unknown',
    });
    assert.equal(models.length, 7);
  }
});

test('OpenRouter honors account filters and resolves image-output models against the dedicated Images route', async () => {
  const requests = [];
  const models = await listProviderModels(fixture('openrouter'), signal, async (input, init) => {
    const url = new URL(input);
    requests.push(url.pathname);
    assert.equal(init.headers.Authorization, 'Bearer fixture-key');
    assert.equal(url.origin, 'https://openrouter.ai');
    if (url.pathname.endsWith('/images/models')) return Response.json({ data: [{ id: 'studio/paint' }, { id: 'filtered-by-account' }] });
    assert.equal(url.searchParams.get('output_modalities'), 'all');
    return Response.json({ data: [
      { id: 'studio/paint', architecture: { output_modalities: ['image'] } },
      { id: 'studio/previous', architecture: { output_modalities: ['text', 'image'] } },
      { id: 'studio/vision', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } },
      { id: 'studio/ranker', architecture: { output_modalities: ['rerank'] } },
      { id: 'studio/respond', endpoints: ['/api/v1/responses'], architecture: { output_modalities: ['text'] } },
    ] });
  });
  assert.deepEqual(requests, ['/api/v1/models/user', '/api/v1/images/models']);
  assert.deepEqual(classify(models), {
    'studio/paint': 'image', 'studio/previous': 'other', 'studio/vision': 'chat', 'studio/ranker': 'other', 'studio/respond': 'other',
  });
});

test('Gemini normalizes native names and safely pages using the API key header and opaque page tokens', async () => {
  const token = 'https://unrelated.example/next?ref=1+2';
  let page = 0;
  const models = await listProviderModels(fixture('gemini'), signal, async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://generativelanguage.googleapis.com');
    assert.equal(url.pathname, '/v1beta/models');
    assert.equal(url.searchParams.get('key'), null);
    assert.equal(url.searchParams.get('pageToken'), page ? token : null);
    assert.equal(init.headers['x-goog-api-key'], 'fixture-key');
    assert.equal(init.headers.Authorization, undefined);
    if (++page === 1) return Response.json({ models: [
      { name: 'models/new-text', displayName: 'New model', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-nano-banana-2.1', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
    ], nextPageToken: token });
    return Response.json({ models: [
      { name: 'models/new-text', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-flash-native-audio', supportedGenerationMethods: ['bidiGenerateContent'] },
    ] });
  });
  assert.deepEqual(classify(models), { 'new-text': 'chat', 'gemini-3.1-flash-image': 'image',
    'gemini-nano-banana-2.1': 'image', 'gemini-embedding-001': 'other', 'gemini-2.5-flash-native-audio': 'other' });
  assert.equal(models[0].label, 'New model');
});

test('a key without OpenRouter image catalog permission can still discover its text models', async () => {
  const models = await listProviderModels(fixture('openrouter'), signal, async input =>
    new URL(input).pathname.endsWith('/images/models') ? new Response(null, { status: 403 }) : Response.json({ data: [
      { id: 'studio/draw', output_modalities: ['image'] },
      { id: 'studio/chat', output_modalities: ['text'] },
    ] }));
  assert.deepEqual(classify(models), { 'studio/draw': 'other', 'studio/chat': 'chat' });
});

test('Claude pages with last_id, and input-image capabilities remain chat', async () => {
  const models = await listProviderModels(fixture('claude'), signal, async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.anthropic.com');
    assert.equal(url.pathname, '/v1/models');
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.headers['x-api-key'], 'fixture-key');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    if (!url.searchParams.has('after_id')) return Response.json({ data: [
      { id: 'claude-1', display_name: 'Claude one', capabilities: { image_input: { supported: true } } },
    ], has_more: true, last_id: 'claude-1' });
    assert.equal(url.searchParams.get('after_id'), 'claude-1');
    return Response.json({ data: [{ id: 'second' }], has_more: false });
  });
  assert.deepEqual(models, [{ id: 'claude-1', label: 'Claude one', kind: 'chat' }, { id: 'second', label: 'second', kind: 'chat' }]);
});

test('Qwen uses workspace-native metadata and pagination with the same configured host', async () => {
  const baseUrl = 'https://class.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
  const models = await listProviderModels(fixture('qwen', { baseUrl }), signal, async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, new URL(baseUrl).origin);
    assert.equal(url.pathname, '/api/v1/models');
    assert.equal(init.headers.Authorization, 'Bearer fixture-key');
    const page = Number(url.searchParams.get('page_no') ?? 1);
    const rows = page === 1 ? [
      { model: 'qwen-vl', name: 'Qwen Vision', capabilities: ['VU', 'TG'] },
      { model: 'studio/unknown-name', capabilities: ['IG'] },
    ] : [{ model: 'qwen-special', capabilities: ['TTS'] }];
    return Response.json({ output: { models: rows, page_no: page, total: 3 } });
  });
  assert.deepEqual(classify(models), { 'qwen-vl': 'chat', 'studio/unknown-name': 'image', 'qwen-special': 'other' });
});

test('explicit capabilities override chat-looking names, including for compatible custom deployments without keys', async () => {
  const profile = fixture('custom', { key: '', baseUrl: 'https://lab.example/v1' });
  const models = await listProviderModels(profile, signal, async (_, init) => {
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({ data: [
      { id: 'qwen-chat', capabilities: { completion_chat: false } }, { id: 'odd', capabilities: { completion_chat: true } },
      { id: 'not-chat', type: 'embedding' }, { id: 'camera', output_modalities: ['video'] },
      { id: 'speech-recognizer', input_modalities: ['audio'], output_modalities: ['text'] },
      { id: 'studio-paint', endpoints: ['/v1/images/generations'], capabilities: { completion_chat: false } },
    ] });
  });
  assert.deepEqual(classify(models), { 'qwen-chat': 'other', odd: 'chat', 'not-chat': 'other', camera: 'other',
    'speech-recognizer': 'other', 'studio-paint': 'image' });
});

test('invalid endpoints or keys, looped pagination, malformed responses and cancellation fail without exposing details', async () => {
  for (const [provider, config] of [
    ['custom', { baseUrl: 'http://private.example/v1' }], ['qwen', { baseUrl: 'https://wrong.example/compatible-mode/v1' }],
    ['openai', { key: 'bad key' }],
  ]) await assert.rejects(listProviderModels(fixture(provider, config), signal, () => assert.fail('Unexpected request')), /Enter a valid/);
  await assert.rejects(listProviderModels(fixture('openai'), signal, async () =>
    new Response('private diagnostic', { status: 401 })), error => /401/.test(error.message) && !/private/.test(error.message));
  await assert.rejects(listProviderModels(fixture('openai'), signal, async () => Response.json({ id: 'fixture-key' })), /invalid model list/);
  await assert.rejects(listProviderModels(fixture('claude'), signal, async () =>
    Response.json({ data: [], has_more: true, last_id: 'cycle' })), /invalid model list/);
  const controller = new AbortController();
  let requests = 0;
  await assert.rejects(listProviderModels(fixture('gemini'), controller.signal, async () => {
    requests++;
    controller.abort();
    return Response.json({ models: [], nextPageToken: 'more' });
  }), /stopped/);
  assert.equal(requests, 1);
});
