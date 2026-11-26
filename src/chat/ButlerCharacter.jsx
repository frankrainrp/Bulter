import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native-web';
import { useReducedMotion } from '../bito/useReducedMotion.js';
import { colors } from '../ui.jsx';

// Original mobile scale, pose asset sizes, and seven-pose frame bounds from
// Bulter fb87792074a6136ab5b87e69657c8b24a9d831f8's ChatCanvas and ButlerCharacter.
const scale = 0.24;
const width = Math.round(683 * scale);
const height = Math.round(1099 * scale);
const poses = {
  standing: {
    source: new URL('../../assets/chat/butler-standing.png', import.meta.url).href,
    width: 374,
    height: 1094,
  },
  thinking: {
    source: new URL('../../assets/chat/butler-thinking.png', import.meta.url).href,
    width: 324,
    height: 1056,
  },
};
const nativeDriver = Platform.OS !== 'web';
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const envelopeSpring = Easing.bezier(0.34, 1.4, 0.5, 1);
const thoughtSpring = Easing.bezier(0.5, 1.7, 0.45, 1);
const bounce = Easing.inOut(Easing.ease);

function ThoughtDot({ index, animate }) {
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    const animation = Animated.sequence([
      Animated.delay(index * 160),
      Animated.loop(
        Animated.timing(beat, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: nativeDriver,
          isInteraction: false,
        })
      ),
    ]);
    animation.start();
    return () => {
      animation.stop();
      beat.setValue(0);
    };
  }, [animate, beat, index]);
  const opacity = beat.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [0.45, 1, 0.45, 0.45],
    easing: bounce,
  });
  const translateY = beat.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [0, -4, 0, 0],
    easing: bounce,
  });
  return <Animated.View style={[styles.dot, { opacity: animate ? opacity : 1, transform: [{ translateY }] }]} />;
}

export function ButlerCharacter({ thinking }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const pose = useRef(new Animated.Value(0)).current;
  const bubbleFade = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.5)).current;
  const shadowId = 'butler-shadow-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(thinking ? 1 : 0);
      rise.setValue(thinking ? 0 : 18);
      pose.setValue(thinking ? 1 : 0);
      bubbleFade.setValue(thinking ? 1 : 0);
      bubbleScale.setValue(thinking ? 1 : 0.5);
      return;
    }
    const common = { useNativeDriver: nativeDriver, isInteraction: false };
    const delay = thinking ? 0 : 300;
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        ...common,
        toValue: thinking ? 1 : 0,
        duration: thinking ? 400 : 1000,
        delay,
        easing: ease,
      }),
      Animated.timing(rise, {
        ...common,
        toValue: thinking ? 0 : 18,
        duration: thinking ? 500 : 1000,
        delay,
        easing: thinking ? envelopeSpring : ease,
      }),
      Animated.timing(pose, { ...common, toValue: thinking ? 1 : 0, duration: 400, easing: ease }),
      Animated.timing(bubbleFade, {
        ...common,
        toValue: thinking ? 1 : 0,
        duration: thinking ? 300 : 700,
        easing: ease,
      }),
      Animated.timing(bubbleScale, {
        ...common,
        toValue: thinking ? 1 : 0.5,
        duration: thinking ? 400 : 600,
        easing: thinking ? thoughtSpring : ease,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [thinking, reducedMotion, opacity, rise, pose, bubbleFade, bubbleScale]);

  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { opacity, transform: [{ translateY: rise }] }]}
    >
      <svg width={width * 0.6} height={8} style={styles.shadow} viewBox="0 0 100 8" preserveAspectRatio="none">
        <defs>
          <radialGradient id={shadowId} cx="50%" cy="50%" r="50%">
            <stop offset={0} stopColor="#1B3D2F" stopOpacity={0.22} />
            <stop offset={0.7} stopColor="#1B3D2F" stopOpacity={0} />
          </radialGradient>
        </defs>
        <ellipse cx={50} cy={4} rx={50} ry={4} fill={`url(#${shadowId})`} />
      </svg>
      {Object.entries(poses).map(([name, asset]) => (
        <Animated.View
          key={name}
          style={[
            styles.pose,
            {
              width: Math.round(asset.width * scale),
              height: Math.round(asset.height * scale),
              opacity: name === 'thinking' ? pose : Animated.subtract(1, pose),
            },
          ]}
        >
          <Image accessible={false} source={asset.source} resizeMode="contain" style={styles.image} />
        </Animated.View>
      ))}
      <Animated.View style={[styles.thought, { opacity: bubbleFade, transform: [{ scale: bubbleScale }] }]}>
        <View style={[styles.bubble, styles.mainBubble]}>
          {[0, 1, 2].map((index) => (
            <ThoughtDot key={index} index={index} animate={thinking && !reducedMotion} />
          ))}
        </View>
        <View style={[styles.bubble, styles.tailMedium]} />
        <View style={[styles.bubble, styles.tailSmall]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { width, height, flexShrink: 0, alignItems: 'center' },
  pose: { position: 'absolute', bottom: 0 },
  image: { width: '100%', height: '100%' },
  shadow: { position: 'absolute', bottom: -6, left: '20%' },
  thought: {
    position: 'absolute',
    width: 64,
    height: 48,
    left: width / 2 + 14,
    bottom: '88%',
    transformOrigin: 'bottom left',
    zIndex: 3,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.paper,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: 99,
  },
  mainBubble: {
    left: 8,
    top: 0,
    width: 54,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tailMedium: { left: 6, top: 33, width: 12, height: 12 },
  tailSmall: { left: 0, top: 42, width: 7, height: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
