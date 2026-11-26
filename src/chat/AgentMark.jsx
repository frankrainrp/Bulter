import { useState, useSyncExternalStore } from 'react';
import { browserPreference } from '../desktop/browserPreference.js';
import { AgentOrb } from './AgentOrb.jsx';

import { RobotGlyph } from './RobotGlyph.jsx';
import { orbOptions } from './orbChoices.js';
import './AgentMark.css';

const idle = () => 'breathing';
const preference = browserPreference(
  'bito-c304.desktop-orb-preset',
  orbOptions.map((option) => option.value),
  idle()
);

export function useAgentMark() {
  const shape = useSyncExternalStore(preference.subscribe, preference.get, idle);
  const [warning, setWarning] = useState('');
  function choose(next) {
    setWarning(preference.set(next) ? '' : 'The icon will last for this visit. Browser storage is unavailable.');
  }
  return { shape, choose, warning };
}

export function AgentMark({ size, color, selected }) {
  return (
    <span className="agent-robot-mark" data-selected={selected} aria-hidden="true">
      <RobotGlyph size={size} color={color} />
    </span>
  );
}

export function WelcomeOrb({ size }) {
  const shape = useSyncExternalStore(preference.subscribe, preference.get, idle);
  return (
    <span className="agent-orb-mark">
      <AgentOrb size={size} state={shape} label="Agent" animate />
    </span>
  );
}
