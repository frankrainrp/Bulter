import { useEffect, useState } from 'react';
import { sourceButtonChromeGeometry } from './sourceButtonGeometry.js';

import './sourceButton.css';

const corners = ['tl', 'tr', 'bl', 'br'];

export function SourceButtonChrome({
  width,
  height,
  inset,
  visualMinHeight,
  focused,
  pressed,
  selected,
  tab = false,
  children,
}) {
  const [stage, setStage] = useState('idle');

  useEffect(() => {
    if (selected) {
      setStage('focused');
      return;
    }
    if (focused) {
      setStage('acquiring');
      const timer = setTimeout(() => setStage('focused'), 3150);
      return () => clearTimeout(timer);
    }
    setStage((previous) => (previous === 'idle' ? 'idle' : 'unfocusing'));
    const timer = setTimeout(() => setStage('idle'), 400);
    return () => clearTimeout(timer);
  }, [focused, selected]);

  const {
    bodyHeight,
    facets,
    faceHeight,
    faceTop,
    glowHeight,
    cornerLength,
    cornerStroke,
    cornerTravel,
    pressTravel,
    referenceSize,
    referenceBottom,
  } = sourceButtonChromeGeometry(width, height, inset, visualMinHeight, tab);
  const backing = (faceHeight - bodyHeight) / 2;
  const metrics = {
    '--corner-stroke': `${cornerStroke}px`,
    '--corner-travel': `${cornerTravel}px`,
    '--corner-press': `${pressTravel}px`,
  };
  const glow = { left: inset, right: inset, height: glowHeight };
  const hasFocus = selected || focused;
  const stageClasses = [
    hasFocus && 'is-focused',
    focused && !selected && stage === 'acquiring' && 'is-acquiring',
    !hasFocus && stage === 'unfocusing' && 'is-unfocusing',
    pressed && 'is-pressed',
  ]
    .filter(Boolean)
    .join(' ');

  function layer(focus) {
    return facets.map(({ left, width, kind }, index) => (
      <span
        key={index}
        className={`dui-source-button__piece p${index} ${kind} ${focus ? `focus${index}` : ''}`}
        style={{ left, width }}
      />
    ));
  }

  function label(variant, content) {
    return <span className={`dui-source-button__label ${variant}`}>{content}</span>;
  }

  return (
    <span
      className={`dui-source-button butler-source-button ${tab ? 'butler-tab-button' : ''} ${stageClasses}`}
      style={metrics}
      aria-hidden="true"
    >
      <span className="dui-source-button__grad-top" style={{ ...glow, top: faceTop - glowHeight }} />
      <span className="dui-source-button__grad-bottom" style={{ ...glow, bottom: faceTop - glowHeight }} />
      {!tab && (
        <span
          className="dui-source-button__ref-square"
          style={{ left: inset, width: referenceSize, height: referenceSize, bottom: referenceBottom }}
        />
      )}
      {corners.map((corner) => (
        <span
          key={corner}
          className={`dui-source-button__corner ${corner}`}
          style={{ width: cornerLength, height: cornerLength }}
        />
      ))}
      <span
        className="dui-source-button__body"
        style={{
          top: '50%',
          bottom: 'auto',
          height: bodyHeight,
          left: inset,
          right: inset,
          transform: 'translateY(-50%)',
        }}
      >
        {!tab && <span className="dui-source-button__base">{layer(false)}</span>}
        <span className="dui-source-button__focus-grad" style={{ top: -backing, bottom: -backing }} />
        <span className="dui-source-button__focus-big" />
        <span className="dui-source-button__focus-big-grad" />
        <span className="dui-source-button__focus-shapes">{layer(true)}</span>
        <span className="dui-source-button__press" style={{ top: -backing, bottom: -backing }} />
        {label('normal', children(false))}
        {label('focus', children(true))}
        {label('press', children(true))}
      </span>
    </span>
  );
}
