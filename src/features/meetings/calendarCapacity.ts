import { businessDate } from "./meetingForm";

export type CapacityItem = { id: number; startUtc: string; endUtc: string };

/** Meetings left out of a crowded day or time slot, shown as one "+N" entry that opens their list. */
export type MoreItems<T extends CapacityItem> = { key: string; day: string; startUtc: string; endUtc: string; items: T[] };

export type Capacity<T extends CapacityItem> = { shown: T[]; more: MoreItems<T>[] };

const byStart = <T extends CapacityItem>(a: T, b: T) => a.startUtc.localeCompare(b.startUtc) || a.id - b.id;

/**
 * The calendar draws every event it is given (FullCalendar only hides the ones past "+N more", it still builds them),
 * so a crowded calendar is trimmed before: each business day keeps its first `limit - 1` meetings and gathers the
 * others under one entry (month and list views).
 */
export function limitPerDay<T extends CapacityItem>(meetings: T[], limit: number): Capacity<T> {
  const days = new Map<string, T[]>();
  for (const meeting of [...meetings].sort(byStart)) {
    const day = businessDate(meeting.startUtc);
    days.set(day, [...(days.get(day) ?? []), meeting]);
  }
  const shown: T[] = [];
  const more: MoreItems<T>[] = [];
  for (const [day, items] of days) {
    if (items.length <= limit) {
      shown.push(...items);
      continue;
    }
    shown.push(...items.slice(0, limit - 1));
    const rest = items.slice(limit - 1);
    more.push({ key: `more:${day}`, day, startUtc: rest[0].startUtc, endUtc: rest.at(-1)!.endUtc, items: rest });
  }
  return { shown: shown.sort(byStart), more };
}

/**
 * Week and day views: meetings overlapping one another (directly or through others) form a group; a group needing
 * more than `limit` side-by-side columns keeps the meetings of its first `limit - 1` columns and gathers the others
 * under one entry spanning their time.
 */
export function limitPerOverlap<T extends CapacityItem>(meetings: T[], limit: number): Capacity<T> {
  const shown: T[] = [];
  const more: MoreItems<T>[] = [];
  let group: { meeting: T; column: number }[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    if (columnEnds.length <= limit) {
      shown.push(...group.map(entry => entry.meeting));
      return;
    }
    const rest = group.filter(entry => entry.column >= limit - 1).map(entry => entry.meeting);
    shown.push(...group.filter(entry => entry.column < limit - 1).map(entry => entry.meeting));
    const start = Math.min(...rest.map(m => Date.parse(m.startUtc)));
    const end = Math.max(...rest.map(m => Date.parse(m.endUtc)));
    more.push({
      key: `more:${rest[0].id}`, day: businessDate(rest[0].startUtc),
      startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(), items: rest,
    });
  };
  for (const meeting of [...meetings].sort(byStart)) {
    const start = Date.parse(meeting.startUtc);
    const end = Date.parse(meeting.endUtc);
    if (start >= groupEnd) {
      if (group.length) close();
      group = [];
      columnEnds = [];
      groupEnd = -Infinity;
    }
    let column = columnEnds.findIndex(columnEnd => columnEnd <= start);
    if (column < 0) column = columnEnds.push(end) - 1;
    else columnEnds[column] = end;
    group.push({ meeting, column });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) close();
  return { shown: shown.sort(byStart), more };
}
