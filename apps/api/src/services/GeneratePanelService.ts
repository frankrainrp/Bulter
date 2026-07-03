import { GetByPath } from "../utils/ObjectPath.js";
import { ProxyFetch } from "./ConnectorService.js";
import { ClampText, GetDeepSeekClient, GetDeepSeekModel, InputLimits, ReadJsonObject } from "./AiService.js";

export type GeneratePanelInput = {
  prompt?: string;
  currentSpec?: unknown;
  fixError?: string;
  probe?: boolean;
};

const MaxProbes = 3;

const PanelSystem = `You generate dashboard panel JSON. Return only JSON.
Shape:
{
  "version": 1,
  "title": "short title",
  "emoji": "one emoji",
  "description": "optional sentence",
  "sources": [
    {"id":"s","kind":"static","data":[{"name":"A","value":10}]}
  ],
  "blocks": [
    {"type":"kpiGrid","title":"Overview","metrics":[{"label":"Count","sourceId":"s","agg":"count"}]},
    {"type":"bar","title":"Chart","sourceId":"s","x":"name","y":"value"},
    {"type":"table","title":"Details","sourceId":"s","columns":[{"key":"name","label":"Name"},{"key":"value","label":"Value","format":"number"}]}
  ]
}
Rules:
1. Use kind:"local" for user-owned data such as tasks, notes, sessions, or streak. Available local datasets: ddls, notes, sessions, streak.
2. Use kind:"http" only for public APIs you are confident exist.
3. If unsure, use kind:"static" with realistic sample rows.
4. Keep field names consistent across sources and blocks.
5. Generate 3-5 blocks.`;

export async function GeneratePanel(input: GeneratePanelInput) {
  const prompt = ClampText((input.prompt || "").trim(), InputLimits.maxPromptChars);
  if (!prompt) return { ok: false, status: 400, error: "Missing prompt." };

  const first = await GeneratePanelOnce(BuildUserContent(prompt, input));
  if (!first.ok || !first.spec) return first;

  const spec = first.spec;
  const shouldProbe = input.probe !== false && !input.currentSpec;
  if (!shouldProbe) return { ok: true, status: 200, spec };

  const samples = await ProbePanelSources(spec);
  if (Object.keys(samples).length === 0) return { ok: true, status: 200, spec };

  const secondPrompt = [
    "Fix field bindings in this dashboard JSON using the response samples.",
    "Keep the same structure where possible. Return complete JSON only.",
    `Dashboard JSON: ${JSON.stringify(spec)}`,
    `Samples: ${ClampText(JSON.stringify(samples), 6000)}`,
  ].join("\n\n");

  const second = await GeneratePanelOnce(secondPrompt);
  if (!second.ok) return { ok: true, status: 200, spec, probed: false };

  return { ok: true, status: 200, spec: second.spec, probed: true };
}

async function GeneratePanelOnce(userContent: string) {
  const client = GetDeepSeekClient();
  const completion = await client.chat.completions.create({
    model: GetDeepSeekModel(),
    messages: [
      { role: "system", content: PanelSystem },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2600,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = ReadJsonObject(raw);
  if (!parsed.ok) return { ok: false, status: 200, error: parsed.error, raw };

  const spec = NormalizePanelSpec(parsed.data);
  if (!spec) return { ok: false, status: 200, error: "Generated panel spec is invalid.", raw };

  return { ok: true, status: 200, spec };
}

function BuildUserContent(prompt: string, input: GeneratePanelInput) {
  if (!input.currentSpec || typeof input.currentSpec !== "object") return prompt;

  if (input.fixError) {
    return [
      `Existing dashboard JSON: ${JSON.stringify(input.currentSpec)}`,
      `A data source failed with this error: ${input.fixError}`,
      "Fix only the necessary source, path, and field bindings.",
    ].join("\n\n");
  }

  return [
    `Existing dashboard JSON: ${JSON.stringify(input.currentSpec)}`,
    `Change request: ${prompt}`,
    "Change only what is necessary.",
  ].join("\n\n");
}

function NormalizePanelSpec(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;

  const spec = raw as Record<string, unknown>;
  if (!Array.isArray(spec.sources) || !Array.isArray(spec.blocks)) return null;

  return {
    version: 1,
    title: String(spec.title || "Panel").slice(0, 32),
    emoji: typeof spec.emoji === "string" ? spec.emoji.slice(0, 4) : "📊",
    description: typeof spec.description === "string" ? spec.description : "",
    sources: spec.sources.map(NormalizeSource).filter(Boolean),
    blocks: spec.blocks,
  };
}

function NormalizeSource(source: unknown) {
  if (!source || typeof source !== "object") return null;

  const next = { ...(source as Record<string, unknown>) };
  if (!next.id) next.id = "s";
  if (next.kind !== "static" && next.kind !== "http" && next.kind !== "local") {
    next.kind = next.url ? "http" : "static";
  }

  if (next.kind === "http" && !next.url) return null;
  if (next.kind === "http" && !next.method) next.method = "GET";
  if (next.kind === "static" && !Array.isArray(next.data)) next.data = [];

  return next;
}

async function ProbePanelSources(spec: { sources: unknown[] }) {
  const samples: Record<string, unknown> = {};
  const sources = spec.sources
    .filter((source): source is Record<string, unknown> => Boolean(source && typeof source === "object"))
    .filter((source) => source.kind === "http" && typeof source.url === "string")
    .slice(0, MaxProbes);

  await Promise.all(
    sources.map(async (source) => {
      const outcome = await ProxyFetch({
        url: String(source.url),
        method: ReadHttpMethod(source.method),
        headers: ReadRecord(source.headers),
        query: ReadQuery(source.query),
      });

      if (!outcome.body.ok) return;

      let data = GetByPath(outcome.body.data, typeof source.path === "string" ? source.path : undefined);
      const first = Array.isArray(data) ? data[0] : data;
      if (first && typeof first === "object") {
        samples[String(source.id)] = first;
      }
    }),
  );

  return samples;
}

function ReadHttpMethod(value: unknown) {
  if (value === "POST" || value === "PUT" || value === "DELETE" || value === "PATCH") return value;
  return "GET";
}

function ReadRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string>;
}

function ReadQuery(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string | number>;
}
