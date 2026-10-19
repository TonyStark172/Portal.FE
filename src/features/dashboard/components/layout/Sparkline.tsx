import { useId } from "react";

export type TrendDirection = "up" | "down" | "flat";

export const TREND_COLOR: Record<TrendDirection, string> = {
  up: "var(--success)",
  down: "var(--danger)",
  flat: "var(--muted)",
};

/** The drawing's own units; the SVG stretches to its box (the line keeps its width). */
const WIDTH = 100;
const HEIGHT = 56;
const PADDING = 3;

/**
 * A small line over an area fading out downwards, from `values` in order: green when the trend is up, red when down.
 * It has no axes or numbers (the slot's figures say them) and fills the width it is given, 56px high. Drawn only when
 * there are at least two points to join.
 */
export function Sparkline({ values, direction }: { values: number[]; direction: TrendDirection }) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const x = (index: number) => (index / (values.length - 1)) * WIDTH;
  // A flat series runs through the middle rather than along an edge.
  const y = (value: number) => (span === 0 ? HEIGHT / 2 : PADDING + (1 - (value - min) / span) * (HEIGHT - 2 * PADDING));
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const color = TREND_COLOR[direction];

  return (
    <svg
      data-sparkline
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      fill="none"
      className="h-14 w-full max-w-48"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} fill={`url(#${gradientId})`} />
      <path d={line} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
