import './taskFeedback.css';
import { browserPreference } from './browserPreference.js';

const sound = browserPreference('bito-c304.desktop-task-sounds', ['on', 'off'], 'on');
let audio;

export function taskSoundsEnabled() {
  return sound.get() === 'on';
}

export const subscribeTaskSounds = sound.subscribe;
export function setTaskSoundsEnabled(value) {
  sound.set(value ? 'on' : 'off');
}

// Request audio during activation. Emit a note only after persistence succeeds.
export function prepareTaskSound() {
  if (!taskSoundsEnabled() || typeof AudioContext !== 'function') return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch {
    /* Visual and screen-reader confirmation stay available. */
  }
}

export function playTaskSound(kind) {
  if (!taskSoundsEnabled() || audio?.state !== 'running' || document.hidden) return;
  try {
    const tone = audio.createOscillator();
    const level = audio.createGain();
    const start = audio.currentTime;
    tone.type = 'sine';
    tone.frequency.value = kind === 'completed' ? 1046.5 : 784;
    level.gain.setValueAtTime(0.001, start);
    level.gain.exponentialRampToValueAtTime(0.085, start + 0.009);
    level.gain.exponentialRampToValueAtTime(0.001, start + 0.21);
    tone.connect(level).connect(audio.destination);
    tone.onended = () => {
      tone.disconnect();
      level.disconnect();
    };
    tone.start(start);
    tone.stop(start + 0.22);
  } catch {
    /* The browser may withdraw or block audio at any time. */
  }
}
