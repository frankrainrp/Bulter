// Paths from ICON_MARKUP, Bito's bundled Detroit UI at b0cc94418bc91dc84bf379e06a148a6f89b1bc80.
const paths = {
  add: <path d="M32 14v36M14 32h36" />,
  checkmark: <path d="m14 34 13 13 24-29" />,
  'chevron-back': <path d="m39 15-17 17 17 17" />,
  'chevron-forward': <path d="m25 15 17 17-17 17" />,
  'chatbubble-ellipses-outline': <path d="M10 14h44v30H30L18 53v-9h-8Z" />,
  'document-text-outline': (
    <>
      <path d="M18 10h20l9 9v35H18Z" />
      <path d="M38 10v10h10" />
    </>
  ),
  'calendar-outline': (
    <>
      <rect x="11" y="15" width="42" height="38" />
      <path d="M11 25h42M21 10v10M43 10v10" />
    </>
  ),
  'send-outline': (
    <>
      <path d="M11 31.5 54 13 39.5 52 29 38.5Z" />
      <path d="M29 38.5 54 13" />
    </>
  ),
  'link-outline': (
    <>
      <path d="M24 40 18 46c-4 4-10 4-14 0s-4-10 0-14l8-8c4-4 10-4 14 0l3 3" />
      <path d="M40 24 46 18c4-4 10-4 14 0s4 10 0 14l-8 8c-4 4-10 4-14 0l-3-3" />
      <path d="M24 32h16" />
      <path d="m28 28-4 4 4 4M36 28l4 4-4 4" />
    </>
  ),
};

const navigationPaths = {
  'grid-outline': <path d="M11 11h17v17H11zM36 11h17v17H36zM11 36h17v17H11zM36 36h17v17H36z" />,
  'list-outline': (
    <>
      <path d="M24 17h32M24 32h32M24 47h32" />
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="17" r="4.2" />
        <circle cx="12" cy="32" r="4.2" />
        <circle cx="12" cy="47" r="4.2" />
      </g>
    </>
  ),
};

export function BitoGlyph({ name, size, color, strokeWidth = 3.25 }) {
  const geometry = paths[name] ?? navigationPaths[name];
  if (!geometry) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" color={color} aria-hidden>
      <g fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter">
        {geometry}
      </g>
    </svg>
  );
}

export function hasBitoGlyph(name) {
  return Object.prototype.hasOwnProperty.call(paths, name);
}
