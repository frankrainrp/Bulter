import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, useWindowDimensions } from 'react-native-web';
import { createDesktopScreenTransition } from './desktop/desktopScreenTransition.js';

const stripCount = 10;
const stripTravel = 0.55;
const stripDelay = 0.045;
const desktopMinWidth = 900;

export function useScreenTransition() {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useRef(true);
  const busy = useRef(false);
  const desktopScan = useRef(undefined);
  const [visible, setVisible] = useState(false);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) reducedMotion.current = enabled;
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reducedMotion.current = enabled;
    });
    return () => {
      active = false;
      subscription?.remove();
      progress.stopAnimation();
      desktopScan.current?.destroy();
      desktopScan.current = undefined;
    };
  }, [progress]);

  function transition(commit, backwards = false) {
    if (Platform.OS === 'web' && width >= desktopMinWidth) {
      desktopScan.current ??= createDesktopScreenTransition(desktopMinWidth);
      desktopScan.current?.run(commit, { backwards });
      return;
    }
    if (busy.current) return;
    if (reducedMotion.current) {
      commit();
      return;
    }
    busy.current = true;
    progress.setValue(0);
    setReverse(backwards);
    setVisible(true);
    const timing = (toValue) =>
      Animated.timing(progress, {
        toValue,
        duration: 210,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      });
    const finish = () => {
      busy.current = false;
      setVisible(false);
    };
    timing(1).start(({ finished }) => {
      if (!finished) {
        finish();
        return;
      }
      commit();
      timing(2).start(finish);
    });
  }

  const distance = reverse ? width : -width;
  const strips = Array.from({ length: stripCount }, (_, index) => {
    const delay = (reverse ? stripCount - 1 - index : index) * stripDelay;
    return progress.interpolate({
      inputRange: [delay, delay + stripTravel, 1 + delay, 1 + delay + stripTravel],
      outputRange: [distance, 0, 0, -distance],
      extrapolate: 'clamp',
      easing: Easing.inOut(Easing.quad),
    });
  });

  return {
    transition,
    visible,
    reverse,
    strips,
    isDesktopTransitioning: () => desktopScan.current?.isActive() ?? false,
  };
}
