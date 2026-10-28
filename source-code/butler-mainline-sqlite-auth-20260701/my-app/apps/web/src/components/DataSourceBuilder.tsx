"use client";

// ============================================================
// components/DataSourceBuilder.tsx — 动态数据源构建器（替代写死的模板目录）
//
// 两条按需路径，都不依赖固定服务清单：
//   1. AI 智能配置：描述想要的数据 → AI 临时推断 url/参数/path/鉴权占位 → 预览 → 插入
//   2. 手动配置：通用表单（URL/method/query/headers/path/pivot），任意 API
// 密钥用 env:KEY 占位（连接器服务端注入），不进前端。
// 数据源只插进当前面板 spec —— 面板内自洽，无全局注册表。
// ============================================================

import React, { useState } from "react";
import { X, Sparkles, Loader2, Plus, KeyRound, Wand2, SlidersHorizontal, AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { useIsMobile } from "@/lib/use-is-mobile";
import type { DataSource, Block } from "@/lib/panel-schema";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (source: DataSource, blocks: Block[]) => void;
}

type KV = { k: string; v: string };
const newId = () => "src-" + Math.random().toString(36).slice(2, 8);

/** 扫描源里出现的 env:KEY 占位，提示用户配置 */
function scanEnvKeys(src: DataSource): string[] {
  const found = new Set<string>();
  const scan = (s?: string) => {
    if (!s) return;
    const re = /env:([A-Za-z_][A-Za-z0-9_]*)/g;
    let m;
    while ((m = re.exec(s))) found.add(m[1]);
  };
  scan(src.url);
  Object.values(src.headers ?? {}).forEach((v) => scan(String(v)));
  Object.values(src.query ?? {}).forEach((v) => scan(String(v)));
  return Array.from(found);
}

