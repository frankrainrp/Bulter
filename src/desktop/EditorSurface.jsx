import { useLayoutEffect, useRef } from 'react';

import './editorSurface.css';

function returnTarget(previous) {
  if (previous?.isConnected && !previous.matches(':disabled')) return previous;
  if (previous?.matches('.butler-calendar-entry') && previous.dataset.key) {
    const month = document.querySelector('.butler-calendar-month');
    return (
      month?.querySelector(`[data-key="${CSS.escape(previous.dataset.key)}"]`) ??
      month?.querySelector('.dui-calendar__day[aria-pressed="true"]')
    );
  }
  const name = previous?.getAttribute('aria-label');
  return name ? document.querySelector(`[aria-label="${CSS.escape(name)}"]`) : null;
}

export function EditorSurface({ children, desktop, label, saving, fromSearch, onCancel }) {
  const container = useRef(null);
  const backdropPress = useRef(false);
  const trigger = useRef(null);

  useLayoutEffect(() => {
    const dialog = container.current;
    if (!dialog) return;
    if (desktop) {
      const previous = document.activeElement;
      trigger.current = fromSearch
        ? document.querySelector('[aria-label="Search workspace"]')
        : previous instanceof HTMLElement && previous !== document.body
          ? previous
          : null;
      dialog.showModal();
      dialog.querySelector('input:not([disabled]), textarea:not([disabled])')?.focus({ preventScroll: true });
    } else {
      // The mobile editor is a normal, full-page workspace route.
      dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog.open) dialog.close();
      if (desktop) {
        const previous = trigger.current;
        requestAnimationFrame(() => {
          const target = returnTarget(previous) ?? document.querySelector('[role="tab"][aria-selected="true"]');
          target?.focus({ preventScroll: true });
        });
      }
    };
  }, [desktop, fromSearch]);

  function isBackdrop(event) {
    if (event.target !== event.currentTarget) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }

  function cycleFocus(event) {
    if (!desktop || event.key !== 'Tab') return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll('button, input, textarea, select, a[href], [tabindex]')
    ).filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(':disabled, [aria-disabled="true"]') &&
        element.getClientRects().length > 0
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || (event.shiftKey ? document.activeElement !== first : document.activeElement !== last)) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }

  return (
    <dialog
      ref={container}
      className={desktop ? 'butler-editor-drawer' : 'butler-editor-page'}
      role={desktop ? 'dialog' : 'main'}
      aria-label={label}
      aria-modal={desktop || undefined}
      onKeyDown={cycleFocus}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving && desktop) onCancel();
      }}
      onPointerDown={(event) => {
        backdropPress.current = desktop && isBackdrop(event);
      }}
      onClick={(event) => {
        if (backdropPress.current && !saving && isBackdrop(event)) onCancel();
      }}
    >
      {children}
    </dialog>
  );
}
