import { useCallback, useEffect, useRef, useState } from 'react';

const key = 'bito-c304.note-vault.tab-v1';
let fallback = { drafts: [], activeId: '', reading: false };

function restore() {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    if (
      typeof value.activeId === 'string' &&
      typeof value.reading === 'boolean' &&
      Array.isArray(value.drafts) &&
      value.drafts.every(
        (draft) =>
          draft &&
          typeof draft.id === 'string' &&
          typeof draft.title === 'string' &&
          typeof draft.content === 'string' &&
          (draft.base === null ||
            (draft.base &&
              draft.base.id === draft.id &&
              typeof draft.base.title === 'string' &&
              typeof draft.base.content === 'string' &&
              Number.isFinite(draft.base.updatedAt)))
      )
    )
      return value;
  } catch {
    /* A restricted or full store still allows in-memory editing. */
  }
  return fallback;
}

export function useNoteDrafts() {
  const [session, setSession] = useState(restore);
  const current = useRef(session);
  const unpublished = useRef(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const publish = useCallback(() => {
    if (unpublished.current) {
      unpublished.current = false;
      setSession(current.current);
    }
    return current.current;
  }, []);
  const update = useCallback(
    (change, composing = false) => {
      const old = current.current;
      const next = change(old);
      current.current = next;
      fallback = next;
      unpublished.current = true;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
        setStorageWarning(false);
      } catch {
        setStorageWarning(true);
        publish();
        return;
      }
      // Keep Save and the dirty indicator accurate when a composition starts or cancels.
      if (!composing || old.drafts.length !== next.drafts.length) publish();
    },
    [publish]
  );
  useEffect(() => {
    if (!storageWarning || !session.drafts.length) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [storageWarning, session.drafts.length]);
  return { session, update, publish, storageWarning };
}
