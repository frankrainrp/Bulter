export async function getStorageItem<T>(bucket: string, id: string): Promise<T | null> {
  return callStorage<T | null>(`/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(id)}`);
}

export async function getStorageList<T>(bucket: string): Promise<T[]> {
  return callStorage<T[]>(`/storage/${encodeURIComponent(bucket)}`);
}

export async function putStorageItem<T>(bucket: string, id: string, item: T): Promise<T> {
  return callStorage<T>(`/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

export async function deleteStorageItem(bucket: string, id: string): Promise<void> {
  await callStorage(`/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deleteStorageItems(bucket: string, ids: string[]): Promise<void> {
  await callStorage(`/storage/${encodeURIComponent(bucket)}/delete-many`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob."));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function callStorage<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/express-api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok) throw new Error(json.error || "storage request failed");
  return json.data as T;
}

