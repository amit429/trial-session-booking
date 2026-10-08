import { MENTOR_TIMEZONE, formatDay, zonedTime } from "@shared";

const label = (d: string) => formatDay(zonedTime(d, 720, MENTOR_TIMEZONE).toJSDate(), MENTOR_TIMEZONE);

/** Booked vs capacity per India date. Bars share one scale; capacity is drawn behind bookings. */
export function CapacityChart({ data }: { data: { istDate: string; booked: number; capacity: number }[] }) {
  const W = 720,
    H = 220,
    L = 30,
    B = 26,
    T = 8;
  const top = Math.max(4, ...data.map(d => d.capacity));
  const step = top <= 8 ? 2 : top <= 20 ? 5 : 10;
  const max = Math.ceil(top / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const bw = (W - L) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Trials booked versus capacity per India date">
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
            {v}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = L + i * bw + bw * 0.18,
          w = bw * 0.64,
          full = d.capacity > 0 && d.booked >= d.capacity;
        return (
          <g key={d.istDate}>
            <title>{`${label(d.istDate)}: ${d.booked} of ${d.capacity} booked`}</title>
            <rect x={x} y={y(d.capacity)} width={w} height={y(0) - y(d.capacity)} rx={4} fill="var(--muted)" />
            <rect
              x={x}
              y={y(d.booked)}
              width={w}
              height={Math.max(0, y(0) - y(d.booked))}
              rx={4}
              fill={full ? "var(--destructive)" : "var(--brand)"}
              data-full={full}
            />
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {Number(d.istDate.slice(8))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
