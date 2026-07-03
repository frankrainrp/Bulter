import { ClampText, GetDeepSeekClient, GetDeepSeekModel, InputLimits, ReadJsonObject } from "./AiService.js";

const PlanSystem = `You are a research lead. Split the user's complex research goal into 3-4 complementary squads. Return only JSON.
Shape: {"title":"short title","emoji":"one emoji","squads":[{"title":"short squad name","question":"specific question"}]}`;

const SquadSystem = `You are a research squad. Answer one sub-question with structured findings. Return only JSON.
Shape: {"summary":"3-5 markdown bullets","rows":[{"name":"..."}],"columns":[{"key":"name","label":"Name","format":"text"}],"chart":{"type":"bar","x":"name","y":"score"}}.
If data is estimated or knowledge-based, say it should be verified with real sources.`;

export async function MakeResearchPlan(goalInput: string) {
  const goal = ClampText(goalInput.trim(), InputLimits.maxPromptChars);
  if (!goal) return { ok: false, status: 400, error: "Missing goal." };

  const client = GetDeepSeekClient();
  const completion = await client.chat.completions.create({
    model: GetDeepSeekModel(),
    messages: [
      { role: "system", content: PlanSystem },
      { role: "user", content: goal },
    ],
    response_format: { type: "json_object" },
    max_tokens: 900,
    temperature: 0.5,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = ReadJsonObject(raw);
  if (!parsed.ok) return { ok: false, status: 200, error: parsed.error, raw };

  const data = parsed.data as { title?: string; emoji?: string; squads?: { title?: string; question?: string }[] };
  const squads = (data.squads || [])
    .filter((squad) => squad?.title && squad?.question)
    .slice(0, 4)
    .map((squad) => ({
      title: String(squad.title).slice(0, 16),
      question: String(squad.question),
    }));

  if (squads.length === 0) return { ok: false, status: 200, error: "No valid squads were generated.", raw };

  return {
    ok: true,
    status: 200,
    plan: {
      title: String(data.title || goal).slice(0, 20),
      emoji: data.emoji || "🔬",
      squads,
    },
    usage: completion.usage,
  };
}

export async function MakeSquadFinding(input: { goal?: string; squadTitle?: string; question?: string }) {
  const goal = ClampText((input.goal || "").trim(), InputLimits.maxPromptChars);
  const squadTitle = ClampText((input.squadTitle || "").trim(), 200);
  const question = ClampText((input.question || "").trim(), InputLimits.maxPromptChars);
  if (!question) return { ok: false, status: 400, error: "Missing question." };

  const client = GetDeepSeekClient();
  const completion = await client.chat.completions.create({
    model: GetDeepSeekModel(),
    messages: [
      { role: "system", content: SquadSystem },
      { role: "user", content: `Goal: ${goal}\nSquad: ${squadTitle}\nQuestion: ${question}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1400,
    temperature: 0.5,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = ReadJsonObject(raw);
  if (!parsed.ok) return { ok: false, status: 200, error: parsed.error, raw };

  const data = parsed.data as { summary?: unknown; rows?: unknown; columns?: unknown; chart?: unknown };
  return {
    ok: true,
    status: 200,
    finding: {
      summary: typeof data.summary === "string" ? data.summary : "",
      rows: Array.isArray(data.rows) ? data.rows.slice(0, 12) : undefined,
      columns: Array.isArray(data.columns) ? data.columns : undefined,
      chart: data.chart && typeof data.chart === "object" ? data.chart : undefined,
    },
    usage: completion.usage,
  };
}

