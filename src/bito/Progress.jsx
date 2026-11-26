import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { colors } from '../ui.jsx';
import { mountDetroitProgressBar, setDetroitProgress, stopDetroitProgressTimer } from './progress-source.js';

import './progress.css';

export function Progress({ done, total, onDark = false }) {
  const element = useRef(null);
  const id = 'bito-progress-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const color = onDark ? colors.attention : colors.accent;

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    mountDetroitProgressBar(node);
    return () => stopDetroitProgressTimer(node);
  }, []);

  useLayoutEffect(() => {
    if (!element.current) return;
    element.current.style.setProperty('--dui-progress-color', color);
    setDetroitProgress(element.current, done, { max: total || 1, animate: done > 0 });
  }, [color, done, total]);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let visible = true;
    const update = () => node.toggleAttribute('data-offscreen', !visible || document.hidden);
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          })
        : undefined;
    observer?.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div
      ref={element}
      className="bito-progress"
      data-progress-id={id}
      data-marker="true"
      aria-label="Completion"
      aria-valuetext={`${done} of ${total} completed`}
    />
  );
}
