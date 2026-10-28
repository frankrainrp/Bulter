"use client";

// ============================================================
// components/mini-apps/ShareCard.tsx — 学习报告分享卡(G3.2)
//
// 渲染本周完成度成竖版 SVG 海报(540×800,适合手机分享尺寸)
// 用户右键 / 长按图片即可保存到相册
// ============================================================

import React, { useMemo } from "react";
import { Share2 } from "lucide-react";
import type { DdlItem } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  ddls?: DdlItem[];
}

function effStatus(d: DdlItem): "todo" | "in_progress" | "done" {
  return d.status ?? (d.completed ? "done" : "todo");
}

export default function ShareCard({ ddls = [] }: Props) {
  const { t, lang } = useT();
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const totalDone = ddls.filter((d) => effStatus(d) === "done").length;
    const totalTodo = ddls.filter((d) => effStatus(d) !== "done").length;
    const weekDone = ddls.filter((d) => {
      if (effStatus(d) !== "done") return false;
      if (!d.dueDate) return false;
      const ts = new Date(d.dueDate).getTime();
      return ts >= weekStart.getTime() && ts <= today.getTime() + 86400000;
    }).length;

    // 7 天柱图数据
    const days: { iso: string; count: number; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = t(`dow.${d.getDay()}`);
      const count = ddls.filter((it) => effStatus(it) === "done" && it.dueDate === iso).length;
      days.push({ iso, count, label });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count));
    return { totalDone, totalTodo, weekDone, days, maxDay };
  }, [ddls, t]);

  const todayLabel = new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--color-text-muted)",
          lineHeight: 1.5,
        }}
      >
        <Share2 size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
        {t("share.saveHint")}
      </div>

      {/* 540×800 海报,缩放 0.55 适配 320px 抽屉 */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: "scale(0.55)",
            transformOrigin: "top center",
            marginBottom: -360, // 抵消缩放空白
          }}
        >
          <svg width="540" height="800" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B3D2F" />
                <stop offset="100%" stopColor="#0F2418" />
              </linearGradient>
              <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* 背景 */}
            <rect width="540" height="800" fill="url(#bg)" />

            {/* 顶部品牌 */}
            <text x="50" y="68" fontFamily="Inter, system-ui" fontSize="14" fill="#94a3b8" letterSpacing="3">
              {t("share.brand")}
            </text>
            <text x="50" y="100" fontFamily="Inter, system-ui" fontSize="13" fill="#64748b">
              {todayLabel}
            </text>

            {/* Hero 数字 */}
            <text x="50" y="200" fontFamily="Inter, system-ui" fontSize="20" fill="#cbd5e1">
              {t("share.weekDone")}
            </text>
            <text x="50" y="290" fontFamily="Inter, system-ui" fontSize="100" fontWeight="700" fill="#FFFFFF">
              {stats.weekDone}
            </text>
            <text x={50 + (stats.weekDone < 10 ? 70 : stats.weekDone < 100 ? 130 : 190)} y="290" fontFamily="Inter, system-ui" fontSize="24" fill="#94a3b8">
              {t("share.tasksUnit")}
            </text>

            {/* 累计 chip */}
            <rect x="50" y="320" width="200" height="42" rx="21" fill="url(#card)" stroke="rgba(255,255,255,0.15)" />
            <text x="68" y="347" fontFamily="Inter, system-ui" fontSize="14" fill="#cbd5e1">
              {t("share.totalDone")}
            </text>
            <text x="156" y="348" fontFamily="Inter, system-ui" fontSize="18" fontWeight="700" fill="#FFFFFF">
              {stats.totalDone}
            </text>

            <rect x="260" y="320" width="200" height="42" rx="21" fill="url(#card)" stroke="rgba(255,255,255,0.15)" />
            <text x="278" y="347" fontFamily="Inter, system-ui" fontSize="14" fill="#cbd5e1">
              {t("share.inProgress")}
            </text>
            <text x="343" y="348" fontFamily="Inter, system-ui" fontSize="18" fontWeight="700" fill="#FFFFFF">
              {stats.totalTodo}
            </text>

            {/* 7 天柱图 */}
            <text x="50" y="430" fontFamily="Inter, system-ui" fontSize="13" fill="#94a3b8" letterSpacing="1">
              {t("share.trend7")}
            </text>
            {stats.days.map((d, idx) => {
              const x = 50 + idx * 64;
              const h = (d.count / stats.maxDay) * 140;
              return (
                <g key={d.iso}>
                  <rect
                    x={x}
                    y={580 - h}
                    width={48}
                    height={h}
                    rx={4}
                    fill={d.count > 0 ? "#5FB58F" : "#334155"}
                  />
                  <text x={x + 24} y={605} fontFamily="Inter, system-ui" fontSize="12" fill="#94a3b8" textAnchor="middle">
                    {d.label}
                  </text>
                  {d.count > 0 && (
                    <text x={x + 24} y={573 - h} fontFamily="Inter, system-ui" fontSize="11" fill="#FFFFFF" textAnchor="middle">
                      {d.count}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Footer */}
            <line x1="50" y1="680" x2="490" y2="680" stroke="rgba(255,255,255,0.10)" />
            <text x="50" y="720" fontFamily="Inter, system-ui" fontSize="14" fontWeight="500" fill="#cbd5e1">
              {t("share.slogan")}
            </text>
            <text x="50" y="752" fontFamily="Inter, system-ui" fontSize="11" fill="#64748b">
              {t("share.footer")}
            </text>

            {/* Logo 小图标占位(墨绿圆) */}
            <circle cx="468" cy="734" r="22" fill="#5FB58F" />
            <text x="468" y="742" fontFamily="Inter, system-ui" fontSize="16" fontWeight="700" fill="#0F2418" textAnchor="middle">B</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
