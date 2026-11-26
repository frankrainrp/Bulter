import browserStorage from '../browser/storage.js';

const keyName = 'bito-c304.assistant-connection';
const storeName = 'profiles';

function requireVault() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error('The connection vault is unavailable.');
}

async function transact(mode, operation) {
  const database = await new Promise((resolve, reject) => {
    const open = indexedDB.open(keyName, 1);
    let blocked = false;
    open.onupgradeneeded = () => open.result.createObjectStore(storeName);
    open.onsuccess = () => {
      if (blocked) open.result.close();
      else resolve(open.result);
    };
    open.onerror = () => reject(open.error);
    open.onblocked = () => {
      blocked = true;
      reject(new Error('The connection vault is busy.'));
    };
  });
  database.onversionchange = () => database.close();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
}

export async function readConnection() {
  if (!globalThis.isSecureContext) return browserStorage.getItem(keyName);
  requireVault();
  const envelope = await transact('readonly', (store) => store.get(keyName));
  if (!envelope) return browserStorage.getItem(keyName);
  const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv }, envelope.key, envelope.data);
  return new TextDecoder().decode(value);
}

export async function writeConnection(value, secure) {
  if (!globalThis.isSecureContext) {
    if (secure) throw new Error('The browser cannot save a model key on this origin.');
    await browserStorage.setItem(keyName, value);
    return;
  }
  requireVault();

  // Keep credentials out of ordinary storage. The CryptoKey cannot be exported.
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  await transact('readwrite', (store) => store.put({ key, iv, data }, keyName));
}
