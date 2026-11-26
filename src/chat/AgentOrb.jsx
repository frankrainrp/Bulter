import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native-web';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';
import { useReducedMotion } from '../bito/useReducedMotion.js';

const stillTime = 0.6;
const frameInterval = 1000 / 24;
const round = (n) => Math.round(n * 100) / 100;

// Use the upstream frame geometry and draw it with Butler's existing SVG renderer.
export function AgentOrb({ state, label, size = 28, animate = false, color }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(() => !AppState.currentState || AppState.currentState === 'active');
  const [time, setTime] = useState(stillTime);
  const designSize = size < 32 ? 20 : 64;
  const preset = useMemo(() => resolvePreset(state, designSize), [designSize, state]);
  useEffect(() => {
    if (!animate) return;
    const subscription = AppState.addEventListener('change', (status) => setActive(status === 'active'));
    return () => subscription.remove();
  }, [animate]);
  useEffect(() => {
    if (!animate || reduced || !active) return;
    let frame = 0;
    let previous = -Infinity;
    const tick = (now) => {
      if (now - previous >= frameInterval) {
        previous = now;
        setTime(now / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, animate, reduced]);

  const moment = animate && !reduced && active ? time * preset.speed : stillTime;
  const paths = useMemo(() => {
    const { dots, lines } = MODE_FRAMES[preset.mode](designSize, moment, preset.opts);
    const pathsByInk = new Map();
    function add(d, white, alpha, strokeWidth = 0) {
      const opacity = Math.round(Math.max(0, Math.min(1, alpha)) * 12) / 12;
      if (!opacity) return;
      const gray = Math.round(Math.max(0, Math.min(1, white)) * 8) * 31;
      const key = `${gray}/${opacity}/${strokeWidth}`;
      let layer = pathsByInk.get(key);
      if (!layer) {
        layer = { opacity, fill: `rgb(${gray},${gray},${gray})`, strokeWidth, d: [] };
        pathsByInk.set(key, layer);
      }
      layer.d.push(d);
    }
    for (const { x1, y1, x2, y2, white, a, w } of lines) {
      add(`M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`, white, a ?? 1, round(w));
    }
    for (const { x, y, r, white, a } of dots) {
      const radius = round(r);
      if (radius > 0) {
        const diameter = round(radius * 2);
        add(
          `M${round(x - radius)} ${round(y)}a${radius} ${radius} 0 1 0 ${diameter} 0a${radius} ${radius} 0 1 0 -${diameter} 0`,
          white,
          a ?? 1
        );
      }
    }
    return [...pathsByInk.entries()];
  }, [designSize, moment, preset]);

  return (
    <View
      testID={`agent-orb-${state}`}
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      aria-hidden={!label}
      pointerEvents="none"
    >
      <svg width={size} height={size} viewBox={`0 0 ${designSize} ${designSize}`}>
        {paths.map(([key, layer]) => (
          <path
            key={key}
            d={layer.d.join('')}
            opacity={layer.opacity}
            fill={layer.strokeWidth ? 'none' : (color ?? layer.fill)}
            stroke={layer.strokeWidth ? (color ?? layer.fill) : undefined}
            strokeWidth={layer.strokeWidth || undefined}
          />
        ))}
      </svg>
    </View>
  );
}
