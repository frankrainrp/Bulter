import { ChatRequestError, errorForResponse, modelProfileError, modelUrl } from '../assistant.js';

const defaultImageModels = {
  openai: 'gpt-image-1-mini',
  gemini: 'gemini-3.1-flash-lite-image',
  xai: 'grok-imagine-image-2.0',
  openrouter: 'bytedance-seed/seedream-4.5',
};

export function imageGenerationModel(provider) {
  return provider && defaultImageModels[provider];
}

export function supportsImageGeneration(provider) {
  return provider === 'custom' || !!imageGenerationModel(provider);
}

export function canGenerateImage(provider, modelId, kind) {
  const id = modelId.trim();
  if (kind === 'chat' || kind === 'other' || id.length > 150) return false;
  if (provider === 'custom') return kind === 'image' && !!id && !/[\u0000-\u001f\u007f]/.test(id);
  if (provider === 'openrouter') return /^[\w.-]+\/[\w.:-]+$/.test(id);
  if (!/^[\w.-]+$/.test(id)) return false;
  switch (provider) {
    case 'openai':
      return id === 'chatgpt-image-latest' || (/^gpt-image-/.test(id) && !/^gpt-image-1(?:$|-\d{4}-)/.test(id));
    case 'gemini':
      return /^gemini-/.test(id) && /-(?:image|nano-banana)(?:-|$)/.test(id);
    case 'xai':
      return /^grok-imagine-image(?:-|$)/.test(id);
    default:
      return false;
  }
}

const maxImageBytes = 8 * 1024 * 1024;
const maxResponseBytes = Math.ceil(maxImageBytes / 3) * 4 + 512 * 1024;
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Read only the raster header, even for JPEG metadata segments located far apart.
function rasterUri(data, declaredMime) {
  const invalid = () => new Error('The image service returned an invalid or unsupported raster image.');
  if (
    typeof data !== 'string' ||
    data.length < 32 ||
    data.length > Math.ceil(maxImageBytes / 3) * 4 ||
    data.length % 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  )
    throw invalid();
  const length = (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (length > maxImageBytes) throw invalid();

  const data64 = data;
  function byte(offset) {
    if (offset < 0 || offset >= length) throw invalid();
    const group = Math.floor(offset / 3) * 4 + (offset % 3);
    const shift = ((offset % 3) + 1) * 2;
    return (
      ((base64Alphabet.indexOf(data64[group]) << shift) |
        (base64Alphabet.indexOf(data64[group + 1]) >> (6 - shift))) &
      255
    );
  }
  const uint16 = (at) => byte(at) * 256 + byte(at + 1);
  const uint32 = (at) => uint16(at) * 65536 + uint16(at + 2);
  const le24 = (at) => byte(at) + byte(at + 1) * 256 + byte(at + 2) * 65536;
  const fourCC = (at) => String.fromCharCode(byte(at), byte(at + 1), byte(at + 2), byte(at + 3));
  let mime = '',
    width = 0,
    height = 0;
  if (uint32(0) === 0x89504e47 && uint32(4) === 0x0d0a1a0a && uint32(8) === 13 && fourCC(12) === 'IHDR') {
    mime = 'image/png';
    width = uint32(16);
    height = uint32(20);
  } else if (uint16(0) === 0xffd8) {
    mime = 'image/jpeg';
    let at = 2;
    const headerEnd = Math.min(length, 1024 * 1024);
    while (at + 4 < headerEnd && byte(at++) === 0xff) {
      while (at < headerEnd && byte(at) === 0xff) at++;
      const marker = byte(at++);
      if (marker === 0xda || marker === 0xd9) break;
      const size = uint16(at);
      if (size < 2 || at + size > length) throw invalid();
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
        height = uint16(at + 3);
        width = uint16(at + 5);
        break;
      }
      at += size;
    }
  } else if (fourCC(0) === 'RIFF' && fourCC(8) === 'WEBP' && le24(4) + byte(7) * 16777216 + 8 === length) {
    mime = 'image/webp';
    const encoding = fourCC(12);
    if (encoding === 'VP8X' && !(byte(20) & 2)) {
      width = 1 + le24(24);
      height = 1 + le24(27);
    } else if (encoding === 'VP8 ' && le24(23) === 0x2a019d) {
      width = (byte(26) + byte(27) * 256) & 0x3fff;
      height = (byte(28) + byte(29) * 256) & 0x3fff;
    } else if (encoding === 'VP8L' && byte(20) === 0x2f) {
      width = 1 + byte(21) + ((byte(22) & 0x3f) << 8);
      height = 1 + (byte(22) >> 6) + (byte(23) << 2) + ((byte(24) & 15) << 10);
    }
  }
  if (
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16_777_216 ||
    (declaredMime !== undefined && declaredMime !== mime)
  )
    throw invalid();
  return 'data:' + mime + ';base64,' + data;
}

