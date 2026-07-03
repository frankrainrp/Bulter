// ============================================================
// lib/semantic-filter.ts — 客户端语义粗筛
//
// 走 CDN ESM 加载 transformers.js，完全绕过 webpack 打包。
// 一次性下载 ~22MB MiniLM 模型缓存到 IndexedDB，永久离线。
// ============================================================

const CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2";
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const SEED_QUERIES = [
  "Assignment deadline due date submit",
  "Final exam quiz test date and time",
  "Weekly schedule week N lesson plan",
  "Continuous assessment CA midterm grade percentage",
  "Project presentation group work submission",
  "Course assignment deadline submission final exam midterm quiz",
];

// transformers.js 全局接口（CDN 注入到 window）
interface TransformersGlobal {
  pipeline: (task: string, model: string, opts?: { device?: string }) => Promise<TransformersPipeline>;
}
interface TransformersPipeline {
  (input: string, opts?: { pooling?: string; normalize?: boolean }): Promise<{ data: Float32Array }>;
}

let tfPromise: Promise<TransformersGlobal> | null = null;
let embedderPromise: Promise<TransformersPipeline> | null = null;
let seedVectorPromise: Promise<Float32Array> | null = null;

// ---- CDN 动态加载（用 new Function 包裹 import 绕开 webpack 静态分析） ----
async function loadTransformers(): Promise<TransformersGlobal> {
  if (tfPromise) return tfPromise;
  if (typeof window === "undefined") throw new Error("semantic-filter only runs in the browser");

  tfPromise = (async () => {
    // webpack 看到 `import("...")` 会尝试打包，用 Function 构造器隐藏意图
    const dynImport = new Function("u", "return import(u)") as (u: string) => Promise<{
      pipeline: TransformersGlobal["pipeline"];
      env: { allowLocalModels: boolean; useBrowserCache: boolean };
    }>;
    const m = await dynImport(CDN_URL);
    m.env.allowLocalModels = false;
    m.env.useBrowserCache = true;
    return { pipeline: m.pipeline };
  })();
  return tfPromise;
}

async function getEmbedder(): Promise<TransformersPipeline> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const tf = await loadTransformers();
      try {
        return await tf.pipeline("feature-extraction", MODEL_ID, { device: "webgpu" });
      } catch {
        return await tf.pipeline("feature-extraction", MODEL_ID, { device: "wasm" });
      }
    })();
  }
  return embedderPromise;
}

async function embedOne(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return out.data;
}

async function getSeedCentroid(): Promise<Float32Array> {
  if (!seedVectorPromise) {
    seedVectorPromise = (async () => {
      const vecs = await Promise.all(SEED_QUERIES.map(embedOne));
      const dim = vecs[0].length;
      const sum = new Float32Array(dim);
      for (const v of vecs) for (let i = 0; i < dim; i++) sum[i] += v[i];
      let norm = 0;
      for (let i = 0; i < dim; i++) { sum[i] /= vecs.length; norm += sum[i] * sum[i]; }
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < dim; i++) sum[i] /= norm;
      return sum;
    })();
  }
  return seedVectorPromise;
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---- 公开 API ----
export async function filterBySemantic(
  text: string,
  opts: { topK?: number; minSim?: number; maxParagraphs?: number } = {},
): Promise<{ text: string; kept: number; total: number; topSim: number }> {
  const { topK = 30, minSim = 0.15, maxParagraphs = 200 } = opts;

  // 多策略切分：句号 / 分号 / 项目符号 / 长空白 / 换行
  // PDF 文本经常整段无换行，要更激进
  let chunks = text
    .split(/[.!?。！？；;]\s+|\n+|\s{2,}|•\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15);

  // 兜底：若分段仍 < 5 段（极端整段文本），按 ~180 字滑窗切
  if (chunks.length < 5) {
    chunks = [];
    const W = 180;
    for (let i = 0; i < text.length; i += W) {
      const slice = text.slice(i, i + W).trim();
      if (slice.length > 30) chunks.push(slice);
    }
  }
  if (chunks.length === 0) return { text, kept: 0, total: 0, topSim: 0 };

  const capped = chunks.slice(0, maxParagraphs);
  const seed = await getSeedCentroid();
  const scored: Array<{ p: string; s: number; idx: number }> = [];
  for (let i = 0; i < capped.length; i++) {
    const v = await embedOne(capped[i]);
    scored.push({ p: capped[i], s: cosineSim(v, seed), idx: i });
  }
  scored.sort((a, b) => b.s - a.s);
  const kept = scored.filter((x) => x.s >= minSim).slice(0, topK);
  kept.sort((a, b) => a.idx - b.idx);
  return {
    text: kept.map((x) => x.p).join("\n\n"),
    kept: kept.length,
    total: capped.length,
    topSim: scored[0]?.s ?? 0,
  };
}

export async function preloadSemanticModel(): Promise<void> {
  await getEmbedder();
  await getSeedCentroid();
}
