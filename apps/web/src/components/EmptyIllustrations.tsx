"use client";

// ============================================================
// components/EmptyIllustrations.tsx — [056] 空状态插画
//
// 6 张纯内联 SVG 插画（CSS 变量自动跟随主题色，无外部文件）：
//   - EmptyTasks    任务面板空
//   - EmptyNotes    笔记面板空
//   - EmptyChat     Chat 欢迎屏（与 TodayHero 配合）
//   - EmptySearch   全局搜索无匹配
//   - EmptyFilter   笔记本地搜索无匹配
//   - EmptyPanel    自定义面板空内容
//
// 设计风格：minimalist 单色 line art + 浅底块；stroke = primary，
//   fill = primary-soft；随暗色/主题色切换自适应。
// 所有 size=160（宽），按需通过 wrapper 缩放。
// ============================================================

import React from "react";

interface Props { size?: number }

const COMMON_STROKE = "var(--color-primary)";
const COMMON_FILL = "var(--color-primary-soft)";

// 任务面板空：清单本 + 多条勾完的 todo
export function EmptyTasks({ size = 160 }: Props) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden>
      <rect x="30" y="20" width="100" height="85" rx="8" stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL}/>
      <rect x="30" y="20" width="100" height="14" rx="8" fill={COMMON_STROKE} opacity="0.15"/>
      {/* 已勾选的 3 行 */}
      <g opacity="0.55">
        <circle cx="44" cy="48" r="4" fill={COMMON_STROKE}/>
        <path d="M41.5 48 L43.5 50 L46.5 46" stroke="var(--color-bg)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="54" y1="48" x2="112" y2="48" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round"/>
      </g>
      <g opacity="0.55">
        <circle cx="44" cy="64" r="4" fill={COMMON_STROKE}/>
        <path d="M41.5 64 L43.5 66 L46.5 62" stroke="var(--color-bg)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="54" y1="64" x2="105" y2="64" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round"/>
      </g>
      <g opacity="0.55">
        <circle cx="44" cy="80" r="4" fill={COMMON_STROKE}/>
        <path d="M41.5 80 L43.5 82 L46.5 78" stroke="var(--color-bg)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="54" y1="80" x2="108" y2="80" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round"/>
      </g>
      {/* 闪光 */}
      <g stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round">
        <line x1="140" y1="34" x2="146" y2="28"/>
        <line x1="144" y1="42" x2="150" y2="44"/>
        <line x1="146" y1="36" x2="152" y2="36"/>
      </g>
    </svg>
  );
}

// 管家呈递空托盘（管家化空态）：白手套托银盘 + 盘上金领结 — 暂无内容，静候吩咐
export function EmptyButlerTray({ size = 160 }: Props) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden>
      {/* 银托盘（双椭圆立体）*/}
      <ellipse cx="80" cy="60" rx="46" ry="11" stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL} />
      <ellipse cx="80" cy="56" rx="46" ry="11" stroke={COMMON_STROKE} strokeWidth="2" fill="var(--color-bg)" />
      {/* 盘上管家金领结 */}
      <g transform="translate(80 51)">
        <path d="M-2 0 L-13 -5.5 a1.4 1.4 0 0 0-2 1.2 V4.3 a1.4 1.4 0 0 0 2 1.2 L-2 0 z" fill="var(--butler-gold)" />
        <path d="M2 0 L13 -5.5 a1.4 1.4 0 0 1 2 1.2 V4.3 a1.4 1.4 0 0 1-2 1.2 L2 0 z" fill="var(--butler-gold)" />
        <circle r="2.8" fill="var(--butler-gold)" />
      </g>
      {/* 白手套托举（手掌 + 4 指 + 燕尾袖口）*/}
      <g transform="translate(80 64)">
        <path d="M-16 4 Q-16 -4 -8 -4 H8 Q16 -4 16 4 Q16 10 10 12 H-10 Q-16 10 -16 4 z" stroke={COMMON_STROKE} strokeWidth="2" fill="var(--color-bg)" />
        <g stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round">
          <line x1="-9" y1="-3" x2="-9" y2="-9" />
          <line x1="-3" y1="-4" x2="-3" y2="-10" />
          <line x1="3" y1="-4" x2="3" y2="-10" />
          <line x1="9" y1="-3" x2="9" y2="-9" />
        </g>
        <path d="M-14 12 H14 L11 23 H-11 z" stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL} strokeLinejoin="round" />
        <line x1="-10.5" y1="17" x2="10.5" y2="17" stroke={COMMON_STROKE} strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* 金闪光（呈递的仪式感）*/}
      <g stroke="var(--butler-gold)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="120" y1="32" x2="126" y2="26" />
        <line x1="126" y1="38" x2="132" y2="40" />
        <line x1="124" y1="32" x2="130" y2="32" />
      </g>
    </svg>
  );
}

