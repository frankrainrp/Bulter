"use client";

// ============================================================
// components/panel-modules/Charts.tsx — [064] 手绘 SVG 图表（零依赖）
// 饼图 / 柱状图 / 热力图。颜色用 CSS 变量 → 自动跟随三主题。
// ============================================================

import React from "react";
import { useT } from "@/lib/i18n";

export interface Series {
  label: string;
  value: number;
}

// 多系列调色板（跟随主题色）
const PALETTE = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
];

function EmptyHint({ text }: { text?: string }) {
  const { t } = useT();
  return (
    <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 12, color: "var(--color-text-faint)" }}>
      {text ?? t("pm.noData")}
    </div>
  );
}

// ---------- 饼图 ----------
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey} Z`;
}

export function PieChart({ data }: { data: Series[] }) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyHint />;
  const cx = 60, cy = 60, r = 54;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <svg viewBox="0 0 120 120" width={120} height={120} style={{ flexShrink: 0 }}>
        {items.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={PALETTE[0]} />
        ) : (
          items.map((d, i) => {
            const start = (acc / total) * 360;
            acc += d.value;
            const end = (acc / total) * 360;
            return <path key={i} d={arcPath(cx, cy, r, start, end)} fill={PALETTE[i % PALETTE.length]} />;
          })
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        {items.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <span style={{ color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {d.label}
            </span>
            <span style={{ color: "var(--color-text-muted)", marginLeft: "auto", paddingLeft: 8 }}>
              {d.value} · {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 柱状图 ----------
export function BarChart({ data }: { data: Series[] }) {
  if (data.length === 0) return <EmptyHint />;
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320, H = 140, pad = 22, gap = 8;
  const n = data.length;
  const bw = (W - pad * 2 - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {/* 基线 */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border)" strokeWidth={1} />
      {data.map((d, i) => {
        const h = (d.value / max) * (H - pad * 2);
        const x = pad + i * (bw + gap);
        const y = H - pad - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={4} fill={PALETTE[i % PALETTE.length]} />
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
              {d.value}
            </text>
            <text x={x + bw / 2} y={H - pad + 13} textAnchor="middle" fontSize={10} fill="var(--color-text-faint)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- 折线图 ----------
export function LineChart({ data }: { data: Series[] }) {
  if (data.length === 0) return <EmptyHint />;
  const W = 320, H = 140, pad = 24;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const n = data.length;
  const xAt = (i: number) => pad + (n === 1 ? (W - pad * 2) / 2 : (i / (n - 1)) * (W - pad * 2));
  const yAt = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const pts = data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border)" strokeWidth={1} />
      {/* 区域填充 */}
      <polygon
        points={`${pad},${H - pad} ${pts} ${W - pad},${H - pad}`}
        fill="var(--color-primary)"
        fillOpacity={0.08}
      />
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(d.value)} r={2.6} fill="var(--color-primary)">
          <title>{`${d.label}: ${d.value}`}</title>
        </circle>
      ))}
      {/* 首尾标签 */}
      <text x={pad} y={H - 6} fontSize={9} fill="var(--color-text-faint)" textAnchor="start">{data[0].label}</text>
      {n > 1 && (
        <text x={W - pad} y={H - 6} fontSize={9} fill="var(--color-text-faint)" textAnchor="end">{data[n - 1].label}</text>
      )}
    </svg>
  );
}

// ---------- 热力图（7 行 weekday × N 列 week，GitHub 式）----------
export function Heatmap({ days }: { days: { date: string; count: number; weekday: number }[] }) {
  const { t } = useT();
  if (days.length === 0) return <EmptyHint />;
  const max = Math.max(1, ...days.map((d) => d.count));
  // 切成列（每 7 天一列）
  const cols: { date: string; count: number; weekday: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));
  const cell = 15, gap = 3;
  const W = cols.length * (cell + gap);
  const H = 7 * (cell + gap);
  const intensity = (c: number) => (c === 0 ? 0 : 0.25 + 0.75 * (c / max));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
        {cols.map((col, ci) =>
          col.map((d, ri) => (
            <rect
              key={d.date}
              x={ci * (cell + gap)}
              y={ri * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              fill={d.count === 0 ? "var(--color-border-soft)" : "var(--color-primary)"}
              fillOpacity={d.count === 0 ? 1 : intensity(d.count)}
            >
              <title>{`${d.date}: ${t("pm.itemsN", { n: d.count })}`}</title>
            </rect>
          )),
        )}
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 10, color: "var(--color-text-faint)" }}>
        <span>{t("pm.less")}</span>
        {[0, 0.3, 0.6, 1].map((o, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 2, background: o === 0 ? "var(--color-border-soft)" : "var(--color-primary)", opacity: o === 0 ? 1 : 0.25 + 0.75 * o }} />
        ))}
        <span>{t("pm.more")}</span>
      </div>
    </div>
  );
}
