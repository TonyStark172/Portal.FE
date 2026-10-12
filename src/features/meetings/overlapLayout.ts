export type OverlapInterval = { id: string; start: number; end: number };
export type OverlapPosition = { left: number; width: number; layer: number };

/**
 * Lays out the meetings of one day column. Meetings that overlap, directly or through others, form a group; each
 * takes the lowest column free when it starts, so two meetings that do not overlap share a column. Columns are
 * cascaded (a little to the right, and above, each other) so every card keeps a visible strip.
 */
export function overlapLayout(events: OverlapInterval[]): Map<string, OverlapPosition> {
  const result = new Map<string, OverlapPosition>();
  const sorted = [...events].filter(event => event.end > event.start)
    .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id, undefined, { numeric: true }));
  let group: { event: OverlapInterval; column: number }[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const place = () => {
    const columns = columnEnds.length;
    const step = columns > 1 ? Math.min(18, 60 / (columns - 1)) : 0;
    const width = 100 - step * (columns - 1);
    for (const { event, column } of group) result.set(event.id, { left: column * step, width, layer: column + 1 });
  };
  for (const event of sorted) {
    if (event.start >= groupEnd) {
      place();
      group = [];
      columnEnds = [];
      groupEnd = -Infinity;
    }
    let column = columnEnds.findIndex(end => end <= event.start);
    if (column < 0) column = columnEnds.push(event.end) - 1;
    else columnEnds[column] = event.end;
    group.push({ event, column });
    groupEnd = Math.max(groupEnd, event.end);
  }
  place();
  return result;
}
