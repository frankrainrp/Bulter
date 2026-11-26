export function createLiveReplyText() {
  const listeners = new Set();
  let text = '';
  let frame;

  function notify() {
    frame = undefined;
    listeners.forEach((listener) => listener());
  }

  return {
    read: () => text,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receive(value) {
      // Stop can read every received character, even before the next paint.
      text = value;
      if (listeners.size && frame === undefined) frame = requestAnimationFrame(notify);
    },
    clear() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      text = '';
    },
  };
}
