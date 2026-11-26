import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { resultPageSize, searchWorkspace } from './searchWorkspace.js';
import { Icon, colors } from '../ui.jsx';
import './desktopSearch.css';

function Passage({ text, needle }) {
  const start = text.toLowerCase().indexOf(needle);
  if (start < 0) return <>{text.slice(0, 120)}</>;
  const from = Math.max(0, start - 24);
  return (
    <>
      {from > 0 && '…'}
      {text.slice(from, start)}
      <mark>{text.slice(start, start + needle.length)}</mark>
      {text.slice(start + needle.length, start + needle.length + 80)}
    </>
  );
}

export function DesktopSearch({ tasks, notes, messages, onTask, onNote, onChatMessage, disabled }) {
  const input = useRef(null);
  const returnFocus = useRef(null);
  const scrollToSelection = useRef(false);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(0);
  const needle = query.trim().toLowerCase();
  const open = focused && !disabled && !!needle;
  const results = useMemo(
    () => (open ? searchWorkspace(tasks, notes, messages, needle) : []),
    [open, needle, tasks, notes, messages]
  );
  const index = Math.min(selected, results.length - 1);
  const first = Math.max(0, Math.floor(index / resultPageSize) * resultPageSize);
  const page = results.slice(first, first + resultPageSize);
  const optionId = (i) => listId + '-result-' + i;
  useLayoutEffect(() => {
    if (!scrollToSelection.current) return;
    scrollToSelection.current = false;
    document.getElementById(listId + '-result-' + index)?.scrollIntoView({ block: 'nearest' });
  }, [index, listId]);

  useEffect(() => {
    if (disabled) return;
    function shortcut(event) {
      if (
        !event.isComposing &&
        event.keyCode !== 229 &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement && document.activeElement !== input.current) {
          returnFocus.current = document.activeElement;
        }
        input.current?.focus();
        input.current?.select();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [disabled]);

  function choose(hit) {
    returnFocus.current = null;
    setQuery('');
    input.current?.blur();
    if (hit.kind === 'Task') onTask(hit.item);
    else if (hit.kind === 'Note') onNote(hit.item);
    else onChatMessage(hit.item.id);
  }

  function go(next) {
    scrollToSelection.current = true;
    setSelected(next);
    input.current?.focus({ preventScroll: true });
  }

  return (
    <div
      className="butler-workspace-search"
      role="search"
      aria-label="Workspace"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocused(false);
        returnFocus.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        const target = returnFocus.current;
        setQuery('');
        if (target?.isConnected && target !== document.body) target.focus({ preventScroll: true });
        else input.current?.focus({ preventScroll: true });
      }}
    >
      <span aria-hidden="true">
        <Icon name="search-outline" size={16} color={colors.muted} />
      </span>
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label="Search workspace"
        aria-autocomplete="list"
        placeholder="Search tasks, notes, chats"
        autoComplete="off"
        disabled={disabled}
        value={query}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && index >= 0 ? optionId(index) : undefined}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setSelected(0);
          setFocused(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229 || !open || !results.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            go((index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
          } else if (event.key === 'PageDown' || event.key === 'PageUp') {
            event.preventDefault();
            go(
              Math.max(
                0,
                Math.min(index + (event.key === 'PageDown' ? resultPageSize : -resultPageSize), results.length - 1)
              )
            );
          } else if (event.key === 'Enter' && results[index]) {
            event.preventDefault();
            choose(results[index]);
          }
        }}
      />
      <kbd aria-hidden="true">{/Mac/i.test(navigator.platform) ? 'Cmd K' : 'Ctrl K'}</kbd>
      {open && (
        <div className="butler-search-popup">
          <div role="listbox" aria-label="Search results" id={listId}>
            {page.map((hit, i) => (
              <div
                key={hit.kind + '-' + hit.item.id}
                id={optionId(first + i)}
                role="option"
                aria-selected={index === first + i}
                aria-posinset={first + i + 1}
                aria-setsize={results.length}
                className="butler-search-result"
                onMouseMove={() => setSelected(first + i)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(hit)}
              >
                <small>{hit.kind}</small>
                <strong>{hit.title}</strong>
                {!!hit.detail && (
                  <span>
                    <Passage text={hit.detail} needle={needle} />
                  </span>
                )}
              </div>
            ))}
          </div>
          {results.length > resultPageSize && (
            <div className="butler-search-pages">
              <span>
                {first + 1}–{first + page.length} of {results.length}
              </span>
              <button
                type="button"
                aria-label="Previous search results"
                disabled={first === 0}
                onClick={() => go(first - resultPageSize)}
              >
                Previous
              </button>
              <button
                type="button"
                aria-label="Next search results"
                disabled={first + page.length >= results.length}
                onClick={() => go(first + resultPageSize)}
              >
                Next
              </button>
            </div>
          )}
          {!results.length && <p role="status">No results</p>}
        </div>
      )}
    </div>
  );
}
