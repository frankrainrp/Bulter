export const idleFacetOpacity = [0.047, 0.047, 0.047, 0.016, 0.016, 0.047, 0.047, 0.031, 0.047, 0.047];

const kinds = [
  'rect',
  'half-left',
  'tri-down',
  'tri-up',
  'tri-down',
  'tri-up',
  'tri-down',
  'tri-up',
  'half-right',
  'rect',
];

// Bito's layoutPieces() and detroit-family.css compact host constraint.
export function sourceButtonGeometry(width, height, inset, tab = false) {
  const bodyWidth = Math.max(0, width - inset * 2);
  const bodyHeight = Math.max(0, tab ? Math.min(height - 30, 34) : Math.min(height - 30, bodyWidth / 7));
  const h = bodyHeight;
  const patternWidth = tab ? Math.max(bodyWidth, 7 * h) : bodyWidth;
  const offset = (bodyWidth - patternWidth) / 2;
  const flex = Math.max(0, (patternWidth - 7 * h) / 2);
  const positions = [
    [0, flex],
    [flex, h],
    [flex, 2 * h],
    [flex + h, 2 * h],
    [flex + 2 * h, 2 * h],
    [flex + 3 * h, 2 * h],
    [flex + 4 * h, 2 * h],
    [flex + 5 * h, 2 * h],
    [flex + 6 * h, h],
    [flex + 7 * h, Math.max(0, patternWidth - (flex + 7 * h))],
  ];

  return {
    bodyWidth,
    bodyHeight,
    facets: positions.map(([left, width], index) => ({ left: left + offset, width, kind: kinds[index] })),
  };
}

export function sourceButtonChromeGeometry(width, height, inset, visualMinHeight, tab) {
  const body = sourceButtonGeometry(width, height, inset, tab);
  const faceHeight = Math.min(height, Math.max(visualMinHeight, body.bodyHeight));
  const faceTop = (height - faceHeight) / 2;
  const scale = Math.min(1.6, Math.sqrt((width * height) / (268 * 64)));

  // The Bito reference is a 268 × 64 host, with a 45 px halo and 8 px corner arms.
  const glowHeight = Math.min((tab ? 23 : 45) * scale, tab ? faceTop : height * 0.85);
  const cornerLength = Math.min(8 * scale, width / 4, height / 4);
  const cornerStroke = Math.min(cornerLength, Math.max(1, scale));

  return {
    ...body,
    faceHeight,
    faceTop,
    glowHeight,
    cornerLength,
    cornerStroke,
    cornerTravel: cornerLength * 2,
    pressTravel: cornerLength / 4,
    referenceSize: cornerLength * 0.75,
    referenceBottom: faceTop - glowHeight - cornerLength / 2,
  };
}

export function facetPath(kind, left, width, height) {
  const right = left + width;
  const middle = left + width / 2;
  switch (kind) {
    case 'rect':
      return `M${left} 0H${right}V${height}H${left}Z`;
    case 'half-left':
      return `M${left} 0L${right} ${height}H${left}Z`;
    case 'half-right':
      return `M${left} 0H${right}V${height}Z`;
    case 'tri-down':
      return `M${left} 0H${right}L${middle} ${height}Z`;
    case 'tri-up':
      return `M${left} ${height}L${middle} 0L${right} ${height}Z`;
  }
}
