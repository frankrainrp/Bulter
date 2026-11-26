import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatRequestError, requestReply } from '../src/assistant.js';
import { canGenerateImage, generateImage, imageGenerationModel, supportsImageGeneration } from '../src/chat/generateImage.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAALSURBVBhXY2CAAgAACQABK9nbxwAAAABJRU5ErkJggg==';
const webp = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const jpeg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==';
const profile = (provider, model) => ({ provider, model, key: 'fixture-only', baseUrl: '' });
const signal = new AbortController().signal;
const prompt = 'A drawing of a dragonfly.';

test('catalog choices and manual image IDs retain the selected provider and model', () => {
  for (const provider of ['openai', 'gemini', 'xai', 'openrouter']) {
    assert.equal(supportsImageGeneration(provider), true);
    assert.equal(canGenerateImage(provider, imageGenerationModel(provider)), true);
  }
  for (const provider of ['claude', 'deepseek', 'qwen', 'groq', 'mistral', undefined]) {
    assert.equal(supportsImageGeneration(provider), false);
    assert.equal(canGenerateImage(provider, 'gpt-image-1.5'), false);
  }
  for (const [provider, model] of [['openai', 'dall-e-3'], ['openai', 'gpt-image-1'], ['openai', 'gpt-5-mini'],
    ['gemini', 'imagen-4.0-generate-001'], ['gemini', 'gemini-3.1-flash-lite'],
    ['gemini', 'gemini-image/../../../models'], ['xai', 'grok-4.7']]) {
    assert.equal(canGenerateImage(provider, model), false);
  }
  assert.equal(canGenerateImage('openrouter', 'example/new-model', 'image'), true);
  assert.equal(canGenerateImage('openrouter', 'example/text-model', 'chat'), false);
  assert.equal(supportsImageGeneration('custom'), true);
  assert.equal(imageGenerationModel('custom'), undefined);
  assert.equal(canGenerateImage('custom', 'vendor/illustrate:3', 'image'), true);
  assert.equal(canGenerateImage('custom', 'vendor/illustrate:3', 'unknown'), false);
  assert.equal(canGenerateImage('custom', 'vendor/illustrate:3'), false);
});

test('explicit Custom image mode targets only the configured HTTPS base and leaves a keyless service keyless', async () => {
  const baseUrl = 'https://private.example/inference/v1';
  for (const suffix of ['', '/chat/completions/', '/images/generations']) {
    const entry = { provider: 'custom', mode: 'image', model: 'vendor/illustrate:3', baseUrl: baseUrl + suffix, key: '' };
    const result = await generateImage(entry, prompt, signal, async (url, init) => {
      assert.equal(url, baseUrl + '/images/generations');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(init.body), { model: entry.model, prompt, response_format: 'b64_json' });
      return Response.json({ data: [{ b64_json: png }] });
    });
    assert.equal(result.content, 'Generated an image.');
    assert.equal(result.images.length, 1);
    for (const overrides of [{ mode: undefined }, { mode: 'chat' }, { baseUrl: 'http://private.example/v1' },
      { baseUrl: baseUrl + '?token=sample' }]) {
      let contacted = false;
      await assert.rejects(generateImage({ ...entry, ...overrides }, prompt, signal, async () => { contacted = true; }));
      assert.equal(contacted, false);
    }
  }
});

test('OpenAI, xAI and OpenRouter use their documented image endpoint and the selected model', async () => {
  for (const [provider, model, url, expected] of [
    ['openai', 'gpt-image-1.5', 'https://api.openai.com/v1/images/generations', { n: 1, output_format: 'png' }],
    ['xai', 'grok-imagine-image', 'https://api.x.ai/v1/images/generations', { response_format: 'b64_json' }],
    ['openrouter', 'google/gemini-3.1-flash-image', 'https://openrouter.ai/api/v1/images', { response_format: 'b64_json' }],
  ]) {
    const result = await generateImage(profile(provider, model), prompt, signal, async (actual, init) => {
      assert.equal(actual, url);
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.headers.Authorization, 'Bearer fixture-only');
      assert.deepEqual(JSON.parse(init.body), { model, prompt, ...expected });
      return Response.json({ data: [provider === 'xai' ? { b64_json: jpeg } : { b64_json: png, media_type: 'image/png' }] });
    });
    assert.equal(result.content, 'Generated an image.');
    assert.equal(result.images[0].uri, provider === 'xai' ? 'data:image/jpeg;base64,' + jpeg : 'data:image/png;base64,' + png);
    // The normal multi-turn chat serializes text only, including after an image turn.
    await requestReply('https://workspace.example/api/chat', [{ ...result, id: 'image', role: 'assistant' }], signal,
      async (_, init) => {
        assert.deepEqual(JSON.parse(init.body).messages, [{ role: 'assistant', content: result.content }]);
        return new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } });
      });
  }
});

