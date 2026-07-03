import { ClampText, GetDeepSeekClient, GetDeepSeekModel, InputLimits, ReadJsonObject } from "./AiService.js";

const SourceSystem = `You are a data-source configurator. Convert the user's data need into one data source and 1-3 suggested display blocks. Return only JSON.
Shape: {"source":{"id":"ds","kind":"http","url":"https://...","method":"GET","query":{},"headers":{},"path":"data.items","data":[]},"blocks":[]}
Rules:
1. Use public APIs when you know them.
2. If an API needs a key, use env:KEY_NAME placeholders in headers or query.
3. If no reliable API is known, return kind:"static" with 6-12 realistic sample rows.
4. Keep field names consistent across source data and blocks.`;

export async function GenerateSource(promptInput: string) {
  const prompt = ClampText(promptInput.trim(), InputLimits.maxPromptChars);
  if (!prompt) return { ok: false, status: 400, error: "Missing prompt." };

  const client = GetDeepSeekClient();
  const completion = await client.chat.completions.create({
    model: GetDeepSeekModel(),
    messages: [
      { role: "system", content: SourceSystem },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1600,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = ReadJsonObject(raw);
  if (!parsed.ok) return { ok: false, status: 200, error: parsed.error, raw };

  const data = parsed.data as { source?: Record<string, unknown>; blocks?: unknown[] };
  const source = NormalizeSource(data.source);
  if (!source) return { ok: false, status: 200, error: "No valid source was generated.", raw };

  return {
    ok: true,
    status: 200,
    source,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    usage: completion.usage,
  };
}

function NormalizeSource(source: Record<string, unknown> | undefined) {
  if (!source || typeof source !== "object") return null;

  const next = { ...source };
  if (!next.id) next.id = "ds";
  if (next.kind !== "static" && next.kind !== "http") next.kind = next.url ? "http" : "static";
  if (next.kind === "http" && !next.url) return null;
  if (next.kind === "http" && !next.method) next.method = "GET";

  return next;
}

