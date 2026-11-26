import { useEffect, useRef } from 'react';
import { PieChart, destroyPieChart } from './ring-source.js';
import { ringCanvas, ringGap, ringSegments, ringStroke } from './ring-model.js';
import './ring.css';

export function Ring({ size, completed, unfinished }) {
  const host = useRef(null);
  useEffect(() => {
    const element = host.current;
    if (!element || size <= 0) return;
    const segments = ringSegments(completed, unfinished);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mount = () => {
      PieChart(element, {
        values: segments.map(({ value }) => value),
        colors: segments.map(({ color }) => color),
        size,
        width: ringStroke,
        gap: ringGap,
        motion: preference.matches ? 'off' : 'auto',
      });
      // A browser applies non-scaling stroke to dash lengths as well as thickness.
      // Keep the Bito stroke width and scale its dash distances to the displayed arc.
      const scale = size / ringCanvas;
      for (const segment of element.querySelectorAll('.dui-pie__segment')) {
        const { strokeDasharray, strokeDashoffset } = segment.style;
        segment.style.strokeDasharray = strokeDasharray
          .split(/[\s,]+/)
          .map((distance) => `${Number.parseFloat(distance) * scale}px`)
          .join(' ');
        segment.style.strokeDashoffset = `${Number.parseFloat(strokeDashoffset) * scale}px`;
      }
    };
    mount();
    preference.addEventListener('change', mount);
    return () => {
      preference.removeEventListener('change', mount);
      destroyPieChart(element);
    };
  }, [size, completed, unfinished]);

  return <div ref={host} aria-hidden="true" style={{ width: size, height: size }} />;
}