test('Gemini preserves visible text and raster parts while excluding thinking images and text', async () => {
  const imageModel = 'gemini-nano-banana-2.1';
  const result = await generateImage(profile('gemini', imageModel), prompt, signal, async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/' + imageModel + ':generateContent');
    assert.equal(init.headers['x-goog-api-key'], 'fixture-only');
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), { contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
    return Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: 'internal draft' }, { thought: true, inlineData: { data: 'not rendered' } },
      { text: 'Two dragonflies.' }, { inlineData: { data: png, mimeType: 'image/png' } },
      { inlineData: { data: webp, mimeType: 'image/webp' } },
    ] } }] });
  });
  assert.equal(result.content, 'Two dragonflies.');
  assert.deepEqual(result.images.map(({ id, uri }) => [id, uri]),
    [[0, 'data:image/png;base64,' + png], [1, 'data:image/webp;base64,' + webp]]);
});

test('inline output requires an allowed raster signature, matching MIME, valid base64 and bounded dimensions', async () => {
  const oversized = Buffer.from(png, 'base64');
  oversized.writeUInt32BE(65535, 16);
  for (const [data, mime] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64'), 'image/svg+xml'],
    [png, 'image/svg+xml'], [png, 'image/jpeg'], [png.slice(0, -1) + '?', 'image/png'],
    ['data:image/png;base64,' + png, 'image/png'], [oversized.toString('base64'), 'image/png'],
  ]) {
    await assert.rejects(generateImage(profile('openai', 'gpt-image-1-mini'), prompt, signal,
      async () => Response.json({ data: [{ b64_json: data, media_type: mime }] })), /unsupported raster/);
  }
  await assert.rejects(generateImage(profile('openai', 'gpt-image-2'), prompt, signal,
    async () => Response.json({ data: [{ url: 'https://example.invalid/external' }] })), /returned no image/);
});

test('image responses respect credential, payload and cancellation limits', async () => {
  const current = profile('openai', 'gpt-image-2');
  for (const [status, error] of [[401, /HTTP 401/], [429, /API credit balance is exhausted/]]) {
    await assert.rejects(generateImage(current, prompt, signal, async () =>
      Response.json({ error: { code: 'credit_balance_exhausted', message: 'private provider text' } }, { status })),
      cause => cause instanceof ChatRequestError && error.test(cause.message) && !cause.message.includes('private provider text'));
  }
  await assert.rejects(generateImage(profile('gemini', 'gemini-3.1-flash-image'), prompt, signal, async () =>
    Response.json({ promptFeedback: { blockReason: 'SAFETY' } })), /declined this description/);

  for (const declared of [true, false]) {
    let cancelled = false;
    await assert.rejects(generateImage(current, prompt, signal, async () =>
      new Response(new ReadableStream({
        start(controller) { if (!declared) controller.enqueue(new Uint8Array(12 * 1024 * 1024)); },
        cancel() { cancelled = true; },
      }), { headers: { 'Content-Type': 'application/json', ...(declared && { 'Content-Length': '999999999' }) } })), /too large/);
    assert.equal(cancelled, true);
  }
  const controller = new AbortController();
  let cancelled = false;
  const reading = Promise.withResolvers();
  const result = generateImage(current, prompt, controller.signal, async () =>
    new Response(new ReadableStream({ pull() { reading.resolve(); }, cancel() { cancelled = true; } }),
      { headers: { 'Content-Type': 'application/json' } }));
  await reading.promise;
  controller.abort();
  await assert.rejects(result, /stopped/);
  assert.equal(cancelled, true);
});
