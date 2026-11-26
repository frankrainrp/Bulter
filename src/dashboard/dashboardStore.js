import { randomUUID } from '../id.js';
import { changeDashboard, decodeDashboard } from './layout.js';

const databaseName = 'bito-c304.dashboard';
const storeName = 'panels';
const layoutKey = 'workspace';
const changed = 'bito-c304.dashboard-change';

function openChannel() {
  try {
    return new BroadcastChannel(changed);
  } catch {
    return undefined;
  }
}

function openDashboard() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Dashboard storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(new Error('Could not open dashboard storage.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact(update) {
  const db = await openDashboard();
  try {
    return await new Promise((resolve, reject) => {
      // A readwrite transaction always reads the last committed layout, including edits from other tabs.
      const tx = db.transaction(storeName, update ? 'readwrite' : 'readonly');
      const store = tx.objectStore(storeName);
      const read = store.get(layoutKey);
      let result;
      let reason;
      read.onsuccess = () => {
        try {
          result = decodeDashboard(read.result);
          if (update) {
            result = update(result);
            store.put(result, layoutKey);
          }
        } catch (cause) {
          reason = cause;
          tx.abort();
        }
      };
      tx.onabort = () => reject(reason ?? new Error('Dashboard changes could not be saved. Please try again.'));
      tx.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}

export const getDashboardLayout = () => transact();

export async function applyDashboardAction(action) {
  const layout = await transact((current) => changeDashboard(current, action, randomUUID));
  window.dispatchEvent(new Event(changed));
  const channel = openChannel();
  try {
    if (channel) channel.postMessage(true);
    else localStorage.setItem(changed, randomUUID());
  } catch {
    /* Tabs also read the committed layout when focused. */
  } finally {
    channel?.close();
  }
  return layout;
}

export function subscribeDashboard(listener) {
  const channel = openChannel();
  function onStorage(event) {
    if (event.key === changed) listener();
  }
  channel?.addEventListener('message', listener);
  window.addEventListener(changed, listener);
  window.addEventListener('focus', listener);
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.close();
    window.removeEventListener(changed, listener);
    window.removeEventListener('focus', listener);
    window.removeEventListener('storage', onStorage);
  };
}
