export const ringStroke = 20;
export const ringGap = 3;
export const ringRadius = 50;
export const ringCanvas = 120;

export function ringSegments(completed, unfinished) {
  // Bito's palette supplies navy-deep and blue-bright for distinguishable task states.
  return [
    { value: completed, color: '#21445E' },
    { value: unfinished || Number(completed === 0), color: '#6798B3' },
  ].filter(({ value }) => value > 0);
}
