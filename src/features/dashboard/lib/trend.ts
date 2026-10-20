import type { TrendDirection } from "../components/layout/Sparkline";
import { formatCount } from "./genderSlices";

/** Which way a change goes: what colours its arrow and its sparkline. */
export const directionOf = (change: number): TrendDirection => (change > 0 ? "up" : change < 0 ? "down" : "flat");

/** A change with its sign, a true minus for a fall: "+2", "−1"; `format` writes the figure ("0" has no sign). */
export const signed = (change: number, format: (value: number) => string = formatCount) =>
  change === 0 ? format(0) : `${change < 0 ? "−" : "+"}${format(Math.abs(change))}`;
