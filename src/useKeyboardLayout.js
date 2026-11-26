import { useEffect, useState } from 'react';

const closed = { open: false };

function editingText() {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && /^(text|password|search|tel|url|email|number)$/.test(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

export function useKeyboardLayout() {
  const [layout, setLayout] = useState(closed);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const touch = window.matchMedia('(any-pointer: coarse)');
    let baseline = window.innerHeight;
    let width = window.innerWidth;
    let frame;
    let previous = closed;

    function update() {
      frame = undefined;
      if (!viewport) return;
      const editing = editingText();
      if (window.innerWidth !== width || (!editing && !previous.open)) baseline = window.innerHeight;
      width = window.innerWidth;

      // Mobile engines either resize the visual viewport alone or resize both viewports.
      const open =
        touch.matches &&
        Math.abs(viewport.scale - 1) < 0.02 &&
        (editing || previous.open) &&
        Math.max(window.innerHeight, baseline) - viewport.height > 120;
      const next = open
        ? { open: true, viewport: { height: Math.floor(viewport.height), top: Math.round(viewport.pageTop) } }
        : closed;
      if (
        next.open === previous.open &&
        next.viewport?.height === previous.viewport?.height &&
        next.viewport?.top === previous.viewport?.top
      )
        return;
      previous = next;
      setLayout(next);
    }

    function schedule() {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    }

    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  return layout;
}
