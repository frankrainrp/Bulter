import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveReplyText } from '../src/chat/liveReplyText.js';

test('Stop sees unpainted text and cancelled frames never notify the next conversation', t => {
  const frames = new Map();
  let count = 0;
  const beforeRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const beforeCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  globalThis.requestAnimationFrame = callback => { frames.set(++count, callback); return count; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => {
    if (beforeRequest) Object.defineProperty(globalThis, 'requestAnimationFrame', beforeRequest);
    else delete globalThis.requestAnimationFrame;
    if (beforeCancel) Object.defineProperty(globalThis, 'cancelAnimationFrame', beforeCancel);
    else delete globalThis.cancelAnimationFrame;
  });

  const text = createLiveReplyText();
  const seen = [];
  const unsubscribe = text.subscribe(() => seen.push(text.read()));
  text.receive('First');
  text.receive('First 尾📚');
  assert.equal(frames.size, 1);
  assert.equal(text.read(), 'First 尾📚');
  text.clear();
  assert.equal(text.read(), '');
  assert.equal(frames.size, 0);
  assert.deepEqual(seen, []);

  text.receive('Next');
  text.receive('Next reply');
  for (const [id, paint] of frames) { frames.delete(id); paint(); }
  assert.deepEqual(seen, ['Next reply']);
  unsubscribe();
  text.receive('Next reply continues in the background');
  assert.equal(frames.size, 0);
  assert.equal(text.read(), 'Next reply continues in the background');
});
