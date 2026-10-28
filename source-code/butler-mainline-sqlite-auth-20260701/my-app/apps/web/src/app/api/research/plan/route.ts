// ============================================================
// app/api/research/plan/route.ts — 多小队调研：拆解阶段（P3）
//
// goal → { title, emoji, squads:[{title, question}] }（3-4 个聚焦子调查）。
// 客户端拿到 plan 后并行 fan-out 各 squad。
// ============================================================

import { OpenAI } from "openai";
import { clampText, INPUT_LIMITS, rateLimited, safeError } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `你是调研负责人。把用户的复杂调研目标拆成 3-4 个**互补、可并行**的子调查小队。只输出 JSON，不要解释。
结构：{"title":"面板标题(≤16字)","emoji":"单个emoji","squads":[{"title":"小队名(≤10字)","question":"该小队要回答的具体问题(一句话)"}]}
要求：
1. 小队之间分工不重叠，合起来覆盖目标全貌。
2. question 要具体、可产出结构化数据（榜单/对比/分项），别太空泛。
3. 数量 3-4 个，宁精勿多（省算力）。
示例 goal「半导体潜力股产业链分析」→
{"title":"半导体潜力股","emoji":"💹","squads":[{"title":"上游材料","question":"半导体上游(硅片/光刻胶/电子特气)有哪些代表公司及其潜力评级?"},{"title":"中游制造","question":"晶圆代工/封测环节代表公司、产能与成长性如何?"},{"title":"下游应用","question":"AI芯片/汽车电子等下游需求最强的公司及驱动因素?"},{"title":"风险面","question":"该产业链主要风险(地缘/周期/技术替代)有哪些?"}]}`;

export async function POST(req: Request) {
  const limited = rateLimited(req); // SEC-05
  if (limited) return limited;
  let goal = "";
  try { goal = clampText(((await req.json())?.goal ?? "").trim(), INPUT_LIMITS.maxPromptChars); } catch { /* */ }
  if (!goal) return Response.json({ ok: false, error: "缺少 goal" }, { status: 400 });
  if (!process.env.DEEPSEEK_API_KEY) return Response.json({ ok: false, error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 });

  const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  try {
    const c = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: goal }],
      response_format: { type: "json_object" },
      max_tokens: 900,
      temperature: 0.5,
    });
    const raw = c.choices[0]?.message?.content ?? "";
    let parsed: { title?: string; emoji?: string; squads?: { title?: string; question?: string }[] };
    try { parsed = JSON.parse(raw); } catch { return Response.json({ ok: false, error: "plan 非合法 JSON", raw }, { status: 200 }); }
    const squads = (parsed.squads ?? [])
      .filter((s) => s && s.title && s.question)
      .slice(0, 4)
      .map((s) => ({ title: String(s.title).slice(0, 16), question: String(s.question) }));
    if (squads.length === 0) return Response.json({ ok: false, error: "未拆出有效小队", raw }, { status: 200 });
    return Response.json({
      ok: true,
      plan: { title: (parsed.title || goal).slice(0, 20), emoji: parsed.emoji || "🔬", squads },
      usage: c.usage,
    });
  } catch (err) {
    return Response.json({ ok: false, error: safeError(err, "调研拆解失败，请稍后重试") }, { status: 200 });
  }
}