export default function DataSourceBuilder({ open, onClose, onInsert }: Props) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--color-overlay)", zIndex: 92, animation: "fade-in 0.18s ease-out" }} />
      <div
        role="dialog"
        aria-label={t("ds.aria")}
        style={{
          position: "fixed",
          ...(isMobile
            ? { left: 0, right: 0, top: 0, bottom: 0 }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, maxWidth: "94vw", maxHeight: "90vh", borderRadius: 18, animation: "modal-pop 0.22s cubic-bezier(0.16,1,0.3,1)" }),
          display: "flex", flexDirection: "column", overflow: "hidden",
          background: "var(--color-bg)", border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)", zIndex: 93, color: "var(--color-text)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", padding: "16px 18px 12px", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t("ds.title")}</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "3px 0 0" }}>{t("ds.subtitleA")}<code style={{ fontFamily: "ui-monospace,monospace" }}>env:KEY</code>{t("ds.subtitleB")}</p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--color-surface)", cursor: "pointer", color: "var(--color-text-muted)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </header>

        {/* 模式切换 */}
        <div style={{ display: "flex", gap: 6, padding: "0 18px 12px", flexShrink: 0 }}>
          <ModeTab active={mode === "ai"} onClick={() => setMode("ai")} icon={<Wand2 size={13} />} label={t("ds.mode.ai")} />
          <ModeTab active={mode === "manual"} onClick={() => setMode("manual")} icon={<SlidersHorizontal size={13} />} label={t("ds.mode.manual")} />
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "0 18px 18px" }}>
          {mode === "ai"
            ? <AiMode onInsert={(s, b) => { onInsert(s, b); onClose(); }} />
            : <ManualMode onInsert={(s, b) => { onInsert(s, b); onClose(); }} />}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pop { from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
      `}</style>
    </>
  );
}

function ModeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 600,
        border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
        background: active ? "var(--color-primary)" : "var(--color-surface)",
        color: active ? "#fff" : "var(--color-text-muted)",
      }}
    >
      {icon} {label}
    </button>
  );
}

// ============================================================
// AI 智能配置
// ============================================================
function AiMode({ onInsert }: { onInsert: (s: DataSource, b: Block[]) => void }) {
  const { t } = useT();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ source: DataSource; blocks: Block[] } | null>(null);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true); setError(null); setPreview(null);
    try {
      const res = await fetch("/api/generate-source", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const json = (await res.json()) as { ok: boolean; source?: DataSource; blocks?: Block[]; error?: string };
      if (json.ok === true && json.source) setPreview({ source: json.source, blocks: json.blocks ?? [] });
      else setError(json.error ?? t("ds.genFail"));
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  const envKeys = preview ? scanEnvKeys(preview.source) : [];

  return (
    <div style={{ paddingTop: 4 }}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } }}
        placeholder={t("ds.aiPh")}
        rows={3}
        disabled={loading}
        style={{
          width: "100%", resize: "vertical", boxSizing: "border-box",
          border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 12px",
          background: "var(--color-surface)", color: "var(--color-text)", fontSize: 13, lineHeight: 1.5,
          fontFamily: "inherit", outline: "none",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {["ds.ex.1", "ds.ex.2", "ds.ex.3"].map((exKey) => {
          const ex = t(exKey);
          return <button key={exKey} onClick={() => setPrompt(ex)} disabled={loading} style={chip}>{ex}</button>;
        })}
      </div>
      <button onClick={generate} disabled={loading || !prompt.trim()} style={{ ...primaryBtn, marginTop: 12, opacity: loading || !prompt.trim() ? 0.6 : 1 }}>
        {loading ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={14} />}
        {loading ? t("ds.aiConfiguring") : t("ds.genSource")}
      </button>

      {error && <ErrLine msg={error} />}

      {preview && (
        <div style={{ marginTop: 14, border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border-soft)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>{t("ds.previewLabel")}</p>
            <KvLine label={t("ds.kv.type")} value={preview.source.kind === "http" ? t("ds.type.http") : t("ds.type.static")} />
            {preview.source.url && <KvLine label="URL" value={preview.source.url} mono />}
            {preview.source.path && <KvLine label="path" value={preview.source.path} mono />}
            <KvLine label={t("ds.blocks")} value={preview.blocks.map((b) => b.type).join(" · ") || t("ds.none")} />
            {envKeys.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "var(--color-warning)" }}>
                <KeyRound size={12} /> {t("ds.envHint")}
                {envKeys.map((k) => <code key={k} style={envChip}>{k}</code>)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <button onClick={() => onInsert(preview.source, preview.blocks)} style={{ ...primaryBtn, flex: 1 }}>
              <Plus size={14} /> {t("ds.insert")}
            </button>
            <button onClick={generate} style={secondaryBtn}>{t("ds.regen")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 手动配置
// ============================================================
function ManualMode({ onInsert }: { onInsert: (s: DataSource, b: Block[]) => void }) {
  const { t } = useT();
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [path, setPath] = useState("");
  const [query, setQuery] = useState<KV[]>([{ k: "", v: "" }]);
  const [headers, setHeaders] = useState<KV[]>([{ k: "", v: "" }]);
  const [pivot, setPivot] = useState(false);

  const kvToObj = (rows: KV[]) => {
    const o: Record<string, string> = {};
    rows.forEach((r) => { if (r.k.trim()) o[r.k.trim()] = r.v; });
    return Object.keys(o).length ? o : undefined;
  };

  const canAdd = url.trim().length > 0;
  const add = () => {
    if (!canAdd) return;
    const id = newId();
    const source: DataSource = {
      id, kind: "http",
      url: url.trim(), method,
      ...(kvToObj(query) ? { query: kvToObj(query) } : {}),
      ...(kvToObj(headers) ? { headers: kvToObj(headers) } : {}),
      ...(path.trim() ? { path: path.trim() } : {}),
      ...(pivot ? { pivot: { keyName: "key", valueName: "value" } } : {}),
    };
    const blocks: Block[] = [{ id: `${id}-tbl`, type: "table", title: t("ds.dataTitle"), sourceId: id, limit: 20 }];
    onInsert(source, blocks);
  };

  const envKeys = scanEnvKeys({
    id: "x", kind: "http", url, query: kvToObj(query), headers: kvToObj(headers),
  });

  return (
    <div style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
      <Field label="URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1/items" style={inputMono} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label={t("ds.method")} grow={false}>
          <select value={method} onChange={(e) => setMethod(e.target.value as "GET" | "POST")} style={{ ...input, width: 90 }}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </Field>
        <Field label={t("ds.pathLabel")}>
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="data.items" style={inputMono} />
        </Field>
      </div>

      <KvEditor label={t("ds.query")} rows={query} setRows={setQuery} placeholderK={t("ds.queryK")} placeholderV={t("ds.queryV")} />
      <KvEditor label={t("ds.headers")} rows={headers} setRows={setHeaders} placeholderK={t("ds.headerK")} placeholderV={t("ds.headerV")} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--color-text)", cursor: "pointer" }}>
        <input type="checkbox" checked={pivot} onChange={(e) => setPivot(e.target.checked)} style={{ accentColor: "var(--color-primary)" }} />
        {t("ds.pivotLabel")}
      </label>

      {envKeys.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--color-warning)", flexWrap: "wrap" }}>
          <KeyRound size={12} /> {t("ds.envHint2")}
          {envKeys.map((k) => <code key={k} style={envChip}>{k}</code>)}
        </div>
      )}

      <button onClick={add} disabled={!canAdd} style={{ ...primaryBtn, opacity: canAdd ? 1 : 0.6, marginTop: 2 }}>
        <ArrowRight size={14} /> {t("ds.addToPanel")}
      </button>
    </div>
  );
}

function KvEditor({ label, rows, setRows, placeholderK, placeholderV }: { label: string; rows: KV[]; setRows: (r: KV[]) => void; placeholderK: string; placeholderV: string }) {
  const { t } = useT();
  const update = (i: number, patch: Partial<KV>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [{ k: "", v: "" }]);
  const add = () => setRows([...rows, { k: "", v: "" }]);
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", margin: "0 0 6px" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={r.k} onChange={(e) => update(i, { k: e.target.value })} placeholder={placeholderK} style={{ ...inputMono, flex: 1 }} />
            <input value={r.v} onChange={(e) => update(i, { v: e.target.value })} placeholder={placeholderV} style={{ ...inputMono, flex: 1.4 }} />
            <button onClick={() => remove(i)} aria-label={t("ds.remove")} style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-faint)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px dashed var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
        <Plus size={11} /> {t("ds.addRow")}
      </button>
    </div>
  );
}

// ---------- 小件 ----------
function Field({ label, children, grow = true }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: grow ? 1 : "none", minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
function KvLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12, padding: "2px 0", minWidth: 0 }}>
      <span style={{ color: "var(--color-text-muted)", flexShrink: 0, width: 56 }}>{label}</span>
      <span style={{ color: "var(--color-text)", wordBreak: "break-all", fontFamily: mono ? "ui-monospace,monospace" : "inherit", fontSize: mono ? 11.5 : 12 }}>{value}</span>
    </div>
  );
}
function ErrLine({ msg }: { msg: string }) {
  return <p style={{ fontSize: 12, color: "var(--color-danger)", margin: "10px 0 0", display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> {msg}</p>;
}

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--color-border)", background: "var(--color-surface)",
  color: "var(--color-text)", fontSize: 13, fontFamily: "inherit", outline: "none",
};
const inputMono: React.CSSProperties = { ...input, fontFamily: "ui-monospace, monospace", fontSize: 12 };
const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "9px 16px", borderRadius: 10, border: "none",
  background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "9px 14px", borderRadius: 10, border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};
const chip: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 999, cursor: "pointer",
  border: "1px solid var(--color-border)", background: "var(--color-surface)",
  color: "var(--color-text-muted)", fontSize: 11.5, fontFamily: "inherit",
};
const envChip: React.CSSProperties = {
  fontSize: 10.5, fontFamily: "ui-monospace,monospace", padding: "1px 6px", borderRadius: 5,
  background: "var(--color-warning-soft)", color: "var(--color-warning)",
};
