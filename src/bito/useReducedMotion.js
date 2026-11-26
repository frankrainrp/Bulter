import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native-web';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
}
