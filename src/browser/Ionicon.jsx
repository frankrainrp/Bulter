import glyphs from './ionicons.json';

export function Ionicon({ name, size, color }) {
  const code = glyphs[name];
  if (!code) return null;
  return (
    <span aria-hidden="true" style={{ fontFamily: 'BiToIcons', fontSize: size, lineHeight: 1, color }}>
      {String.fromCodePoint(code)}
    </span>
  );
}
