// ============================================================
// lib/ics-import.ts — 简易 .ics 文件解析(只取 SUMMARY + DTSTART)
//
// 不依赖三方库,手动 line-by-line 解析。
// 支持:
//   - VEVENT 块
//   - SUMMARY:xxx 任务名
//   - DTSTART:YYYYMMDDTHHMMSS / DTSTART;VALUE=DATE:YYYYMMDD
//   - DTSTART;TZID=xxx:YYYYMMDDTHHMMSS(忽略 tz,本地化)
//   - DESCRIPTION:xxx(可选)
// 不支持:
//   - RRULE 重复事件(只取首次)
//   - VTIMEZONE 转换
//   - 折行(line folding)
// ============================================================

import type { DdlItem } from "./types";

interface ParsedEvent {
  summary: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM,全天事件填 ""
  description: string;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function unfoldLines(raw: string): string[] {
  // RFC 5545:行以单空格或 tab 起始 = 续上一行
  const out: string[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIsoFromIcs(value: string): { date: string; time: string } | null {
  // 全天事件:YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: "",
    };
  }
  // 含时间:YYYYMMDDTHHMMSSZ?
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
  if (m) {
    return {
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: `${m[4]}:${m[5]}`,
    };
  }
  return null;
}

export function parseIcs(raw: string): ParsedEvent[] {
  const lines = unfoldLines(raw);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { description: "" };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.summary && cur.date) {
        events.push({
          summary: cur.summary,
          date: cur.date,
          time: cur.time ?? "",
          description: cur.description ?? "",
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    // 拆 prop:value(prop 可能含 ;params)
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const propWhole = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const propName = propWhole.split(";")[0].toUpperCase();

    if (propName === "SUMMARY") {
      cur.summary = decodeIcsText(value);
    } else if (propName === "DTSTART") {
      const parsed = parseIsoFromIcs(value);
      if (parsed) {
        cur.date = parsed.date;
        cur.time = parsed.time;
      }
    } else if (propName === "DESCRIPTION") {
      cur.description = decodeIcsText(value);
    }
  }
  return events;
}

function decodeIcsText(s: string): string {
  // RFC 5545 文本转义:\\, \\n, \\,
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** 把 ICS 事件转为 DdlItem 草稿(待 page.tsx 接受) */
export function icsEventsToDdls(events: ParsedEvent[], sourceName: string): DdlItem[] {
  return events.map((e) => ({
    id: uid(),
    taskName: e.summary,
    weight: null,
    dueDate: e.date,
    dueTime: e.time || "23:59",
    description: e.description.slice(0, 200),
    isGroupWork: false,
    source: `Imported from ${sourceName}`,
    completed: false,
    status: "todo" as const,
  }));
}

/** 浏览器文件选择 */
export function pickIcsFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ics,text/calendar";
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(f ?? null);
    };
    input.click();
  });
}
