import { useLayoutEffect, useRef, useState } from 'react';
import { SourceButtonChrome } from './SourceButtonChrome.jsx';
import './detroitFormButton.css';

// A native submit button can participate in implicit Enter submission and fieldset validation.
export function DetroitFormButton({ children, primary = false, type = 'button', ...props }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    const measure = () => setWidth(element.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      aria-label={props['aria-label'] ?? children}
      className="detroit-form-button"
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        setPressed(false);
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') setPressed(true);
      }}
      onKeyUp={() => setPressed(false)}
    >
      <span className="detroit-form-button-size" aria-hidden>
        {children}
      </span>
      <SourceButtonChrome
        width={width}
        height={48}
        inset={5}
        visualMinHeight={18}
        tab
        focused={!props.disabled && (focus || hover)}
        pressed={!props.disabled && pressed}
        selected={primary}
      >
        {(dark) => <span style={{ color: dark ? '#fff' : '#18364c' }}>{children}</span>}
      </SourceButtonChrome>
    </button>
  );
}
