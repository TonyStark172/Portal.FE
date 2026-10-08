import type { GenderStatsDto } from "@/shared/api/generated/portalApi";

export type GenderKey = "male" | "female";

export type GenderSlice = {
  key: GenderKey;
  label: string;
  count: number;
  /** Share of those who gave their gender, 0–100 (men and women add up to 100). */
  percent: number;
  /** Chart colour; follows the light or dark theme (see globals.css). */
  color: string;
};

const GROUPS: { key: GenderKey; label: string; color: string }[] = [
  { key: "male", label: "Nam", color: "var(--chart-male)" },
  { key: "female", label: "Nữ", color: "var(--chart-female)" },
];

/** Men then women. People who have not filled in their gender yet are left out (see `unspecified`). */
export function toGenderSlices(stats: GenderStatsDto): GenderSlice[] {
  const known = stats.male + stats.female;
  return GROUPS.map(({ key, label, color }) => ({
    key,
    label,
    color,
    count: stats[key],
    percent: known > 0 ? (stats[key] / known) * 100 : 0,
  }));
}

const numberFormat = new Intl.NumberFormat("vi-VN");
const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export const formatCount = (value: number) => numberFormat.format(value);

/** 37.5 → "37,5%"; a share above zero too small to round to 0,1 shows as "<0,1%", never as 0%. */
export const formatPercent = (percent: number) =>
  percent > 0 && percent < 0.05 ? "<0,1%" : `${percentFormat.format(percent)}%`;
