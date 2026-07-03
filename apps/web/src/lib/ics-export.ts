// ============================================================
// lib/ics-export.ts — 生成 RFC 5545 ICS 文件
//
// 用户导入到 iOS 日历 / Google Calendar / Outlook 后，
// 系统会按 VALARM 提前 30 分钟原生提醒。
// dueDate 为空（待定）的任务会被跳过。
// ============================================================

import type { DdlItem } from "./types";

// ICS 文本字段转义（反斜杠/换行/逗号/分号）
function esc(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// 把 YYYY-MM-DD + HH:MM 拼成本地浮动时间 YYYYMMDDTHHMMSS
function toLocalDt(date: string, time: string): string {
  const d = date.replace(/-/g, "");
  const t = (time || "23:59").replace(":", "") + "00";
  return `${d}T${t}`;
}

// 当前 UTC DTSTAMP
function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// RFC 5545 要求 75 字节折行，简化按 73 字符折
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 73);
    out.push(i === 0 ? chunk : " " + chunk);
    i += 73;
  }
  return out.join("\r\n");
}

export function generateIcs(ddls: DdlItem[]): string {
  const stamp = nowStamp();
  const events = ddls
    .filter((d) => d.dueDate) // 跳过待定
    .map((d) => {
      const dt = toLocalDt(d.dueDate, d.dueTime);
      // 同时间 1 小时事件（不少日历会把 0 时长事件折叠隐藏）
      const dtEnd = endPlusOneHour(d.dueDate, d.dueTime);
      const summary = `${d.taskName}${d.weight != null ? ` (${d.weight}%)` : ""}${d.isGroupWork ? " group" : ""}`;
      const descParts = [
        d.description || "",
        d.source ? `Source: ${d.source}` : "",
        // G3.1 被动传播水印
        "-- Powered by Butler · Smart Study Assistant https://butler.app",
      ].filter(Boolean);
      const lines = [
        "BEGIN:VEVENT",
        fold(`UID:${d.id}@butler`),
        `DTSTAMP:${stamp}`,
        `DTSTART:${dt}`,
        `DTEND:${dtEnd}`,
        fold(`SUMMARY:${esc(summary)}`),
        fold(`DESCRIPTION:${esc(descParts.join("\n"))}`),
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(`30 minutes later: ${summary}`)}`),
        "END:VALARM",
        "END:VEVENT",
      ];
      return lines.join("\r\n");
    });

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Butler//Personal Learning OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Butler Tasks",
    "X-WR-TIMEZONE:Asia/Shanghai",
  ].join("\r\n");

  return [header, ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

function endPlusOneHour(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = (time || "23:59").split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  dt.setHours(dt.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

/** 触发浏览器下载 butler-tasks.ics */
export function downloadIcs(ddls: DdlItem[]): { ok: boolean; count: number } {
  const content = generateIcs(ddls);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `butler-tasks-${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, count: ddls.filter((d) => d.dueDate).length };
}
