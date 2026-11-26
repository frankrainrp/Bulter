import { useCallback, useEffect, useRef, useState } from 'react';
import { createSampleWorkspace } from './course/sampleWorkspace.js';
import { decodeWorkspace } from './model.js';

const storageKey = 'bito-c304.workspace';

function readWorkspace() {
  const stored = localStorage.getItem(storageKey);
  if (stored !== null) return decodeWorkspace(stored);
  const initial = createSampleWorkspace();
  localStorage.setItem(storageKey, JSON.stringify(initial));
  return initial;
}

function withWorkspaceLock(operation) {
  return navigator.locks ? navigator.locks.request(storageKey, operation) : operation();
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await withWorkspaceLock(readWorkspace);
        if (active) {
          setWorkspace(data);
          setLoadError(false);
        }
      } catch {
        if (active) setLoadError(true);
      }
    }
    void load();
    function storageChanged(event) {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) void load();
    }
    window.addEventListener('storage', storageChanged);
    return () => {
      active = false;
      window.removeEventListener('storage', storageChanged);
    };
  }, [attempt]);

  const commit = useCallback(async (change) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const updated = await withWorkspaceLock(() => {
        const current = readWorkspace();
        const next = change(current);
        if (next !== current) localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      setWorkspace(updated);
      return true;
    } catch {
      setSaveError(true);
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  function retry() {
    setLoadError(false);
    setAttempt((count) => count + 1);
  }
  return { workspace, loadError, retry, commit, saving, saveError, clearSaveError: () => setSaveError(false) };
}
