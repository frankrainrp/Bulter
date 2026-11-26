import { ScreenTransition } from '../bito/vendor/screen-transition.js';
import '../bito/vendor/screen-transition.css';
import './desktopScanPalette.css';

import { flushSync } from 'react-dom';

export function createDesktopScreenTransition(minWidth) {
  const motion = ScreenTransition(document.body, { geometry: 'center' });
  const desktop = window.matchMedia(`(min-width: ${minWidth}px)`);
  const resize = () => {
    if (!desktop.matches) motion.finish();
  };
  desktop.addEventListener('change', resize);
  return {
    run(commit, options) {
      // Paint the destination while every strip still covers the viewport.
      motion.run(() => flushSync(commit), options);
    },
    isActive: motion.isActive,
    destroy() {
      desktop.removeEventListener('change', resize);
      motion.destroy();
    },
  };
}
