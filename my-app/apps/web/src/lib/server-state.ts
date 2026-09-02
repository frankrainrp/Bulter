export type ServerStateKey = "ddls" | "sessions" | "messages" | "notes";

export type ServerState = Record<ServerStateKey, unknown[]>;

export async function loadServerState(): Promise<ServerState> {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error(`SQLite state load failed: ${response.status}`);
  return response.json() as Promise<ServerState>;
}

export async function saveServerState(key: ServerStateKey, value: unknown[]): Promise<void> {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) throw new Error(`SQLite state save failed: ${response.status}`);
}

