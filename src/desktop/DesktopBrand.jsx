import { Image, StyleSheet } from 'react-native-web';
import './workspaceContrast.css';

export function DesktopBrand() {
  return (
    <Image
      testID="desktop-brand-logo"
      source={new URL('../../assets/bito-logo.png', import.meta.url).href}
      accessibilityLabel="BiTo"
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 56, flexShrink: 0 },
});
