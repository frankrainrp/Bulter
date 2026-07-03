"use client";

// ============================================================
// components/GeneratedPanelView.tsx — 声明式「面板应用」渲染器（P1）
//
// 输入一份 GeneratedPanelSpec：
//   1. 并行取所有数据源（fetchSource：static / http 经连接器代理）
//   2. 按 source.refreshMs 自动刷新
//   3. 顺序渲染 blocks（stat/kpiGrid/table/bar/line/pie/list/markdown）
//   4. 「</> schema」开关：JSON 编辑器，apply 时 parseSpec 校验 → onChange
//
// 无任意代码执行；全部块从 schema 声明渲染。
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Code2, Eye, AlertTriangle, Loader2, Check, X, Sparkles, ArrowUp, Users, Zap, Plug, Wand2 } from "lucide-react";
import { generatePanelSpec } from "@/lib/panel-generator";
import { runResearch, type ResearchProgress } from "@/lib/research-client";
import { creditCostOf, canAfford, spendCredits, requestCreditsWall } from "@/lib/credits";
import DataSourceBuilder from "./DataSourceBuilder";
import {
  type GeneratedPanelSpec,
  type Block,
  type DataSource,
  type TableColumn,
  parseSpec,
  asArray,
  aggregate,
  toSeries,
  formatValue,
  getByPath,
} from "@/lib/panel-schema";
import { fetchSource, type SourceResult } from "@/lib/connector-client";
import { useT, type TFunc } from "@/lib/i18n";
import { PieChart, BarChart, LineChart } from "./panel-modules/Charts";

interface Props {
  spec: GeneratedPanelSpec;
  /** schema 编辑保存（接入 CustomPanel 持久化）*/
  onChange?: (spec: GeneratedPanelSpec) => void;
}

type SourceState = { loading: boolean; result?: SourceResult };