// 笔记面板空：折叠纸张 + 笔
export function EmptyNotes({ size = 160 }: Props) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden>
      {/* 纸张 */}
      <path d="M50 22 L100 22 L118 40 L118 102 Q118 106 114 106 L50 106 Q46 106 46 102 L46 26 Q46 22 50 22 Z"
            stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL} strokeLinejoin="round"/>
      <path d="M100 22 L100 40 L118 40" stroke={COMMON_STROKE} strokeWidth="2" fill="none" strokeLinejoin="round"/>
      {/* 三行文字线 */}
      <line x1="56" y1="56" x2="106" y2="56" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="56" y1="68" x2="100" y2="68" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="56" y1="80" x2="92" y2="80" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      {/* 笔 */}
      <g transform="rotate(35 124 86)">
        <rect x="118" y="78" width="40" height="6" rx="2" fill={COMMON_STROKE}/>
        <path d="M158 78 L168 81 L158 84 Z" fill={COMMON_STROKE}/>
        <rect x="116" y="78" width="6" height="6" fill={COMMON_FILL} stroke={COMMON_STROKE} strokeWidth="1"/>
      </g>
    </svg>
  );
}

// Chat 欢迎屏插画：聊天气泡 + 闪光（更小，配合 TodayHero）
export function EmptyChat({ size = 140 }: Props) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 140 90" fill="none" aria-hidden>
      {/* 大气泡 */}
      <path d="M20 14 L100 14 Q108 14 108 22 L108 56 Q108 64 100 64 L52 64 L40 76 L42 64 L20 64 Q12 64 12 56 L12 22 Q12 14 20 14 Z"
            stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL} strokeLinejoin="round"/>
      {/* 小气泡 */}
      <circle cx="120" cy="40" r="11" stroke={COMMON_STROKE} strokeWidth="2" fill="var(--color-bg)"/>
      <circle cx="120" cy="40" r="1.6" fill={COMMON_STROKE}/>
      <circle cx="116" cy="40" r="1.6" fill={COMMON_STROKE}/>
      <circle cx="124" cy="40" r="1.6" fill={COMMON_STROKE}/>
      {/* 三点 typing */}
      <circle cx="40" cy="38" r="2.5" fill={COMMON_STROKE} opacity="0.7"/>
      <circle cx="52" cy="38" r="2.5" fill={COMMON_STROKE} opacity="0.7"/>
      <circle cx="64" cy="38" r="2.5" fill={COMMON_STROKE} opacity="0.7"/>
    </svg>
  );
}

// 全局搜索无匹配：放大镜 + 问号
export function EmptySearch({ size = 120 }: Props) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 100" fill="none" aria-hidden>
      <circle cx="50" cy="44" r="26" stroke={COMMON_STROKE} strokeWidth="2.5" fill={COMMON_FILL}/>
      <line x1="69" y1="63" x2="92" y2="86" stroke={COMMON_STROKE} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="69" y1="63" x2="92" y2="86" stroke={COMMON_STROKE} strokeWidth="3.5" strokeLinecap="round"/>
      {/* 问号 in lens */}
      <text x="50" y="52" textAnchor="middle" fontSize="22" fontWeight="700" fill={COMMON_STROKE} fontFamily="system-ui">?</text>
    </svg>
  );
}

// 笔记本地搜索筛选无匹配：漏斗（filter 隐喻）
export function EmptyFilter({ size = 100 }: Props) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 100 90" fill="none" aria-hidden>
      <path d="M14 18 L86 18 L60 50 L60 76 L40 84 L40 50 Z"
            stroke={COMMON_STROKE} strokeWidth="2.2" fill={COMMON_FILL} strokeLinejoin="round"/>
      {/* 空空的尾部 */}
      <line x1="44" y1="78" x2="56" y2="78" stroke={COMMON_STROKE} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

// 自定义面板空：layout grid 框架
export function EmptyPanel({ size = 140 }: Props) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 140 112" fill="none" aria-hidden>
      <rect x="14" y="14" width="112" height="84" rx="8" stroke={COMMON_STROKE} strokeWidth="2" fill={COMMON_FILL}/>
      {/* 6 cells */}
      <g stroke={COMMON_STROKE} strokeWidth="1.4" opacity="0.5">
        <line x1="14" y1="42" x2="126" y2="42"/>
        <line x1="14" y1="70" x2="126" y2="70"/>
        <line x1="51" y1="14" x2="51" y2="98"/>
        <line x1="89" y1="14" x2="89" y2="98"/>
      </g>
      {/* 中心 + */}
      <circle cx="70" cy="56" r="14" fill="var(--color-bg)" stroke={COMMON_STROKE} strokeWidth="2"/>
      <line x1="70" y1="50" x2="70" y2="62" stroke={COMMON_STROKE} strokeWidth="2" strokeLinecap="round"/>
      <line x1="64" y1="56" x2="76" y2="56" stroke={COMMON_STROKE} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
