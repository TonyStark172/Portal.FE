import type { ReactNode } from "react";

/** Shown in the grid at most; the last tile tells how many more there are ("+N"). */
const MAX_TILES = 5;

export type TileInfo = {
  /** The only item: shown at its own shape instead of cropped to a cell. */
  isSingle: boolean;
  /** How many items are hidden behind this tile (the fifth one), or 0. */
  more: number;
};

type MediaGridProps = {
  count: number;
  /** One tile, filling its cell. */
  renderTile: (index: number, info: TileInfo) => ReactNode;
  className?: string;
};

/**
 * The album as a collage, as on Facebook: 1 large; 2 side by side; 3 = one tall on the left and two on the right;
 * 4 = 2×2; 5 and more = 2 on top, 3 below, with "+N" over the last.
 */
export function MediaGrid({ count, renderTile, className = "" }: MediaGridProps) {
  if (count === 0) return null;

  const shown = Math.min(count, MAX_TILES);
  const cell = (index: number, place = "") => (
    <div key={index} className={`relative min-h-0 overflow-hidden bg-default ${place}`}>
      {renderTile(index, { isSingle: count === 1, more: index === MAX_TILES - 1 ? count - MAX_TILES : 0 })}
    </div>
  );

  const layout =
    count === 1
      ? "grid"
      : count === 2
        ? "grid aspect-[2/1] grid-cols-2"
        : count === 3
          ? "grid aspect-[4/3] grid-cols-2 grid-rows-2"
          : count === 4
            ? "grid aspect-square grid-cols-2 grid-rows-2"
            : "grid aspect-[6/5] grid-cols-6 grid-rows-[3fr_2fr]";

  // Where each cell goes when the layout is not a plain grid.
  const place = (index: number) => {
    if (count === 3) return index === 0 ? "row-span-2" : "";
    if (count >= 5) return index < 2 ? "col-span-3" : "col-span-2";
    return "";
  };

  return (
    <div className={`${layout} gap-0.5 overflow-hidden rounded-xl ${className}`}>
      {Array.from({ length: shown }, (_, index) => cell(index, place(index)))}
    </div>
  );
}
