import { useLayoutEffect, useRef } from 'react';
import { typefaces } from '../bito/Typography.jsx';

export function ChatDraft({
  value,
  onChange,
  onSubmit,
  canSend,
  editable,
  onFocusChange,
  compact,
  focusRequest,
  onStop,
  placeholder,
}) {
  const textarea = useRef(null);
  useLayoutEffect(() => {
    if (focusRequest) textarea.current?.focus({ preventScroll: true });
  }, [focusRequest]);
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(compact ? 102 : 200, Math.max(42, element.scrollHeight))}px`;
  }, [compact, value]);
  return (
    <textarea
      ref={textarea}
      aria-label="Message"
      placeholder={placeholder ?? 'Message Agent…'}
      rows={1}
      maxLength={4000}
      value={value}
      readOnly={!editable}
      onChange={(event) => onChange(event.currentTarget.value)}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape' && onStop) {
          event.preventDefault();
          onStop();
          return;
        }
        if (event.key !== 'Enter' || event.shiftKey) return;
        if (!canSend) return;
        event.preventDefault();
        onSubmit();
      }}
      style={{
        display: 'block',
        boxSizing: 'border-box',
        width: '100%',
        padding: '12px 16px 4px',
        margin: 0,
        resize: 'none',
        border: 0,
        outline: 'none',
        backgroundColor: 'transparent',
        fontFamily: `${typefaces.thin}, system-ui, sans-serif`,
        fontSize: 16,
        lineHeight: '21px',
        color: '#242B33',
        caretColor: '#1371BF',
      }}
    />
  );
}
