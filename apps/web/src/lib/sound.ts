// ============================================================
// lib/sound.ts — [056] 音效系统
//
// 策略：WebAudio 程序化合成（无外部音频文件，零依赖，零许可问题）
//   - opt-in（默认关闭，防扰民）
//   - 6 个分类：task / chat / toast / achievement / focus / panel
//   - 主开关 + 分类开关 + 音量 + 静音时段（默认 22:00-08:00）
//   - localStorage 持久化
//
// 触发点：toast.success/info/warning/error、任务勾完成、发消息、AI 回复完成、
//   成就解锁、streak 里程碑、Focus Timer 起止、自定义面板创建。
//
// 接班 AI：调 playSound(key)，所有 opt-in 守卫已内置。
// ============================================================

export type SoundKey =
  | "task-complete" | "task-uncomplete"
  | "send" | "ai-reply"
  | "toast-success" | "toast-info" | "toast-warning" | "toast-error"
  | "achievement" | "streak"
  | "focus-start" | "focus-end" | "focus-5min"
  | "panel-create";

export type SoundCategory = "task" | "chat" | "toast" | "achievement" | "focus" | "panel";

const KEY_CATEGORY: Record<SoundKey, SoundCategory> = {
  "task-complete": "task",
  "task-uncomplete": "task",
  "send": "chat",
  "ai-reply": "chat",
  "toast-success": "toast",
  "toast-info": "toast",
  "toast-warning": "toast",
  "toast-error": "toast",
  "achievement": "achievement",
  "streak": "achievement",
  "focus-start": "focus",
  "focus-end": "focus",
  "focus-5min": "focus",
  "panel-create": "panel",
};

// ============================================================
// 偏好（localStorage 持久化）
// ============================================================

export const SOUND_PREFS_KEY = "butler.sound";

export interface SoundPrefs {
  enabled: boolean; // 主开关
  categories: Record<SoundCategory, boolean>;
  volume: number; // 0..1
  quietHours: { start: number; end: number } | null; // 24h
}

export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  enabled: true, // 观察.txt #2：默认开启（仍可在偏好设置关闭 + 静音时段防扰民）
  categories: { task: true, chat: true, toast: true, achievement: true, focus: true, panel: true },
  volume: 0.5,
  quietHours: { start: 22, end: 8 },
};

export const SOUND_PREFS_EVENT = "butler-sound-prefs-change";

export function getSoundPrefs(): SoundPrefs {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFS;
  try {
    const raw = localStorage.getItem(SOUND_PREFS_KEY);
    if (!raw) return DEFAULT_SOUND_PREFS;
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
    return {
      enabled: parsed.enabled ?? DEFAULT_SOUND_PREFS.enabled,
      categories: { ...DEFAULT_SOUND_PREFS.categories, ...(parsed.categories ?? {}) },
      volume: Math.max(0, Math.min(1, parsed.volume ?? DEFAULT_SOUND_PREFS.volume)),
      quietHours: parsed.quietHours === null ? null : (parsed.quietHours ?? DEFAULT_SOUND_PREFS.quietHours),
    };
  } catch { return DEFAULT_SOUND_PREFS; }
}

export function setSoundPrefs(prefs: SoundPrefs): void {
  try { localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs)); } catch { /* silent */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SOUND_PREFS_EVENT));
  }
}

function isQuietHour(prefs: SoundPrefs): boolean {
  const q = prefs.quietHours;
  if (!q) return false;
  const h = new Date().getHours();
  // start>end 表示跨午夜（如 22-8）
  if (q.start > q.end) return h >= q.start || h < q.end;
  return h >= q.start && h < q.end;
}

// ============================================================
// WebAudio 合成
// ============================================================

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    _ctx = new Ctor();
  }
  // 用户首次交互后 resume（浏览器自动暂停未交互的 AudioContext）
  if (_ctx.state === "suspended") _ctx.resume().catch(() => { /* silent */ });
  return _ctx;
}

/**
 * 通用 tone helper：ADSR 简化为 attack(5ms) → sustain → exponential decay。
 */
function tone(
  c: AudioContext, freq: number, duration: number,
  opts: { type?: OscillatorType; volume?: number; startOffset?: number; freqEnd?: number } = {},
): void {
  const { type = "sine", volume = 1, startOffset = 0, freqEnd } = opts;
  const start = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
  }
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * 极短噪声 burst（用于 whoosh / tick）
 */
function noiseBurst(c: AudioContext, duration: number, opts: { volume?: number; startOffset?: number; freq?: number } = {}): void {
  const { volume = 0.15, startOffset = 0, freq = 1000 } = opts;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1;
  const gain = c.createGain();
  const start = c.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(start);
  src.stop(start + duration + 0.02);
}

/**
 * 服务铃（管家签名音）：加法合成——基频 + 两个非谐波分音（2.76× / 5.40×，钟体特征），
 * 快起音 + 长指数衰减。这是 Butler 的「巴甫洛夫」奖励锚点音。
 */
