// ============================================================
// app/api/generate-panel/route.ts — AI 一句话 → 面板 schema（P2）
//
// DeepSeek V4 Flash + JSON 输出模式：把用户自然语言需求 → GeneratedPanelSpec。
// 服务端 validateSpec 校验后回传；非法则带 raw 让前端兜底报错。
//
// 设计要点（省 token + 高可用）：
//   - 紧凑 schema 文档 + 1 个示例，避免长 prompt
//   - 真实公共免 key API 优先用 http；不确定就用 static 样本数据，保证面板一定渲染
// ============================================================

import { OpenAI } from "openai";
import { validateSpec } from "@/lib/panel-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateRequest {
  prompt: string;
}

const SYSTEM_PROMPT = `你是「面板应用」生成器。把用户需求转成一个 JSON 面板规格（GeneratedPanelSpec），只输出 JSON，不要任何解释或 markdown 围栏。

## 结构
{
  "version": 1,
  "title": "面板标题(≤16字)",
  "emoji": "单个emoji",
  "description": "一句话说明(可选)",
  "sources": [ DataSource ... ],
  "blocks": [ Block ... ]
}

## DataSource（数据源）
- { "id":"x", "kind":"http", "url":"https://...", "method":"GET", "query":{...}, "path":"data.items", "refreshMs":60000 }
  path = 响应里指向目标数组的点路径(响应本身就是数组则省略)。refreshMs 可选(≥5000)。
- { "id":"x", "kind":"static", "data":[ {...}, {...} ] }  // 内联样本数据(对象数组)

## Block（组件块，按序竖排；span:1 半宽 / 2 整宽，默认2）
- { "type":"kpiGrid", "title":"", "metrics":[ {"label":"","sourceId":"x","agg":"count|sum|avg|max|min","field":"字段","format":"number|currency|percent"} ] }
- { "type":"stat", "title":"", "sourceId":"x", "agg":"sum", "field":"f", "format":"currency" }  // 单大数字
- { "type":"table", "title":"", "sourceId":"x", "columns":[ {"key":"f","label":"列名","format":"currency|percent|number|text"} ], "limit":10 }
- { "type":"bar"|"line"|"pie", "title":"", "sourceId":"x", "x":"标签字段", "y":"数值字段", "limit":10 }
- { "type":"list", "title":"", "sourceId":"x", "primary":"主字段", "secondary":"副字段", "limit":8 }
- { "type":"markdown", "title":"", "markdown":"**说明** 文本" }

## 规则
1. 你确信存在的「公共、无需密钥」API（如 CoinGecko coins/markets、Frankfurter 汇率、Hacker News、GitHub 公共 REST）才用 kind:http，url/query 要准确。
2. 不确定是否有免密钥 API（如 Twitch 收益、券商行情、私有数据）→ 用 kind:static 造 8-15 行真实感样本数据，并在 description 注明「示例数据，可后续接真实 API」。
3. 字段名必须和数据里的 key 完全一致。金额用 currency，百分比用 percent。
4. 3-5 个块，先 kpiGrid/stat 概览，再图表，再 table/list 明细。id 用短英文。
5. 只输出 JSON 对象本身。`;

const EXAMPLE = `示例：用户「东南亚 Twitch 收益榜」→
{"version":1,"title":"东南亚 Twitch Top","emoji":"🎮","description":"示例数据，可后续接真实 Twitch API","sources":[{"id":"s","kind":"static","data":[{"rank":1,"streamer":"AdminTH","country":"TH","followers":2100000,"monthly_usd":48000},{"rank":2,"streamer":"Jess No Limit","country":"ID","followers":1800000,"monthly_usd":42000},{"rank":3,"streamer":"Wowkia","country":"ID","followers":900000,"monthly_usd":21000}]}],"blocks":[{"type":"kpiGrid","title":"概览","metrics":[{"label":"主播数","sourceId":"s","agg":"count"},{"label":"月收益合计","sourceId":"s","agg":"sum","field":"monthly_usd","format":"currency"}]},{"type":"bar","title":"月收益(USD)","sourceId":"s","x":"streamer","y":"monthly_usd","span":2},{"type":"table","title":"榜单","sourceId":"s","columns":[{"key":"rank","label":"#"},{"key":"streamer","label":"主播"},{"key":"country","label":"国家"},{"key":"followers","label":"粉丝","format":"number"},{"key":"monthly_usd","label":"月收益","format":"currency"}]}]}`;

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return Response.json({ ok: false, error: "请求体非法" }, { status: 400 });
  }
  const prompt = (body?.prompt ?? "").trim();
  if (!prompt) return Response.json({ ok: false, error: "缺少 prompt" }, { status: 400 });

  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json({ ok: false, error: "未配置 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + EXAMPLE },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2600,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ ok: false, error: "AI 输出不是合法 JSON", raw }, { status: 200 });
    }
    const v = validateSpec(parsed);
    if (v.ok !== true) {
      return Response.json({ ok: false, error: "生成的 schema 不合法：" + v.error, raw }, { status: 200 });
    }
    return Response.json({ ok: true, spec: v.spec, usage: completion.usage });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }
}
