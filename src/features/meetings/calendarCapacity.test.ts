import { describe, expect, test } from "vitest";
import { limitPerDay, limitPerOverlap, type CapacityItem } from "./calendarCapacity";

/** A meeting from `hour` to `hour + hours` on 2026-10-`day` (business time, UTC+7). */
const meeting = (id: number, day: number, hour: number, hours = 1): CapacityItem => ({
  id,
  startUtc: new Date(Date.UTC(2026, 9, day, hour - 7)).toISOString(),
  endUtc: new Date(Date.UTC(2026, 9, day, hour - 7 + hours)).toISOString(),
});

describe("a busy day in the month or list view", () => {
  test("shows its first meetings and gathers the others under one entry", () => {
    const busy = Array.from({ length: 10 }, (_, i) => meeting(i + 1, 12, 8 + i));
    const quiet = [meeting(100, 13, 9)];

    const { shown, more } = limitPerDay([...busy, ...quiet], 4);

    expect(shown.map(m => m.id)).toEqual([1, 2, 3, 100]);
    expect(more).toHaveLength(1);
    expect(more[0].day).toBe("2026-10-12");
    expect(more[0].items.map(m => m.id)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  test("groups by business day: 23:00 UTC+7 is still the same day", () => {
    const { shown, more } = limitPerDay([meeting(1, 12, 23), meeting(2, 12, 6)], 4);

    expect(shown.map(m => m.id)).toEqual([2, 1]);
    expect(more).toEqual([]);
  });
});

describe("meetings at the same time in the week or day view", () => {
  test("shows a few of them and gathers the others over the time they take", () => {
    const together = Array.from({ length: 10 }, (_, i) => meeting(i + 1, 12, 9, 2));
    const later = meeting(100, 12, 15);

    const { shown, more } = limitPerOverlap([...together, later], 4);

    expect(shown.map(m => m.id)).toEqual([1, 2, 3, 100]);
    expect(more).toHaveLength(1);
    expect(more[0].items).toHaveLength(7);
    expect(more[0].startUtc).toBe(together[3].startUtc);
    expect(more[0].endUtc).toBe(together[3].endUtc);
  });

  test("keeps every meeting of a group within the limit", () => {
    const { shown, more } = limitPerOverlap([meeting(1, 12, 9), meeting(2, 12, 9), meeting(3, 12, 11)], 4);

    expect(shown).toHaveLength(3);
    expect(more).toEqual([]);
  });
});

test("ten thousand meetings in a week leave a bounded number of entries", () => {
  const crowd = Array.from({ length: 10_000 }, (_, i) => meeting(i + 1, 12 + (i % 7), 8 + (i % 10)));

  const day = limitPerDay(crowd, 4);
  const grid = limitPerOverlap(crowd, 4);

  expect(day.shown.length + day.more.length).toBeLessThanOrEqual(7 * 4);
  expect(grid.shown.length + grid.more.length).toBeLessThanOrEqual(7 * 10 * 4);
});
