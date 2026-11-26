import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, View } from 'react-native-web';
import { BitoText as Text } from '../bito/Typography.jsx';
import { useReducedMotion } from '../bito/useReducedMotion.js';
import { colors } from '../ui.jsx';
import { AgentOrb } from './AgentOrb.jsx';

const radius = 12;
const arm = 23;
const inset = 1;
const dot = 5;
const orbSize = 30;
const nativeDriver = Platform.OS !== 'web';
const side = arm + inset * 2;
const cornerPath = `M${inset} ${inset + arm}v-${arm - radius}q0 -${radius} ${radius} -${radius}h${arm - radius}`;
const cornerEdges = [
  { top: 0, left: 0, transformOrigin: 'top left' },
  { top: 0, right: 0, transformOrigin: 'top right' },
  { bottom: 0, right: 0, transformOrigin: 'bottom right' },
  { bottom: 0, left: 0, transformOrigin: 'bottom left' },
];

function ImageTile({ image, animate }) {
  const motion = useRef(new Animated.Value(0)).current;
  const [{ width, height, y }, setBounds] = useState({ width: 0, height: 0, y: 0 });
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const prefersReduced = useReducedMotion();
  const reduced = prefersReduced || !animate;
  useEffect(() => {
    if (status !== 'ready' || width <= 0 || height <= 0) return;
    if (reduced) {
      motion.setValue(1);
      return;
    }
    const reveal = Animated.timing(motion, {
      toValue: 1,
      duration: 820,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    reveal.start();
    return () => reveal.stop();
  }, [height, motion, reduced, status, width]);

  const right = width - inset;
  const bottom = height - inset;
  const points = [
    [inset, inset],
    [right, inset],
    [inset, bottom],
    [right, bottom],
  ];
  const imageOpacity = motion.interpolate({ inputRange: [0, 0.69, 1], outputRange: [0, 0, 1] });
  const cornerOpacity = motion.interpolate({ inputRange: [0, 0.56, 0.76, 1], outputRange: [0, 0, 1, 1] });
  const cornerScale = motion.interpolate({ inputRange: [0, 0.6, 0.8, 1], outputRange: [0.18, 0.18, 1, 1] });
  const dotOpacity = motion.interpolate({ inputRange: [0, 0.1, 0.6, 0.7, 1], outputRange: [0, 1, 1, 0, 0] });

  return (
    <View
      style={styles.tile}
      testID="reply-image-tile"
      onLayout={({ nativeEvent: { layout } }) =>
        setBounds({ width: layout.width, height: layout.height, y: layout.y })
      }
    >
      {status === 'error' ? (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={styles.caption}>
            Couldn’t load {image.label}.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              motion.setValue(0);
              setStatus('loading');
              setAttempt(attempt + 1);
            }}
          >
            <Text style={styles.retry}>Retry image</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.View style={[styles.picture, { opacity: status === 'ready' ? imageOpacity : 0 }]}>
          <Image
            key={attempt}
            accessibilityLabel={image.label}
            accessible={status === 'ready'}
            source={{ uri: image.uri }}
            style={styles.fill}
            resizeMode="contain"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
        </Animated.View>
      )}
      {status === 'ready' && width > 48 && height > 48 && (
        <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
          {cornerEdges.map((edge, corner) => (
            <Animated.View
              key={corner}
              style={[styles.corner, edge, { opacity: cornerOpacity, transform: [{ scale: cornerScale }] }]}
            >
              <svg width={side} height={side}>
                <path
                  d={cornerPath}
                  transform={`rotate(${corner * 90} ${side / 2} ${side / 2})`}
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={1.35}
                />
              </svg>
            </Animated.View>
          ))}
          {!reduced &&
            points.map(([x, endY], corner) => (
              <Animated.View
                key={corner}
                testID="reply-image-dot"
                style={[
                  styles.dot,
                  {
                    opacity: dotOpacity,
                    transform: [
                      {
                        translateX: motion.interpolate({
                          inputRange: [0, 0.62, 1],
                          outputRange: [width / 2 - dot / 2, x - dot / 2, x - dot / 2],
                        }),
                      },
                      {
                        translateY: motion.interpolate({
                          inputRange: [0, 0.62, 1],
                          outputRange: [orbSize / 2 - y, endY - dot / 2, endY - dot / 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
        </View>
      )}
    </View>
  );
}

export function ImageReveal({ images, animate = true }) {
  return (
    <View style={styles.gallery}>
      <View style={styles.orb}>
        <AgentOrb state="shaping" size={orbSize} />
      </View>
      {images.map((image) => (
        <ImageTile key={image.id} image={image} animate={animate} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { width: '100%', gap: 8, paddingTop: 4 },
  orb: { alignSelf: 'center' },
  tile: { width: '100%', aspectRatio: 4 / 3, position: 'relative', backgroundColor: colors.soft },
  picture: { ...StyleSheet.absoluteFill, borderRadius: radius, overflow: 'hidden' },
  fill: { flex: 1, width: '100%' },
  corner: { position: 'absolute' },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: dot,
    height: dot,
    borderRadius: dot / 2,
    backgroundColor: colors.accent,
  },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  caption: { color: colors.muted, fontSize: 13 },
  retry: { color: colors.accent, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
});
