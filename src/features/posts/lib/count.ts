const counts = new Intl.NumberFormat("vi-VN");
const shortCounts = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** 10000 → "10.000". */
export const formatCount = (value: number) => counts.format(value);

/**
 * Short count for tight spots, as on Facebook: 950 → "950", 2712 → "2,7K", 10000 → "10K", 1250000 → "1,2 Tr".
 * Rounds down, so it never claims more than there is.
 */
export function formatCompact(value: number) {
  if (value < 1000) return String(value);
  const [size, unit] = value < 1_000_000 ? [1000, "K"] : [1_000_000, " Tr"];
  return `${shortCounts.format(Math.floor((value / size) * 10) / 10)}${unit}`;
}
