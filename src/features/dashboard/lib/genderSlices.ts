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

/** 37.5 → "37,5%". */
export const formatPercent = (percent: number) => `${percentFormat.format(percent)}%`;
