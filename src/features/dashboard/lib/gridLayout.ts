/** Width of a dashboard card on large screens: half a row, or the whole row. */
export type CardSpan = "half" | "full";

/**
 * The width each card actually takes: a half card that would sit alone on its row (last card, or followed by a
 * full one) stretches to the whole row, so the grid never shows an empty half.
 */
export function layoutSpans(spans: CardSpan[]): CardSpan[] {
  const result: CardSpan[] = [];
  let column = 0; // 0 = a new row starts, 1 = the right half is free

  spans.forEach((span, index) => {
    if (span === "full") {
      result.push("full");
      column = 0;
      return;
    }

    const next = spans[index + 1];
    if (column === 0 && (next === undefined || next === "full")) {
      result.push("full");
      return;
    }

    result.push("half");
    column = column === 0 ? 1 : 0;
  });

  return result;
}
