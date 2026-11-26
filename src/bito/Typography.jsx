import { StyleSheet, Text as NativeText } from 'react-native-web';

export const typefaces = { thin: 'LarkeThin', bold: 'LarkeBold' };

export function BitoText({ style, ...props }) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const bold = weight === 'bold' || Number(weight) >= 600;
  return (
    <NativeText
      {...props}
      style={[
        style,
        {
          fontFamily: bold ? typefaces.bold : typefaces.thin,
          fontWeight: 'normal',
        },
      ]}
    />
  );
}
