import { Ionicon } from './browser/Ionicon.jsx';
import { useEffect, useRef, useState } from 'react';

import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native-web';
import { BitoText as Text } from './bito/Typography.jsx';
import { SourceButtonChrome } from './bito/SourceButtonChrome.jsx';
import { StackedPanel } from './bito/StackedPanel.jsx';
import { useReducedMotion } from './bito/useReducedMotion.js';
import { BitoGlyph, hasBitoGlyph } from './bito/BitoGlyph.jsx';
import { DetroitTitle } from './bito/Title.jsx';

export const colors = {
  page: '#F1F1F1',
  paper: '#FAFAFA',
  ink: '#242B33',
  muted: '#4A5A6B',
  border: '#BBCED8',
  navy: '#18364C',
  accent: '#1371BF',
  attention: '#3DABF5',
  soft: '#E4EEF3',
  dark: '#112C42',
  deep: '#012747',
  onDark: '#E4EEF3',
  danger: '#902F43',
  dangerSoft: '#FBECEF',
};

// Detroit's selected-state surface, with a solid fallback on native hosts.
const focusGradient =
  'linear-gradient(180deg, #112C42 0%, #0F314D 30%, #163855 35%, #123E61 60%, #113759 95%, #012747 100%)';
export const detroitFocusSurface = {
  backgroundColor: colors.dark,
  ...(Platform.OS === 'web'
    ? { backgroundImage: focusGradient }
    : { experimental_backgroundImage: focusGradient }),
};

export function DetroitContainer({ tone = 'blue', variant = 'plain', style, ...props }) {
  if (variant === 'stacked')
    return (
      <StackedPanel tone={tone}>
        <View {...props} style={style} />
      </StackedPanel>
    );
  return <View {...props} style={[tone === 'blue' ? s.navySurface : s.paperSurface, style]} />;
}

export function DetroitCorners({ color = colors.accent, size = 14, inset = 0, stroke = 2, acquire = false }) {
  const clock = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!acquire || reduced) return;
    clock.setValue(0);
    const animation = Animated.timing(clock, {
      toValue: 1,
      duration: 850,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [acquire, clock, reduced]);

  const corner = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
  };
  const edges = [
    { top: inset, left: inset, borderTopWidth: stroke, borderLeftWidth: stroke },
    { top: inset, right: inset, borderTopWidth: stroke, borderRightWidth: stroke },
    { bottom: inset, left: inset, borderBottomWidth: stroke, borderLeftWidth: stroke },
    { bottom: inset, right: inset, borderBottomWidth: stroke, borderRightWidth: stroke },
  ];

  const travel = clock.interpolate({
    inputRange: [0, 0.52, 0.53, 1],
    outputRange: [0, 0, 16, 0],
    easing: Easing.bezier(0.18, 0.72, 0.22, 1),
  });
  const opacity = clock.interpolate({ inputRange: [0, 0.52, 0.53, 1], outputRange: [0, 0, 1, 0.86] });
  return (
    <View
      pointerEvents="none"
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {edges.map((edge, index) => (
        <Animated.View
          key={index}
          style={[
            corner,
            edge,
            acquire &&
              !reduced && {
                opacity,
                transform: [
                  { translateX: Animated.multiply(index % 2 ? 1 : -1, travel) },
                  { translateY: Animated.multiply(index < 2 ? -1 : 1, travel) },
                ],
              },
          ]}
        />
      ))}
    </View>
  );
}

export function Icon({ name, size = 21, color = colors.ink }) {
  if (hasBitoGlyph(name)) return <BitoGlyph name={name} size={size} color={color} />;
  return <Ionicon name={name} size={size} color={color} />;
}

export function SourceButton({
  style,
  selected = false,
  inset = 15,
  visualMinHeight = 26,
  tab = false,
  children,
  disabled,
  ...props
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const active = !disabled && (focused || hovered);
  return (
    <Pressable
      {...props}
      aria-selected={props.accessibilityRole === 'tab' ? selected : undefined}
      disabled={disabled}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => setLayout({ width, height })}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [typeof style === 'function' ? style(state) : style, disabled && s.dim]}
    >
      {({ pressed }) => (
        <>
          <View
            aria-hidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={s.buttonSizer}
          >
            {children(false)}
          </View>
          <SourceButtonChrome
            {...layout}
            inset={tab ? Math.min(7, Math.max(2, layout.width * 0.04)) : inset}
            visualMinHeight={visualMinHeight}
            tab={tab}
            focused={active}
            selected={selected}
            pressed={pressed}
          >
            {children}
          </SourceButtonChrome>
        </>
      )}
    </Pressable>
  );
}

export function Button({ label, onPress, icon, secondary, danger, disabled, onDark }) {
  return (
    <SourceButton
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, danger && s.danger, !secondary && !danger && s.primary]}
    >
      {(dark) => {
        const color = dark || onDark ? '#FFFFFF' : danger ? colors.danger : secondary ? colors.accent : colors.ink;
        return (
          <View style={s.buttonContent}>
            {icon && <Icon name={icon} color={color} size={18} />}
            <Text style={[s.buttonText, { color }]}>{label}</Text>
          </View>
        );
      }}
    </SourceButton>
  );
}

export function IconButton({ label, icon, onPress, disabled }) {
  return (
    <SourceButton
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={s.iconButton}
      inset={4}
    >
      {(dark) => <Icon name={icon} color={dark ? '#FFFFFF' : colors.accent} />}
    </SourceButton>
  );
}

export function PageTitle({ title, subtitle, action }) {
  return (
    <View style={s.titleRow}>
      <View style={s.grow}>
        <DetroitTitle title={title} />
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

export function Empty({ icon, title, hint, action }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} color={colors.accent} />
      </View>
      <Text style={s.itemTitle}>{title}</Text>
      <Text style={[s.subtitle, s.center]}>{hint}</Text>
      {action}
    </View>
  );
}

export function Field({ label, multiline, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.fieldHost}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          cursorColor={colors.accent}
          selectionColor={colors.border}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[s.input, multiline && s.multiline]}
        />
        {focused && <DetroitCorners size={8} stroke={1} />}
      </View>
    </View>
  );
}

export function Choices({ label, options, current, onChange }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.choices}>
        {options.map((option) => {
          const selected = current === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              aria-selected={selected}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [s.choice, selected && s.choiceSelected, pressed && s.dim]}
            >
              <Text style={[s.choiceText, selected && s.choiceTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  navySurface: { backgroundColor: colors.navy },
  paperSurface: { backgroundColor: colors.paper },
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  itemTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: colors.ink },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  section: { fontSize: 15, fontWeight: '700', color: colors.ink, paddingTop: 17, paddingBottom: 10 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 56,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonSizer: { opacity: 0 },
  buttonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  primary: { backgroundColor: colors.soft },
  danger: { backgroundColor: colors.dangerSoft },
  dim: { opacity: 0.66 },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: colors.paper,
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    backgroundColor: colors.soft,
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  field: { gap: 7 },
  fieldHost: { backgroundColor: colors.paper },
  input: {
    fontFamily: 'LarkeBold',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: 'transparent',
    letterSpacing: 0.4,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  multiline: { minHeight: 105, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: {
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 13,
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  choiceSelected: detroitFocusSurface,
  choiceText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  choiceTextSelected: { color: '#FFFFFF' },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginBottom: 8,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.paper,
    padding: 15,
    marginBottom: 8,
    gap: 6,
  },
});
