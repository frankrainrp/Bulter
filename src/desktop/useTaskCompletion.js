import { useEffect, useRef, useState } from 'react';

import { playTaskSound, prepareTaskSound } from './taskFeedback.js';

const dismissHandlers = new Set();

export function dismissDesktopTaskEffects() {
  for (const dismiss of dismissHandlers) dismiss();
}

export function useTaskCompletion(onToggle) {
  const active = useRef(new Map());
  const [rows, setRows] = useState(new Map());
  const publish = () => setRows(new Map(active.current));

  function cancelAll() {
    for (const record of active.current.values()) clearTimeout(record.timer);
    active.current.clear();
  }
  function reset() {
    if (!active.current.size) return;
    cancelAll();
    publish();
  }
  useEffect(() => {
    dismissHandlers.add(reset);
    const hidden = () => {
      if (document.hidden) reset();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      dismissHandlers.delete(reset);
      document.removeEventListener('visibilitychange', hidden);
      cancelAll();
    };
  }, []);

  function release(id) {
    const checkbox = document.activeElement;
    const list = checkbox?.closest('[data-testid="desktop-tasks"]');
    const restoreFocus = list && checkbox?.getAttribute('data-task-toggle') === id;
    active.current.delete(id);
    publish();
    if (restoreFocus)
      requestAnimationFrame(() => {
        if (!list.isConnected || document.activeElement !== document.body) return;
        const toggles = Array.from(list.querySelectorAll('[data-task-toggle]'));
        const focus =
          toggles.find((button) => button.dataset.taskToggle === id) ??
          toggles[0] ??
          list.querySelector('[aria-pressed="true"]');
        focus?.focus({ preventScroll: true });
      });
  }

  function highlight(entry, reduced) {
    clearTimeout(entry.timer);
    playTaskSound('completed');
    entry.phase = reduced ? 'settled' : 'highlight';
    publish();
    entry.timer = setTimeout(
      () => {
        entry.phase = 'settled';
        publish();
        entry.timer = setTimeout(() => release(entry.original.id), 140);
      },
      reduced ? 160 : 360
    );
  }

  function drawn(id) {
    const entry = active.current.get(id);
    if (entry?.phase === 'draw') highlight(entry, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  async function toggle(task) {
    const previous = active.current.get(task.id);
    if (previous?.phase === 'saving') return;
    clearTimeout(previous?.timer);
    const entry = { original: task, phase: 'saving' };
    active.current.set(task.id, entry);
    publish();
    if (task.status !== 'done') prepareTaskSound();
    const success = await onToggle(task);
    if (active.current.get(task.id) !== entry) return;
    if (!success || task.status === 'done') {
      release(task.id);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) highlight(entry, true);
    else {
      entry.phase = 'draw';
      publish();
      // Virtualized rows and a live motion-preference change can skip animationend.
      entry.timer = setTimeout(() => drawn(task.id), 500);
    }
  }

  return { rows, toggle, drawn, reset };
}
