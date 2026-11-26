// Same-tab writes and changes from other workspace tabs use the same subscription.
export function browserPreference(key, values, initial) {
  let fallback = initial;
  let memoryOnly = false;
  const listeners = new Set();
  function notify() {
    listeners.forEach((listener) => listener());
  }

  function get() {
    if (!memoryOnly) {
      try {
        const stored = localStorage.getItem(key);
        fallback = values.find((value) => value === stored) ?? initial;
      } catch {
        /* Keep the last choice if this browser restricts storage. */
      }
    }
    return fallback;
  }
  function set(value) {
    fallback = value;
    try {
      localStorage.setItem(key, value);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
    }
    notify();
    return !memoryOnly;
  }
  function sync(event) {
    if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) {
      memoryOnly = false;
      notify();
    }
  }
  function subscribe(listener) {
    if (!listeners.size) window.addEventListener('storage', sync);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) window.removeEventListener('storage', sync);
    };
  }
  return { get, set, subscribe };
}
