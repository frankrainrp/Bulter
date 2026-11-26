const screenTransitions = new WeakMap();
const scanPalette = [
  'focus-100', 'navy-black', 'navy-deep', 'navy', 'blue-deep',
  'blue', 'blue-bright', 'blue-soft', 'blue-gray', 'blue-pale',
];
const scanPhaseMs = 210;
const scanStagger = .045;
const scanTravel = .55;

function scanEase(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t < .5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2;
}

export function ScreenTransition(host = document.body, {geometry = 'sweep'} = {}) {
  if (screenTransitions.has(host)) return screenTransitions.get(host);
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const reduced = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let overlay = null;
  let bands = [];
  let frame = null;
  let previousTime = 0;
  let progress = 0;
  let target = 1;
  let layoutBackwards = false;
  let exitBackwards = false;
  let pending = null;
  let destroyed = false;

  function clear() {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    pending = null;
    overlay?.remove();
    overlay = null;
    bands = [];
  }

  function finishImmediately() {
    const commit = pending;
    clear();
    commit?.();
  }

  function preferencesChanged() {
    if (overlay && (reduced?.matches || doc.hidden)) finishImmediately();
  }

  function render() {
    const sign = layoutBackwards ? -1 : 1;
    for (let i = 0; i < bands.length; i++) {
      const delay = i * scanStagger;
      const enter = scanEase((progress - delay) / scanTravel);
      const leave = scanEase((progress - 1 - delay) / scanTravel);
      if (geometry === 'center') {
        bands[i].style.setProperty('--dui-scan-cover', String(enter - leave));
      } else {
        const percent = 100 * sign * (enter - 1 + leave);
        bands[i].style.transform = `translateX(${percent}%)`;
      }
    }
  }

  function schedule() {
    if (overlay && frame === null) frame = view.requestAnimationFrame(step);
  }

  function step(now) {
    frame = null;
    const distance = Math.max(0, now - previousTime) / scanPhaseMs;
    previousTime = now;
    progress += Math.sign(target - progress) * Math.min(distance, Math.abs(target - progress));
    render();
    if (progress === target) {
      if (target !== 1) {
        clear();
        return;
      }
      const commit = pending;
      pending = null;
      target = exitBackwards === layoutBackwards ? 2 : 0;
      try {
        commit?.();
      } catch (error) {
        clear();
        throw error;
      }
    }
    schedule();
  }

  function mount(backwards) {
    layoutBackwards = backwards;
    progress = 0;
    previousTime = view.performance.now();
    overlay = doc.createElement('div');
    overlay.className = 'dui-screen-transition';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    if (host === doc.body || host === doc.documentElement) {
      overlay.classList.add('dui-screen-transition--viewport');
    }
    if (backwards) overlay.classList.add('dui-screen-transition--backwards');
    if (geometry === 'center') overlay.classList.add('dui-screen-transition--center');
    bands = scanPalette.map(color => {
      const band = doc.createElement('div');
      const paint = `var(--dui-color-${color})`;
      if (geometry === 'center') band.style.color = paint;
      else band.style.backgroundColor = paint;
      overlay.append(band);
      return band;
    });
    render();
    host.append(overlay);
  }

  function run(commit, {backwards = false} = {}) {
    if (destroyed) return;
    pending = commit;
    if (!view?.requestAnimationFrame || doc.hidden || reduced?.matches || host.closest('[data-motion="off"]')) {
      finishImmediately();
      return;
    }
    if (!overlay) mount(backwards);
    // A new destination during the reveal retraces the current bands to full cover.
    target = 1;
    exitBackwards = backwards;
    schedule();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clear();
    reduced?.removeEventListener('change', preferencesChanged);
    doc.removeEventListener('visibilitychange', preferencesChanged);
    screenTransitions.delete(host);
  }

  const controller = {run, destroy, finish: finishImmediately, isActive: () => overlay !== null};
  reduced?.addEventListener('change', preferencesChanged);
  doc.addEventListener('visibilitychange', preferencesChanged);
  screenTransitions.set(host, controller);
  return controller;
}