async function readImageResponse(response, signal) {
  const body = response.body;
  const tooLarge = () => new Error('The image response is too large to display on this device.');
  if (
    !body ||
    response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json'
  ) {
    void body?.cancel().catch(() => {});
    throw new Error('The image service did not return a JSON image response.');
  }
  const reader = body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel);
  try {
    if (Number(response.headers.get('content-length')) > maxResponseBytes) throw tooLarge();
    const decoder = new TextDecoder();
    const chunks = [];
    let size = 0;
    for (;;) {
      if (signal.aborted) throw new Error('Image generation was stopped.');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) throw tooLarge();
      chunks.push(decoder.decode(value, { stream: true }));
    }
    if (signal.aborted) throw new Error('Image generation was stopped.');
    try {
      return JSON.parse(chunks.join('') + decoder.decode());
    } catch {
      throw new Error('The image service returned invalid JSON.');
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}

export async function generateImage(profile, prompt, signal, request = fetch) {
  const model = profile.model.trim();
  const issue = modelProfileError(profile);
  if (issue) throw new ChatRequestError(issue, true);
  if (!canGenerateImage(profile.provider, model, profile.mode === 'image' ? 'image' : undefined)) {
    throw new ChatRequestError('Choose an available image-generation model in Models.', true);
  }
  const text = prompt.trim();
  if (!text || text.length > 8000) throw new Error('Enter an image description of up to 8,000 characters.');
  if (signal.aborted) throw new Error('Image generation was stopped.');
  const gemini = profile.provider === 'gemini';
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (gemini) headers['x-goog-api-key'] = profile.key;
  else if (profile.key) headers.Authorization = 'Bearer ' + profile.key;
  const url = gemini
    ? 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent'
    : profile.provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/images'
      : modelUrl(profile).replace(/\/chat\/completions$/, '/images/generations');
  const gptImage =
    profile.provider === 'openai' || (profile.provider === 'custom' && canGenerateImage('openai', model));
  const payload = gemini
    ? {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }
    : {
        model,
        prompt: text,
        ...(gptImage ? { n: 1, output_format: 'png' } : { response_format: 'b64_json' }),
      };
  let response;
  try {
    response = await request(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      headers,
      redirect: 'error',
      credentials: 'omit',
    });
  } catch {
    if (signal.aborted) throw new Error('Image generation was stopped.');
    throw new ChatRequestError('Couldn’t reach the image service. Check your connection and try again.');
  }
  if (!response.ok) throw await errorForResponse(response, true);
  const result = await readImageResponse(response, signal);
  if (result?.error) throw new Error('The image service could not complete this request.');
  let caption = '';
  const images = [];
  function addImage(data, mime) {
    if (images.length >= 4) throw new Error('The model returned too many images for one reply.');
    const id = images.length;
    images.push({
      id,
      uri: rasterUri(data, mime),
      label: 'Generated image ' + (id + 1) + ': ' + text.slice(0, 240),
    });
  }
  if (gemini) {
    const parts = result?.candidates?.[0]?.content?.parts;
    for (const part of Array.isArray(parts) ? parts : []) {
      if (!part || part.thought) continue;
      if (typeof part.text === 'string' && caption.length < 8000)
        caption += part.text.slice(0, 8000 - caption.length);
      if (part.inlineData) addImage(part.inlineData.data, part.inlineData.mimeType);
    }
  } else {
    const first = result?.data?.[0];
    if (first?.b64_json) addImage(first.b64_json, first.media_type);
  }
  if (!images.length)
    throw new Error(
      result?.promptFeedback?.blockReason
        ? 'The image provider declined this description. Try rephrasing it.'
        : 'The model returned no image. Try a different description or select another image model.'
    );
  return {
    content:
      caption.trim() || (images.length === 1 ? 'Generated an image.' : 'Generated ' + images.length + ' images.'),
    images,
  };
}
