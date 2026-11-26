export function RobotGlyph({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5V7M2 12v4m20-4v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={2.6} r={1.5} fill={color} />
      <rect x={4.3} y={7.2} width={15.4} height={13.4} rx={3.5} stroke={color} strokeWidth={1.8} />
      <circle cx={9} cy={12.7} r={1.25} fill={color} />
      <circle cx={15} cy={12.7} r={1.25} fill={color} />
      <path d="M10 16.6h4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
