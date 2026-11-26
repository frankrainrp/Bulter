import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native-web';
import { BitoText as Text } from './bito/Typography.jsx';
import { Ring } from './bito/Ring.jsx';
import { summarizeTasks } from './model.js';
import { Button, DetroitContainer, DetroitCorners, Icon, PageTitle, colors, s } from './ui.jsx';

export function CompletionGauge({ completed, unfinished, percent, compact = false }) {
  const { width } = useWindowDimensions();
  const preferredSize = compact ? 110 : width <= 520 ? 230 : 286;
  const [available, setAvailable] = useState(0);
  const size = Math.min(preferredSize, Math.max(0, available - 24));

  return (
    <View style={styles.gaugeWidth} onLayout={({ nativeEvent }) => setAvailable(nativeEvent.layout.width)}>
      <View style={[styles.capture, { width: size + 24 }]}>
        <DetroitCorners color={colors.accent} size={compact ? 12 : 22} stroke={compact ? 2 : 3} />
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Overall completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}%`}
          style={styles.gauge}
        >
          <Ring size={size} completed={completed} unfinished={unfinished} />
          <View pointerEvents="none" style={styles.percentOverlay} aria-hidden>
            <Text style={[styles.percent, compact && styles.compactPercent]} maxFontSizeMultiplier={1.5}>
              {percent}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function TaskSummary({ tasks, onBack }) {
  const result = summarizeTasks(tasks);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageTitle
        title="Task summary"
        subtitle="Across all tasks, including those without a date."
        action={<Button label="Back" icon="chevron-back" secondary onPress={onBack} />}
      />
      <DetroitContainer tone="gray" style={styles.overview}>
        <Text style={styles.caption}>Overall completion</Text>
        <CompletionGauge {...result} />
        <Text style={styles.tally}>
          {result.completed} of {result.total} tasks completed
        </Text>
      </DetroitContainer>
      <View style={styles.counts}>
        <View style={[s.card, s.grow]}>
          <Icon name="ellipse-outline" color={colors.accent} size={17} />
          <Text style={styles.count}>{result.unfinished}</Text>
          <Text style={s.label}>Unfinished</Text>
        </View>
        <View style={[s.card, s.grow]}>
          <Icon name="checkmark-circle-outline" color={colors.accent} size={17} />
          <Text style={styles.count}>{result.completed}</Text>
          <Text style={s.label}>Completed</Text>
        </View>
      </View>
      {result.total === 0 && <Text style={s.subtitle}>Add tasks to start tracking your overall progress.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overview: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 15,
    marginBottom: 12,
  },
  caption: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  gaugeWidth: { width: '100%', alignItems: 'center' },
  capture: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  gauge: { alignItems: 'center', justifyContent: 'center' },
  percentOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percent: {
    color: colors.ink,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.3,
    fontVariant: ['tabular-nums'],
  },
  compactPercent: { fontSize: 23, letterSpacing: -0.5 },
  tally: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  counts: { flexDirection: 'row', gap: 10 },
  count: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
