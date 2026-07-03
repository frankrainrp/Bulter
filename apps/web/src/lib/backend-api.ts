type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiFail = {
  ok: false;
  error: string;
};

type ApiResult<T> = ApiOk<T> | ApiFail;

export type ApiTask = {
  id: string;
  taskName: string;
  weight: number | null;
  dueDate: string;
  dueTime: string;
  description: string;
  isGroupWork: boolean;
  source: string;
  completed: boolean;
  status: "todo" | "in_progress" | "done";
  tags: string[];
  priority: "low" | "med" | "high";
  notes: string;
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiNote = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  syncedTodos: string[];
  createdAt: string;
  updatedAt: string;
};

export type ApiAuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
};

export type ApiChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ApiChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{
    id: string;
    name: string;
    size: number;
    mime: string;
  }>;
  reasoning?: string;
  isError?: boolean;
  timestamp: string;
};

export type AddTaskInput = Partial<ApiTask> & {
  taskName: string;
};

export type AddNoteInput = Partial<ApiNote> & {
  title: string;
};

async function CallApi<T>(path: string, init?: RequestInit) {
  const res = await fetch(`/express-api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = (await res.json()) as ApiResult<T>;

  if (body.ok === false) {
    throw new Error(body.error);
  }

  return body.data;
}

export function GetTaskListByApi() {
  return CallApi<ApiTask[]>("/tasks");
}

export function ReplaceTaskListByApi(items: unknown[]) {
  return CallApi<ApiTask[]>("/tasks/replace", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function AddTaskByApi(input: AddTaskInput) {
  return CallApi<ApiTask>("/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function GetNoteListByApi() {
  return CallApi<ApiNote[]>("/notes");
}

export function ReplaceNoteListByApi(items: unknown[]) {
  return CallApi<ApiNote[]>("/notes/replace", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function AddNoteByApi(input: AddNoteInput) {
  return CallApi<ApiNote>("/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function RunAgentActionByApi(actionName: string, data?: unknown) {
  return CallApi<unknown>("/agent/run", {
    method: "POST",
    body: JSON.stringify({ actionName, data }),
  });
}

export function CheckAuthByApi() {
  return CallApi<{ user: ApiAuthUser | null }>("/auth/me", {
    cache: "no-store",
  });
}

export function LoginByApi(input: { email: string; password: string }) {
  return CallApi<{ user: ApiAuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function SignupByApi(input: { name: string; email: string; password: string }) {
  return CallApi<{ user: ApiAuthUser }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function LogoutByApi() {
  return CallApi<{ user: null }>("/auth/logout", {
    method: "POST",
  });
}

export function GetChatHistoryByApi() {
  return CallApi<{ sessions: ApiChatSession[]; messages: ApiChatMessage[] }>("/chat/history", {
    cache: "no-store",
  });
}

export function ReplaceChatHistoryByApi(input: { sessions: unknown[]; messages: unknown[] }) {
  return CallApi<{ sessions: ApiChatSession[]; messages: ApiChatMessage[] }>("/chat/history", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
