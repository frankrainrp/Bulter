import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native-web';
import { BitoText as Text } from './Typography.jsx';

// Bito's compact Title variant. The offset copy is decorative, as in TitleDisplay.
export function DetroitTitle({ title }) {
  const { width } = useWindowDimensions();
  const [available, setAvailable] = useState(0);
  const longest = Math.max(
    ...title
      .trim()
      .split(/\s+/)
      .map((part) => part.length),
    1
  );
  const compactSize = Math.max(34, Math.min(58, width * 0.04));
  const fontSize = available > 0 ? Math.min(compactSize, Math.max(22, available / (longest * 0.66))) : compactSize;
  const metrics = { fontSize, lineHeight: fontSize * 0.95, letterSpacing: fontSize * 0.025 };
  return (
    <View style={styles.stack} onLayout={({ nativeEvent }) => setAvailable(nativeEvent.layout.width)}>
      <Text
        testID="detroit-title-projection"
        aria-hidden
        importantForAccessibility="no"
        accessible={false}
        selectable={false}
        style={[styles.type, metrics, styles.projection]}
      >
        {title}
      </Text>
      <Text accessibilityRole="header" accessibilityLabel={title} style={[styles.type, metrics, styles.main]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'relative', overflow: 'hidden', paddingBottom: 8 },
  type: {
    fontWeight: '300',
    textTransform: 'uppercase',
    color: '#242B33',
  },
  projection: { position: 'absolute', top: 8, left: 24, width: '100%', color: 'rgba(36,43,51,.075)' },
  main: { position: 'relative' },
});
