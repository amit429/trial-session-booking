/** UTC-aligned starts every `stepMin` minutes in [start, end] (inclusive). */
export function gridStarts(start: Date, end: Date, stepMin: number): Date[] {
  const step = stepMin * 60_000;
  const out: Date[] = [];
  for (let t = Math.ceil(start.getTime() / step) * step; t <= end.getTime(); t += step) out.push(new Date(t));
  return out;
}