export default function GeneratedPanelView({ spec, onChange }: Props) {
  const { t } = useT();
  const [states, setStates] = useState<Record<string, SourceState>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // P2 AI 组合器
  const [composerOpen, setComposerOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  // P3 深度调研（多小队并行）
  const [deepMode, setDeepMode] = useState(false);
  const [research, setResearch] = useState<ResearchProgress | null>(null);
  // P4 数据源构建器（动态按需）
  const [builderOpen, setBuilderOpen] = useState(false);
  // A1.3 改进模式：composer 的生成在「现有 spec」上修改而非从零
  const [refineMode, setRefineMode] = useState(false);
  // A1.3 自修复：正在修哪个源（按钮 loading）
  const [repairingId, setRepairingId] = useState<string | null>(null);

  // 取单个数据源
  const loadSource = useCallback(async (source: DataSource, signal: AbortSignal) => {
    setStates((s) => ({ ...s, [source.id]: { loading: true, result: s[source.id]?.result } }));
    const result = await fetchSource(source, signal);
    if (signal.aborted) return;
    setStates((s) => ({ ...s, [source.id]: { loading: false, result } }));
  }, []);

  // 取全部 + 设置自动刷新
  const loadAll = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    spec.sources.forEach((src) => loadSource(src, controller.signal));
  }, [spec.sources, loadSource]);

  useEffect(() => {
    loadAll();
    // 自动刷新计时器（每个有 refreshMs 的源）
    const timers: ReturnType<typeof setInterval>[] = [];
    for (const src of spec.sources) {
      if (src.refreshMs && src.refreshMs >= 5000) {
        const controller = new AbortController();
        timers.push(setInterval(() => loadSource(src, controller.signal), src.refreshMs));
      }
    }
    return () => {
      abortRef.current?.abort();
      timers.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const openEditor = () => {
    setDraft(JSON.stringify(spec, null, 2));
    setDraftErr(null);
    setEditing(true);
  };
  const applyDraft = () => {
    const r = parseSpec(draft);
    if (r.ok === true) {
      setDraftErr(null);
      setEditing(false);
      onChange?.(r.spec);
    } else {
      setDraftErr(r.error);
    }
  };

  // 一句话 → 面板：快速生成(P2 单次) 或 深度调研(P3 多小队并行)
  const runGenerate = useCallback(async () => {
    const text = promptText.trim();
    if (!text || generating) return;
    // P5′ 积分预检：生成 2 分 / 深度调研 10 分，不足弹 softwall（page 监听 CREDITS_WALL_EVENT）
    const cost = creditCostOf(deepMode ? "research" : "generatePanel");
    if (!canAfford(cost)) {
      requestCreditsWall(cost);
      return;
    }
    setGenerating(true);
    setGenError(null);
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;

    if (deepMode) {
      setResearch({ phase: "planning", squads: [] });
      const r = await runResearch(text, setResearch, controller.signal);
      if (controller.signal.aborted) return;
      setGenerating(false);
      if (r.ok === true) {
        spendCredits(cost, "research"); // 成功才扣，失败不计费
        setComposerOpen(false);
        setResearch(null);
        setEditing(false);
        onChange?.(r.spec);
      } else {
        setGenError(r.error);
      }
      return;
    }

    // A1.3 改进模式：带现有 spec 让 AI 增量修改
    const r = await generatePanelSpec(text, controller.signal, refineMode ? { currentSpec: spec } : undefined);
    if (controller.signal.aborted) return;
    setGenerating(false);
    if (r.ok === true) {
      spendCredits(cost, "generatePanel"); // 成功才扣，失败不计费
      setComposerOpen(false);
      setRefineMode(false);
      setEditing(false);
      onChange?.(r.spec);
    } else {
      setGenError(r.error);
    }
  }, [promptText, generating, deepMode, refineMode, spec, onChange]);

  // A1.3 自修复：把某数据源的报错回喂 AI 修正配置（生成面板计 2 分，成功才扣）
  const repairSource = useCallback(async (sourceId: string, error: string) => {
    if (repairingId) return;
    const cost = creditCostOf("generatePanel");
    if (!canAfford(cost)) { requestCreditsWall(cost); return; }
    setRepairingId(sourceId);
    const controller = new AbortController();
    const r = await generatePanelSpec("Fix data source", controller.signal, { currentSpec: spec, fixError: error });
    setRepairingId(null);
    if (r.ok === true) {
      spendCredits(cost, "generatePanel");
      onChange?.(r.spec);
    } else {
      setGenError(r.error);
    }
  }, [repairingId, spec, onChange]);

  // P4：插入动态配置的数据源 + 块到当前 spec
  const handleInsertSource = useCallback((source: GeneratedPanelSpec["sources"][number], blocks: GeneratedPanelSpec["blocks"]) => {
    onChange?.({
      ...spec,
      sources: [...spec.sources, source],
      blocks: [...spec.blocks, ...blocks],
    });
  }, [spec, onChange]);

  // P4：全局刷新间隔（写所有 http 源的 refreshMs）
  const currentRefresh = spec.sources.find((s) => s.kind === "http")?.refreshMs ?? 0;
  const setRefreshAll = useCallback((ms: number) => {
    onChange?.({
      ...spec,
      sources: spec.sources.map((s) => (s.kind === "http" ? { ...s, refreshMs: ms || undefined } : s)),
    });
  }, [spec, onChange]);
  const hasHttp = spec.sources.some((s) => s.kind === "http");

  const anyLoading = Object.values(states).some((s) => s.loading);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 工具条 */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", flexShrink: 0,
          borderBottom: "1px solid var(--color-border-soft)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 16 }}>{spec.emoji ?? "🧩"}</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {spec.title}
            </h2>
          </div>
          {spec.description && (
            <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "3px 0 0", lineHeight: 1.4 }}>
              {spec.description}
            </p>
          )}
        </div>
        <button
          onClick={() => { setComposerOpen((v) => !v); setGenError(null); }}
          title={t("gp.aiGen")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
            height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12.5, fontWeight: 600,
            border: "none",
            background: composerOpen ? "var(--color-primary)" : "linear-gradient(150deg, var(--color-primary-hover), var(--color-primary))",
            color: "#fff",
          }}
        >
          <Sparkles size={13} /> {t("gp.aiGenBtn")}
        </button>
        {/* A1.3 改进当前面板（对话式迭代）*/}
        <button
          onClick={() => { setRefineMode(true); setComposerOpen(true); setGenError(null); }}
          title={t("gp.refineTitle")}
          aria-label={t("gp.refineTitle")}
          style={iconBtn}
        >
          <Wand2 size={14} />
        </button>
        <button
          onClick={() => setBuilderOpen(true)}
          title={t("gp.addSource")}
          aria-label={t("gp.addSourceAria")}
          style={iconBtn}
        >
          <Plug size={14} />
        </button>
        {/* 定时刷新间隔（有 http 源时显示）*/}
        {hasHttp && (
          <select
            value={currentRefresh}
            onChange={(e) => setRefreshAll(Number(e.target.value))}
            title={t("gp.refreshTitle")}
            aria-label={t("gp.refreshTitle")}
            style={{
              height: 32, borderRadius: 8, flexShrink: 0, cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-bg)",
              color: "var(--color-text-muted)", fontSize: 12, fontFamily: "inherit", padding: "0 6px",
            }}
          >
            <option value={0}>{t("gp.refresh.off")}</option>
            <option value={30000}>{t("gp.refresh.30s")}</option>
            <option value={60000}>{t("gp.refresh.1m")}</option>
            <option value={300000}>{t("gp.refresh.5m")}</option>
          </select>
        )}
        <button
          onClick={loadAll}
          title={t("gp.refreshData")}
          aria-label={t("gp.refreshData")}
          style={iconBtn}
        >
          <RefreshCw size={14} style={anyLoading ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
        <button
          onClick={editing ? () => setEditing(false) : openEditor}
          title={editing ? t("gp.backPreview") : t("gp.editSchema")}
          style={{ ...iconBtn, ...(editing ? { background: "var(--color-primary-soft)", color: "var(--color-primary)" } : null) }}
        >
          {editing ? <Eye size={14} /> : <Code2 size={14} />}
        </button>
      </div>

      {/* P4 数据源构建器（动态按需，非写死目录）*/}
      <DataSourceBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} onInsert={handleInsertSource} />

      {/* P2 AI 组合器（一句话 → 生成面板）*/}
      {composerOpen && (
        <PanelComposer
          value={promptText}
          onChange={setPromptText}
          generating={generating}
          error={genError}
          deepMode={deepMode}
          onToggleDeep={() => setDeepMode((v) => !v)}
          research={research}
          refineMode={refineMode}
          onGenerate={runGenerate}
          onClose={() => { setComposerOpen(false); setRefineMode(false); setResearch(null); }}
        />
      )}

      {editing ? (
        <SchemaEditor draft={draft} setDraft={setDraft} err={draftErr} onApply={applyDraft} onCancel={() => setEditing(false)} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", minHeight: 0 }}>
          <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            {spec.blocks.map((block) => (
              <BlockCard key={block.id} block={block} states={states} onRepair={repairSource} repairingId={repairingId} />
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// 单个块卡片
// ============================================================
/** 从 states 取某数据源已解析的数据（ok 时返回 data，否则 undefined）*/
function resolveData(states: Record<string, SourceState>, sourceId?: string): unknown {
  if (!sourceId) return undefined;
  const r = states[sourceId]?.result;
  return r && r.ok === true ? r.data : undefined;
}

function BlockCard({ block, states, onRepair, repairingId }: {
  block: Block;
  states: Record<string, SourceState>;
  onRepair?: (sourceId: string, error: string) => void;
  repairingId?: string | null;
}) {
  const fullWidth = (block.span ?? 2) === 2;
  const needsData = block.type !== "markdown" && block.type !== "kpiGrid";
  // 主数据源：块级 sourceId（kpiGrid 用各 metric 自己的 sourceId，不靠块级）
  const state = block.sourceId ? states[block.sourceId] : undefined;

  let body: React.ReactNode;
  if (needsData && state?.loading && !state.result) {
    body = <Skeleton />;
  } else if (needsData && state?.result && state.result.ok === false) {
    body = (
      <ErrorHint
        msg={state.result.error}
        onRepair={block.sourceId && onRepair ? () => onRepair(block.sourceId!, state.result!.ok === false ? state.result!.error : "") : undefined}
        repairing={repairingId === block.sourceId}
      />
    );
  } else {
    body = <BlockBody block={block} data={resolveData(states, block.sourceId)} states={states} />;
  }

  return (
    <section
      style={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      {block.title && (
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", margin: "0 0 10px", letterSpacing: 0.3 }}>
          {block.title}
        </h3>
      )}
      {body}
    </section>
  );
}

function BlockBody({ block, data, states }: { block: Block; data: unknown; states: Record<string, SourceState> }) {
  const { t } = useT();
  const rows = asArray(data);
  switch (block.type) {
    case "markdown":
      return (
        <div className="md-body" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text)" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.markdown ?? ""}</ReactMarkdown>
        </div>
      );

    case "stat": {
      const n = block.value != null ? block.value : aggregate(rows, block.agg ?? "count", block.field);
      return (
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            {formatValue(n, block.format ?? "number")}
          </div>
        </div>
      );
    }

    case "kpiGrid": {
      const metrics = block.metrics ?? [];
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(metrics.length || 1, 3)}, 1fr)`, gap: 10 }}>
          {metrics.map((m, i) => {
            // 每个指标用自己的 sourceId（回退块级 data）
            const mRows = m.sourceId ? asArray(resolveData(states, m.sourceId)) : rows;
            const n = m.value != null ? m.value : aggregate(mRows, m.agg ?? "count", m.field);
            return (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--color-bg)", border: "1px solid var(--color-border-soft)" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.3px" }}>
                  {formatValue(n, m.format ?? "number")}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      );
    }

    case "bar":
      return <BarChart data={toSeries(rows, block.x, block.y, block.limit)} />;
    case "line":
      return <LineChart data={toSeries(rows, block.x, block.y, block.limit)} />;
    case "pie":
      return <PieChart data={toSeries(rows, block.x, block.y, block.limit)} />;

    case "list": {
      const capped = block.limit ? rows.slice(0, block.limit) : rows;
      if (capped.length === 0) return <EmptyHint />;
      return (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {capped.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i === capped.length - 1 ? "none" : "1px solid var(--color-border-soft)" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-faint)", width: 18, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.primary ? String(getByPath(r, block.primary) ?? "") : JSON.stringify(r)}
              </span>
              {block.secondary && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", flexShrink: 0 }}>
                  {String(getByPath(r, block.secondary) ?? "")}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "table": {
      const cols = block.columns ?? inferColumns(rows);
      const capped = block.limit ? rows.slice(0, block.limit) : rows;
      if (capped.length === 0) return <EmptyHint />;
      return (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capped.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => {
                    const raw = getByPath(r, c.key);
                    const pctNeg = c.format === "percent" && Number(raw) < 0;
                    const pctPos = c.format === "percent" && Number(raw) > 0;
                    return (
                      <td key={c.key} style={{ padding: "6px 10px", borderBottom: "1px solid var(--color-border-soft)", color: pctNeg ? "var(--color-danger)" : pctPos ? "var(--color-success)" : "var(--color-text)", whiteSpace: "nowrap" }}>
                        {formatValue(raw, c.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default:
      return <ErrorHint msg={t("gp.unknownBlock", { type: block.type })} />;
  }
}

function inferColumns(rows: Record<string, unknown>[]): TableColumn[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).slice(0, 6).map((k) => ({ key: k, label: k }));
}

// ============================================================
// P2 AI 组合器：一句话 → 生成面板
// ============================================================
const EXAMPLE_PROMPT_KEYS = ["gp.exQuick.1", "gp.exQuick.2", "gp.exQuick.3", "gp.exQuick.4"];
const DEEP_EXAMPLE_KEYS = ["gp.exDeep.1", "gp.exDeep.2", "gp.exDeep.3", "gp.exDeep.4"];

function PanelComposer({
  value, onChange, generating, error, deepMode, onToggleDeep, research, refineMode, onGenerate, onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  generating: boolean;
  error: string | null;
  deepMode: boolean;
  onToggleDeep: () => void;
  research: ResearchProgress | null;
  refineMode?: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border-soft)",
        background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))",
      }}
    >
      {/* 改进模式提示条；否则显示 快速生成 / 深度调研 模式切换 */}
      {refineMode ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
          <Wand2 size={12} /> {t("gp.refineHint")}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <ModePill active={!deepMode} onClick={() => deepMode && onToggleDeep()} icon={<Zap size={12} />} label={t("gp.mode.quick")} disabled={generating} />
          <ModePill active={deepMode} onClick={() => !deepMode && onToggleDeep()} icon={<Users size={12} />} label={t("gp.mode.deep")} disabled={generating} />
        </div>
      )}

      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: 8,
          border: "1px solid var(--color-border)", borderRadius: 12,
          background: "var(--color-bg)", padding: 8,
        }}
      >
        <Sparkles size={16} color="var(--color-primary)" style={{ flexShrink: 0, margin: "8px 0 0 4px" }} />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onGenerate(); }
          }}
          placeholder={refineMode ? t("gp.ph.refine") : deepMode ? t("gp.ph.deep") : t("gp.ph.quick")}
          rows={2}
          disabled={generating}
          style={{
            flex: 1, minWidth: 0, resize: "none", border: "none", outline: "none",
            background: "transparent", color: "var(--color-text)", fontSize: 13,
            lineHeight: 1.5, fontFamily: "inherit", padding: "6px 2px",
          }}
        />
        <button
          onClick={onGenerate}
          disabled={generating || !value.trim()}
          title={t("gp.genTitle")}
          aria-label={t("gp.gen")}
          style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: 9, border: "none",
            background: value.trim() && !generating ? "var(--color-primary)" : "var(--color-border)",
            color: value.trim() && !generating ? "#fff" : "var(--color-text-faint)",
            cursor: value.trim() && !generating ? "pointer" : "default",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {generating ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <ArrowUp size={16} />}
        </button>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          style={{ ...iconBtn, width: 30, height: 30, alignSelf: "flex-start" }}
        >
          <X size={13} />
        </button>
      </div>

      {/* 示例 chips（非调研进行时）*/}
      {!research && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {(deepMode ? DEEP_EXAMPLE_KEYS : EXAMPLE_PROMPT_KEYS).map((exKey) => {
            const ex = t(exKey);
            return (
            <button
              key={exKey}
              onClick={() => onChange(ex)}
              disabled={generating}
              style={{
                padding: "4px 10px", borderRadius: 999, cursor: generating ? "default" : "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-surface)",
                color: "var(--color-text-muted)", fontSize: 11.5, fontFamily: "inherit",
              }}
            >
              {ex}
            </button>
          );})}
        </div>
      )}

      {/* P3 小队进度 */}
      {research && <ResearchProgressView research={research} />}

      {/* 快速生成 loading 提示 */}
      {generating && !deepMode && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> {t("gp.buildingHint")}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "var(--color-danger)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </p>
      )}
    </div>
  );
}

function ModePill({ active, onClick, icon, label, disabled }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 999, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
        fontSize: 11.5, fontWeight: 600,
        border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
        background: active ? "var(--color-primary)" : "var(--color-surface)",
        color: active ? "#fff" : "var(--color-text-muted)",
      }}
    >
      {icon} {label}
    </button>
  );
}

const PHASE_LABEL_KEY: Record<ResearchProgress["phase"], string> = {
  planning: "gp.progress.planning",
  investigating: "gp.progress.investigating",
  assembling: "gp.progress.assembling",
  done: "gp.progress.done",
  error: "gp.progress.error",
};

function ResearchProgressView({ research }: { research: ResearchProgress }) {
  const { t } = useT();
  const STATUS_META: Record<string, { color: string; spin?: boolean; icon: React.ReactNode }> = {
    pending: { color: "var(--color-text-faint)", icon: <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--color-text-faint)" }} /> },
    running: { color: "var(--color-primary)", spin: true, icon: <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> },
    done: { color: "var(--color-success)", icon: <Check size={13} /> },
    error: { color: "var(--color-danger)", icon: <X size={13} /> },
  };
  const doneCount = research.squads.filter((s) => s.status === "done").length;
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
        {t(PHASE_LABEL_KEY[research.phase])}
        {research.squads.length > 0 && research.phase === "investigating" && (
          <span style={{ color: "var(--color-text-faint)", fontWeight: 500 }}>· {doneCount}/{research.squads.length}</span>
        )}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {research.squads.map((sq, i) => {
          const meta = STATUS_META[sq.status];
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "9px 11px", borderRadius: 10,
                border: `1px solid ${sq.status === "running" ? "var(--color-primary)" : "var(--color-border)"}`,
                background: "var(--color-bg)",
                opacity: sq.status === "pending" ? 0.6 : 1,
                transition: "opacity 0.2s, border-color 0.2s",
              }}
            >
              <span style={{ color: meta.color, flexShrink: 0, marginTop: 1, display: "inline-flex", width: 14, justifyContent: "center" }}>{meta.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text)" }}>{sq.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {sq.question}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// schema 编辑器
// ============================================================
function SchemaEditor({
  draft, setDraft, err, onApply, onCancel,
}: {
  draft: string;
  setDraft: (v: string) => void;
  err: string | null;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Code2 size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", flex: 1 }}>
          {t("gp.schemaDesc")}
        </span>
        <button onClick={onApply} style={{ ...pillBtn, background: "var(--color-primary)", color: "#fff", border: "none" }}>
          <Check size={13} /> {t("gp.apply")}
        </button>
        <button onClick={onCancel} style={pillBtn}>
          <X size={13} /> {t("common.cancel")}
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1, minHeight: 0, resize: "none",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12.5, lineHeight: 1.5,
          padding: "12px 14px", borderRadius: 10,
          border: `1px solid ${err ? "var(--color-danger)" : "var(--color-border)"}`,
          background: "var(--color-bg)", color: "var(--color-text)",
          outline: "none", whiteSpace: "pre", overflowWrap: "normal", overflow: "auto",
        }}
      />
      {err && (
        <p style={{ fontSize: 12, color: "var(--color-danger)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {err}
        </p>
      )}
    </div>
  );
}

// ============================================================
// 小件
// ============================================================
function Skeleton() {
  const { t } = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", color: "var(--color-text-faint)", fontSize: 12 }}>
      <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {t("att.loading")}
    </div>
  );
}
function ErrorHint({ msg, onRepair, repairing }: { msg: string; onRepair?: () => void; repairing?: boolean }) {
  const { t } = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--color-danger-soft)", color: "var(--color-danger)", fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ minWidth: 0, wordBreak: "break-word" }}>{msg}</span>
      </div>
      {onRepair && (
        <button
          onClick={onRepair}
          disabled={repairing}
          style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 7, cursor: repairing ? "default" : "pointer",
            border: "1px solid currentColor", background: "transparent", color: "inherit",
            fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", opacity: repairing ? 0.6 : 1,
          }}
        >
          {repairing
            ? <><Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> {t("gp.repairing")}</>
            : <><Wand2 size={12} /> {t("gp.repair")}</>}
        </button>
      )}
    </div>
  );
}
function EmptyHint() {
  const { t } = useT();
  return <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: "var(--color-text-faint)" }}>{t("pm.noData")}</div>;
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
  border: "1px solid var(--color-border)", background: "var(--color-bg)",
  color: "var(--color-text-muted)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const pillBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "6px 12px", borderRadius: 8,
  border: "1px solid var(--color-border)", background: "var(--color-bg)",
  color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
