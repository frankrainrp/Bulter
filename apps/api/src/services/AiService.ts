import { OpenAI } from "openai";

export const InputLimits = {
  maxPromptChars: 8000,
};

export function ClampText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function ReadSafeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function GetDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });
}

export function GetDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

export function ReadJsonObject(raw: string) {
  try {
    return { ok: true as const, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false as const, error: "AI output was not valid JSON." };
  }
}

