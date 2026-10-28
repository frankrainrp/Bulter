// ============================================================
// app/api/research/squad/route.ts — 多小队调研：单小队调查（P3）
//
// { goal, squadTitle, question } → { summary(md), rows?[], columns?[], chart? }
// 基于模型知识合成结构化发现；客户端并行 fan-out 多个本路由。
// 无联网检索 → 数据为「知识合成」，注明仅供参考；真实数据走 P4 连接器。
// ============================================================

import { OpenAI } from "openai";
import { clampText, INPUT_LIMITS, rateLimited, safeError } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `你是调研小队，负责目标下的一个子问题。基于你的知识产出**结构化发现**。只输出 JSON，不要解释或 markdown 围栏。
结构：{
  "summary": "3-5 条 markdown 要点(用 - 开头)，简明扼要",
  "rows": [ {对象...}, ... ],          // 可选：该子问题的结构化数据(公司/指标榜单等)，5-12 行，字段名用英文 key
  "columns": [ {"key":"字段","label":"列名","format":"number|currency|percent|text"} ],  // 可选：rows 的列定义，与 rows 字段对应
  "chart": { "type":"bar|line|pie", "x":"标签字段", "y":"数值字段" }   // 可选：若 rows 有可对比的数值字段
}
要求：
1. 有可量化对比的就给 rows + columns（让面板有表格/图表）；纯定性的可只给 summary。
2. rows 字段名(英文)要和 columns.key、chart.x/y 完全一致。
3. 数据是知识合成、非实时，summary 里点明「数据为示意，建议接真实源核实」。
4. 控制体量：rows ≤ 12 行。`;

export async function POST(req: Request) {
  const limited = rateLimited(req, 30); // SEC-05：客户端并行 fan-out 多小队，限额放宽到 30/10s
  if (limited) return limited;
  let body: { goal?: string; squadTitle?: string; question?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "请求体非法" }, { status: 400 }); }
  const goal = clampText((body?.goal ?? "").trim(), INPUT_LIMITS.maxPromptChars);
  const squadTitle = clampText((body?.squadTitle ?? "").trim(), 200);
  const question = clampText((body?.question ?? "").trim(), INPUT_LIMITS.maxPromptChars);
  if (!question) return Response.json({ ok: false, error: "缺少 question" }, { status: 400 });
  if (!process.env.DEEPSEEK_API_KEY) return Response.json({ ok: false, error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 });

  const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
  try {
    const c = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `总目标：${goal}\n本小队「${squadTitle}」负责：${question}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1400,
      temperature: 0.5,
    });
    const raw = c.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return Response.json({ ok: false, error: "squad 非合法 JSON", raw }, { status: 200 }); }
    const f = parsed as { summary?: unknown; rows?: unknown; columns?: unknown; chart?: unknown };
    return Response.json({
      ok: true,
      finding: {
        summary: typeof f.summary === "string" ? f.summary : "",
        rows: Array.isArray(f.rows) ? f.rows.slice(0, 12) : undefined,
        columns: Array.isArray(f.columns) ? f.columns : undefined,
        chart: f.chart && typeof f.chart === "object" ? f.chart : undefined,
      },
      usage: c.usage,
    });
  } catch (err) {
    return Response.json({ ok: false, error: safeError(err, "小队调研失败，请稍后重试") }, { status: 200 });
  }
}
