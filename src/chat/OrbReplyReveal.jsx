import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MODE_FRAMES, paintFrame, resolvePreset } from 'thinking-orbs/engine';

import { ReplyReadyContext } from './ReplyContent.jsx';
import './OrbReplyReveal.css';

const size = 64;
const preset = resolvePreset('shaping', size);
// The packaged morph holds each of three shapes for 1.4 engine seconds
// and interpolates to the next for 0.9, closing the circle on the last frame.
const cycleTime = 3 * (1.4 + 0.9);
const cycleMs = (1000 * cycleTime) / preset.speed;
const revealMs = 280;
const recent = new Map();
const alwaysSkip = () => true;
const ignoreMotion = () => () => {};

export function markOrbReplyStarted(id) {
  if (recent.has(id)) return;
  if (recent.size >= 64) recent.delete(recent.keys().next().value);
  recent.set(id, { started: performance.now(), seen: false });
}

function skipMotion() {
  return document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeMotion(change) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', change);
  document.addEventListener('visibilitychange', change);
  return () => {
    media.removeEventListener('change', change);
    document.removeEventListener('visibilitychange', change);
  };
}

function firstContentRect(body) {
  const nodes = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let node = nodes.nextNode(); node; node = nodes.nextNode()) {
    const offset = node.textContent?.search(/\S/) ?? -1;
    if (offset < 0) continue;
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    const rect = range.getBoundingClientRect();
    if (rect.width && rect.height) return rect;
  }
  return body.querySelector('img, svg, canvas')?.getBoundingClientRect() ?? body.getBoundingClientRect();
}

export function OrbReplyReveal({ id, phase, waitForContent = false, children }) {
  const canvas = useRef(null);
  const body = useRef(null);
  const [fresh] = useState(() => {
    const intent = recent.get(id);
    return phase === 'pending' || (!!intent && !intent.seen && performance.now() - intent.started < cycleMs);
  });
  const [firstCycleDone, setFirstCycleDone] = useState(false);
  const [settled, setSettled] = useState(false);
  const [bodyReady, setBodyReady] = useState(false);
  const onBodyReady = useCallback(() => setBodyReady(true), []);
  const ready = phase !== 'pending' && (!waitForContent || bodyReady);
  const watchMotion = fresh && !settled && phase !== 'interrupted';
  const suppress = useSyncExternalStore(
    watchMotion ? subscribeMotion : ignoreMotion,
    watchMotion ? skipMotion : alwaysSkip,
    alwaysSkip
  );
  const stage = !watchMotion
    ? 'complete'
    : suppress
      ? ready
        ? 'complete'
        : 'waiting'
      : ready && firstCycleDone
        ? 'reveal'
        : 'cycle';

  useLayoutEffect(() => {
    if (!fresh) return;
    markOrbReplyStarted(id);
    recent.get(id).seen = true;
  }, [fresh, id]);

  useLayoutEffect(() => {
    if (fresh && !settled && stage === 'complete') setSettled(true);
  }, [fresh, settled, stage]);

  useLayoutEffect(() => {
    const node = canvas.current;
    if (!node || (stage !== 'cycle' && stage !== 'waiting')) return;
    const ctx = node.getContext('2d');
    if (!ctx) {
      setSettled(true);
      return;
    }
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.round((node.clientWidth || size) * scale);
    node.width = node.height = pixels;
    ctx.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
    function draw(t) {
      ctx.clearRect(0, 0, size, size);
      paintFrame(ctx, MODE_FRAMES[preset.mode](size, t, preset.opts), false);
    }
    if (stage === 'waiting') {
      draw(0);
      return;
    }
    const start = recent.get(id).started;
    let frame = 0;
    let firstCompleted = false;
    function tick(now) {
      const elapsed = Math.max(0, now - start);
      draw((elapsed / 1000) * preset.speed);
      if (!firstCompleted && elapsed >= cycleMs) {
        firstCompleted = true;
        setFirstCycleDone(true);
      }
      frame = requestAnimationFrame(tick);
    }
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [stage, id]);

  useLayoutEffect(() => {
    const orbNode = canvas.current;
    const answer = body.current;
    if (stage !== 'reveal' || !orbNode || !answer) return;
    if (!orbNode.animate) {
      setSettled(true);
      return;
    }
    const start = orbNode.getBoundingClientRect();
    const end = firstContentRect(answer);
    const destinationX = end.left + Math.min(4, end.width / 2);
    const destinationY = end.top + Math.min(12, end.height / 2);
    const dx = destinationX - (start.left + start.width / 2);
    const dy = destinationY - (start.top + start.height / 2);
    const answerBox = answer.getBoundingClientRect();
    const originX = Math.max(0, destinationX - answerBox.left);
    const originY = Math.max(0, destinationY - answerBox.top);
    const clipped = `inset(${Math.max(0, originY - 4)}px ${Math.max(0, answerBox.width - originX - 4)}px ${Math.max(0, answerBox.height - originY - 4)}px ${Math.max(0, originX - 4)}px round 4px)`;
    const timing = { duration: revealMs, easing: 'cubic-bezier(.22,.68,.24,1)', fill: 'both' };
    const shrink = orbNode.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.14)`, opacity: 0.85, offset: 0.72 },
        { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0 },
      ],
      timing
    );
    const open = answer.animate(
      [
        { clipPath: clipped, opacity: 0 },
        { clipPath: clipped, opacity: 0, offset: 0.38 },
        { clipPath: 'inset(0 0 0 0 round 0px)', opacity: 1 },
      ],
      timing
    );
    const waitingHeight = orbNode.parentElement.getBoundingClientRect().height;
    const resize =
      waitingHeight > answerBox.height
        ? answer.parentElement.animate(
            [{ minHeight: waitingHeight + 'px' }, { minHeight: answerBox.height + 'px' }],
            timing
          )
        : undefined;
    open.onfinish = () => setSettled(true);
    return () => {
      open.onfinish = null;
      shrink.cancel();
      open.cancel();
      resize?.cancel();
    };
  }, [stage]);

  const displayAnswer = stage === 'complete' || stage === 'reveal';
  return (
    <div className="orb-reply" data-orb-stage={stage} aria-busy={!displayAnswer}>
      {stage !== 'complete' && (
        <div className="orb-reply__indicator">
          <canvas
            ref={canvas}
            width={size}
            height={size}
            className="orb-reply__orb"
            aria-label="Preparing a reply"
            role="img"
          />
        </div>
      )}
      {phase !== 'pending' && (
        <div
          ref={body}
          className="orb-reply__answer"
          inert={!displayAnswer}
          aria-hidden={!displayAnswer || undefined}
        >
          <ReplyReadyContext.Provider value={onBodyReady}>{children}</ReplyReadyContext.Provider>
        </div>
      )}
    </div>
  );
}
