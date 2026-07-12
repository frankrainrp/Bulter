import type { ApiMessage } from "./chat-client";
import type { ChatMessage } from "./types";

const HISTORY_LIMIT = 10;

/** Build clean model history from UI messages belonging to one chat session. */
export function buildChatHistory(rows: ChatMessage[], sessionId: string): ApiMessage[] {
  const normalized: ApiMessage[] = [];

  for (const message of rows) {
    if (message.sessionId !== sessionId) continue;
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (!message.content.trim() || message.isError) continue;
    // Attachment prompts are handled by the separate document pipeline. Sending
    // them again on a later text-only turn contaminates the current chat intent.
    if (message.role === "user" && message.files && message.files.length > 0) continue;

    const next: ApiMessage = { role: message.role, content: message.content };
    const previous = normalized[normalized.length - 1];

    // If a request failed before an assistant reply, only the newest unanswered
    // user turn remains authoritative.
    if (next.role === "user" && previous?.role === "user") {
      normalized[normalized.length - 1] = next;
      continue;
    }
    if (next.role === "assistant" && previous?.role !== "user") continue;
    normalized.push(next);
  }

  let recent = normalized.slice(-HISTORY_LIMIT);
  while (recent.length > 0 && recent[0].role !== "user") recent = recent.slice(1);
  return recent;
}
