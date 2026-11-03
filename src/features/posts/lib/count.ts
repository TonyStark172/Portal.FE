import { getStoredLocale } from "@/shared/i18n/locale";

/** 10000 → "10.000" ("10,000"). */
export const formatCount = (value: number) => new Intl.NumberFormat(getStoredLocale()).format(value);

/**
 * Short count for tight spots, as on Facebook: 950 → "950", 2712 → "2,7K", 10000 → "10K", 1250000 → "1,2 Tr" ("1.2M").
 * Rounds down, so it never claims more than there is.
 */
export function formatCompact(value: number) {
  if (value < 1000) return String(value);
  const locale = getStoredLocale();
  const [size, unit] = value < 1_000_000 ? [1000, "K"] : [1_000_000, locale === "en-US" ? "M" : " Tr"];
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.floor((value / size) * 10) / 10)}${unit}`;
}
