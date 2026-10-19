export type TrendDirection = "up" | "down" | "flat";

export const TREND_COLOR: Record<TrendDirection, string> = {
  up: "var(--success)",
  down: "var(--danger)",
  flat: "var(--muted)",
};

const WIDTH = 80;
const HEIGHT = 32;
const PADDING = 2;

/**
 * A small line with a faint area under it, from `values` in order: green when the trend is up, red when down. It
 * has no axes or numbers (the card's figures say them) and hides on a phone, where the slots are narrow. Drawn
 * only when there are at least two points to join.
 */
export function Sparkline({ values, direction }: { values: number[]; direction: TrendDirection }) {
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
      width={WIDTH}
      height={HEIGHT}
      fill="none"
      className="hidden shrink-0 self-center @4xl:block"
    >
      <path d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} fill={color} fillOpacity={0.12} />
      <path d={line} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
