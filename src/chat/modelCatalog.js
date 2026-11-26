import { defaultModelId, errorForResponse, modelKeyError, modelUrl } from '../assistant.js';
import { usesOpenAIResponses } from './openaiResponses.js';

const invalidCatalog = 'The provider returned an invalid model list.';
const maxPageBytes = 8 * 1024 * 1024;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function catalogUrl(profile) {
  const endpoint = modelUrl(profile);
  if (!endpoint) throw new Error('Enter a valid provider URL to list models.');
  const url = new URL(endpoint);
  switch (profile.provider) {
    case 'gemini':
      url.pathname = '/v1beta/models';
      url.searchParams.set('pageSize', '100');
      break;
    case 'claude':
      url.pathname = '/v1/models';
      url.searchParams.set('limit', '100');
      break;
    case 'openrouter':
      url.pathname = '/api/v1/models/user';
      url.searchParams.set('output_modalities', 'all');
      break;
    case 'qwen':
      url.pathname = '/api/v1/models';
      url.searchParams.set('page_size', '20');
      break;
    default:
      url.pathname = url.pathname.replace(/\/chat\/completions$/, '/models');
  }
  return url;
}

function catalogHeaders({ provider, key }) {
  const headers = { Accept: 'application/json' };
  if (provider === 'gemini') headers['x-goog-api-key'] = key;
  else if (provider === 'claude') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    if (typeof document !== 'undefined') headers['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (key) headers.Authorization = 'Bearer ' + key;
  return headers;
}

function checkActive(signal) {
  if (signal.aborted) throw new Error('Model discovery was stopped.');
}

async function fetchPage(url, headers, signal, request, optionalImageList = false) {
  checkActive(signal);
  const response = await request(url.href, {
    method: 'GET',
    headers,
    signal,
    redirect: 'error',
    credentials: 'omit',
  }).catch(() => {
    checkActive(signal);
    throw new Error('Could not reach the model catalog. Check your connection and provider settings.');
  });
  checkActive(signal);
  if (!response.ok) {
    // A key scoped to chat can still use the account's text models.
    if (optionalImageList && (response.status === 403 || response.status === 404)) {
      void response.body?.cancel().catch(() => {});
      return { data: [] };
    }
    throw await errorForResponse(response, true);
  }
  if (!response.body) throw new Error(invalidCatalog);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let json = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      checkActive(signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxPageBytes) throw new Error(invalidCatalog);
      json += decoder.decode(value, { stream: true });
    }
    return record(JSON.parse(json + decoder.decode()));
  } catch {
    checkActive(signal);
    throw new Error(invalidCatalog);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// These families also appear in OpenAI-compatible lists that return just an ID.
const specializedModels = [
  /embed|rerank|moderat|whisper|transcri|realtime|speech|deep-research|computer-use/i,
  /(?:^|[-/])(?:audio|tts|asr|video|ocr|guard|safeguard|codex|orpheus)(?:[-./]|$)/i,
  /^(?:sora|babbage|davinci|veo|lyria)(?:[-./]|$)/i,
  /(?:^|\/)(?:gpt-[\d.]+-pro|o[13]-pro|gpt-3\.5-turbo-instruct)(?:-|$)/i,
];

const imageFamilies = [
  /(?:^|\/)(?:gpt-image|chatgpt-image|dall-e|imagen|grok-(?:imagine-)?image|qwen-image)(?:[-./]|$)/i,
  /(?:^|\/)gemini-[\w.-]*-image(?:[-.]|$)/i,
  /(?:^|\/)(?:gemini-)?nano-banana(?:[-.]|$)/i,
];

const chatFamilies = [
  /(?:^|\/|ft:)(?:gpt-(?:[345](?:[o.-]|$)|oss)|chatgpt-4o|o[134](?:[-:]|$)|claude-)/i,
  /(?:^|\/)(?:deepseek-(?:chat|reasoner|flash|pro|r1|v\d)|grok-\d|gemini-\d|llama-?\d|qwen[\d.-]|mistral-(?:small|medium|large))/i,
  /(?:^|[-/])(?:instruct|chat)(?:[-.:/]|$)/i,
];

function idKind(id, provider) {
  if (usesOpenAIResponses(provider, id, true)) return 'chat';
  if (specializedModels.some((pattern) => pattern.test(id))) return 'other';
  if (imageFamilies.some((pattern) => pattern.test(id))) return 'image';
  if (id === defaultModelId(provider) || chatFamilies.some((pattern) => pattern.test(id))) return 'chat';
  return 'unknown';
}

function modelKind(row, id, provider) {
  const capabilities = record(row.capabilities);
  const qwenCapabilities = strings(row.capabilities);
  if (provider === 'qwen' && qwenCapabilities.length) {
    if (qwenCapabilities.includes('IG')) return 'image';
    return qwenCapabilities.some((value) => ['TG', 'Reasoning', 'VU'].includes(value)) ? 'chat' : 'other';
  }
  const architecture = record(row.architecture);
  const inputs = strings(architecture.input_modalities ?? row.input_modalities);
  const outputs = strings(architecture.output_modalities ?? row.output_modalities);
  const routes = strings(row.endpoints);
  if (inputs.length && !inputs.includes('text')) return 'other';
  if (provider === 'custom' && routes.some((route) => route.endsWith('/images/generations'))) return 'image';
  if (outputs.includes('image') || typeof row.image_price === 'number') return 'image';
  if (outputs.length && !outputs.includes('text')) return 'other';
  if (typeof capabilities.completion_chat === 'boolean') return capabilities.completion_chat ? 'chat' : 'other';
  if (routes.length) return routes.some((route) => route.endsWith('/chat/completions')) ? 'chat' : 'other';
  if (['embedding', 'embeddings', 'reranker', 'transcription', 'tts'].includes(String(row.type ?? row.model_type)))
    return 'other';
  if (provider === 'claude') return 'chat';
  const inferred = idKind(id, provider);
  if (provider === 'gemini') {
    const methods = strings(row.supportedGenerationMethods);
    if (methods.length && !methods.includes('generateContent')) return 'other';
    if (methods.includes('generateContent') && inferred === 'unknown') return 'chat';
  }
  if (outputs.includes('text') && inferred === 'unknown') return 'chat';
  return inferred;
}

function normalize(raw, provider) {
  const row = record(raw);
  if (row.active === false || row.archived === true || row.lifecycle === 'retired') return;
  const rawId = provider === 'gemini' ? row.name : provider === 'qwen' ? row.model : row.id;
  if (typeof rawId !== 'string') return;
  const id = provider === 'gemini' ? rawId.replace(/^models\//, '') : rawId;
  if (!id.trim() || id !== id.trim() || id.length > 150 || /[\u0000-\u001f\u007f]/.test(id)) return;
  const name = row.display_name ?? row.displayName ?? row.name;
  const label =
    typeof name === 'string' &&
    name !== rawId &&
    name.trim() &&
    name.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(name)
      ? name.trim()
      : id;
  return { id, label, kind: modelKind(row, id, provider) };
}

function nextCursor(page, provider) {
  // Treat cursors as parameter values. Never follow next-page URLs with the user's key.
  const isGemini = provider === 'gemini';
  if (isGemini ? !page.nextPageToken : page.has_more !== true) return;
  const cursor = isGemini ? page.nextPageToken : page.last_id;
  if (typeof cursor !== 'string' || !cursor || cursor.length > 2048) throw new Error(invalidCatalog);
  return [isGemini ? 'pageToken' : 'after_id', cursor];
}

export async function listProviderModels(profile, signal, request = fetch) {
  const keyError = modelKeyError(profile);
  if (keyError) throw new Error(keyError);
  const { provider } = profile;
  const url = catalogUrl(profile);
  const headers = catalogHeaders(profile);
  const models = new Map();
  const visited = new Set();
  let rowsRead = 0;
  for (let pageNumber = 1; ; pageNumber++) {
    if (pageNumber > 128 || visited.has(url.href)) throw new Error(invalidCatalog);
    visited.add(url.href);
    const page = await fetchPage(url, headers, signal, request);
    const output = record(page.output);
    const rows = provider === 'qwen' ? output.models : provider === 'gemini' ? page.models : page.data;
    if (!Array.isArray(rows)) throw new Error(invalidCatalog);
    rowsRead += rows.length;
    if (rowsRead > 20000) throw new Error(invalidCatalog);
    for (const row of rows) {
      const model = normalize(row, provider);
      if (model && !models.has(model.id)) models.set(model.id, model);
    }
    if (provider === 'qwen' && typeof output.total === 'number' && rowsRead < output.total) {
      if (!rows.length || (typeof output.page_no === 'number' && output.page_no !== pageNumber))
        throw new Error(invalidCatalog);
      url.searchParams.set('page_no', String(pageNumber + 1));
      continue;
    }
    const cursor = nextCursor(page, provider);
    if (!cursor) break;
    url.searchParams.set(...cursor);
  }
  if (provider === 'openrouter' && [...models.values()].some((model) => model.kind === 'image')) {
    const imageUrl = new URL('/api/v1/images/models', url);
    const { data } = await fetchPage(imageUrl, headers, signal, request, true);
    if (!Array.isArray(data)) throw new Error(invalidCatalog);
    const available = new Set(data.map((item) => record(item).id));
    for (const model of models.values()) {
      if (model.kind === 'image' && !available.has(model.id)) model.kind = 'other';
    }
  }
  checkActive(signal);
  return [...models.values()];
}
