import { useState } from 'react';
import './container.css';

// Same child order and state as Bito's mounted Container. React retains ownership
// of the content subtree so edits and list updates keep their focus and identity.
export function StackedPanel({ children, tone }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className={`dui-container c346-stack is-idle${pressed ? ' is-previewing' : ''}`}
      data-variant="stacked"
      data-state="idle"
      data-tone={tone}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <div className="dui-container__content">{children}</div>
      <i className="dui-container__corner tl" aria-hidden="true" />
      <i className="dui-container__corner br" aria-hidden="true" />
    </div>
  );
}