function bell(
  c: AudioContext, freq: number, duration: number,
  opts: { volume?: number; startOffset?: number } = {},
): void {
  const { volume = 1, startOffset = 0 } = opts;
  const start = c.currentTime + startOffset;
  // 非谐波分音比（仿金属钟体），分音越高音量越低
  const partials: [number, number][] = [[1, 1], [2.76, 0.5], [5.40, 0.25]];
  for (const [ratio, amp] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * ratio, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * amp, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

/**
 * 钢笔书写擦音（chat 发送的管家化音色）：高通噪声 + 轻微幅度抖动，模拟笔尖划过纸面。
 */
function scratch(c: AudioContext, duration: number, opts: { volume?: number; startOffset?: number } = {}): void {
  const { volume = 0.12, startOffset = 0 } = opts;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  // 噪声 × 低频抖动包络（笔尖断续摩擦感）
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const wobble = 0.6 + 0.4 * Math.sin(t * Math.PI * 22);
    data[i] = (Math.random() * 2 - 1) * wobble;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;
  const gain = c.createGain();
  const start = c.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(start);
  src.stop(start + duration + 0.02);
}

function synth(c: AudioContext, key: SoundKey, vol: number): void {
  // vol 是 [0,1] 主音量，传递到每个 tone 的 volume 系数
  switch (key) {
    // ---- 任务 ----
    case "task-complete":
      // 管家签名：清脆服务铃 + 上扬小三度点缀（「为您办妥」）
      bell(c, 988, 0.55, { volume: vol * 0.32 });           // B5 铃
      tone(c, 1319, 0.16, { volume: vol * 0.14, startOffset: 0.07 }); // E6 闪点
      break;
    case "task-uncomplete":
      // 低半度的钝铃（撤回）
      bell(c, 660, 0.30, { volume: vol * 0.20 });
      break;
    // ---- Chat ----
    case "send":
      // 钢笔书写擦音（管家提笔记下）
      scratch(c, 0.13, { volume: vol * 0.16 });
      break;
    case "ai-reply":
      // 柔和单声台铃（管家应答）
      bell(c, 784, 0.42, { volume: vol * 0.22 });
      break;
    // ---- Toast ----
    case "toast-success":
      tone(c, 660, 0.08, { volume: vol * 0.3 });
      tone(c, 880, 0.15, { volume: vol * 0.3, startOffset: 0.05 });
      break;
    case "toast-info":
      tone(c, 660, 0.12, { volume: vol * 0.25 });
      break;
    case "toast-warning":
      tone(c, 600, 0.08, { volume: vol * 0.3, type: "triangle" });
      tone(c, 500, 0.12, { volume: vol * 0.3, type: "triangle", startOffset: 0.06 });
      break;
    case "toast-error":
      tone(c, 220, 0.12, { volume: vol * 0.35, type: "sawtooth", freqEnd: 180 });
      break;
    // ---- 成就 ----
    case "achievement":
      // 铃前导 + C-E-G-C 上扬旋律（隆重「晋升」）
      bell(c, 1047, 0.5, { volume: vol * 0.22 });
      tone(c, 523, 0.10, { volume: vol * 0.28, startOffset: 0.10 });
      tone(c, 659, 0.10, { volume: vol * 0.28, startOffset: 0.20 });
      tone(c, 784, 0.10, { volume: vol * 0.28, startOffset: 0.30 });
      tone(c, 1047, 0.28, { volume: vol * 0.32, startOffset: 0.40 });
      break;
    case "streak":
      // 三铃簇鸣（C5 + G5 + C6 钟体）
      bell(c, 523, 0.55, { volume: vol * 0.18 });
      bell(c, 784, 0.55, { volume: vol * 0.16, startOffset: 0.02 });
      bell(c, 1047, 0.65, { volume: vol * 0.14, startOffset: 0.04 });
      break;
    // ---- Focus Timer ----
    case "focus-start":
      // 单声温暖服务铃（开始专注）
      bell(c, 880, 0.7, { volume: vol * 0.28 });
      break;
    case "focus-end":
      // 双声服务铃（专注结束，更隆重）
      bell(c, 880, 0.5, { volume: vol * 0.3 });
      bell(c, 1047, 0.7, { volume: vol * 0.28, startOffset: 0.42 });
      break;
    case "focus-5min":
      // 极轻 tick 提醒
      noiseBurst(c, 0.04, { volume: vol * 0.1, freq: 4000 });
      break;
    // ---- 自定义面板 ----
    case "panel-create":
      // 纸张落桌轻响 + 钟点缀（管家备好一张新卡片）
      noiseBurst(c, 0.08, { volume: vol * 0.12, freq: 320 });
      bell(c, 1175, 0.3, { volume: vol * 0.18, startOffset: 0.06 });
      break;
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 播放音效。所有 opt-in 守卫（主开关、分类、静音时段）已内置。
 * 静默失败：不抛错（音效是「锦上添花」，永远不应该阻塞业务流）。
 */
export function playSound(key: SoundKey): void {
  if (typeof window === "undefined") return;
  try {
    const prefs = getSoundPrefs();
    if (!prefs.enabled) return;
    if (!prefs.categories[KEY_CATEGORY[key]]) return;
    if (isQuietHour(prefs)) return;
    const c = getCtx();
    if (!c) return;
    synth(c, key, prefs.volume);
  } catch { /* silent */ }
}
