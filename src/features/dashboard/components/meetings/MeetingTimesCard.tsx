"use client";

import { useLocale } from "@/shared/i18n";
import { busiestIndex, formatMeetings, hourRange, tintLevel } from "../../lib/meetingFormat";
import { ChartCard } from "../layout/ChartCard";

/** The tint of each level: one hue (the accent) from the neutral of an empty cell to full strength. */
const TINT = [
  "var(--default)",
  "color-mix(in oklab, var(--accent) 25%, var(--default))",
  "color-mix(in oklab, var(--accent) 50%, var(--default))",
  "color-mix(in oklab, var(--accent) 75%, var(--default))",
  "var(--accent)",
];

type Cell = { key: number; label: string; tick: string; count: number };

/**
 * When meetings start: a strip of the seven days of the week (from Monday) and one of the 24 hours of the day (all-day
 * meetings have no hour), each cell tinted by its meetings, the busiest marked, with its count, and named above the
 * strip. Every cell is named with its meetings for screen readers (and on hover).
 */
export function MeetingTimesCard({ weekdays, hours }: { weekdays: number[]; hours: number[] }) {
  const { t, locale } = useLocale();
  const days: Cell[] = weekdays.map((count, day) => ({
    key: day,
    label: t(`dashboard.weekday.${day}`),
    tick: t(`dashboard.weekdayShort.${day}`),
    count,
  }));
  const hourCells: Cell[] = hours.map((count, hour) => ({
    key: hour,
    label: hourRange(hour),
    tick: hour % 6 === 0 ? `${String(hour).padStart(2, "0")}:00` : "",
    count,
  }));

  return (
    <ChartCard
      title={t("dashboard.busiestTimes")}
      description={t("dashboard.busiestTimesDescription")}
      isEmpty={[...weekdays, ...hours].every((count) => count === 0)}
      emptyMessage={t("dashboard.noMeetings")}
    >
      <div className="flex flex-col gap-6">
        <Strip id="weekday" title={t("dashboard.byWeekday")} cells={days} format={(count) => formatMeetings(count, t, locale)} />
        <Strip id="hour" title={t("dashboard.byHour")} cells={hourCells} format={(count) => formatMeetings(count, t, locale)} dense />
      </div>
    </ChartCard>
  );
}

function Strip({ id, title, cells, format, dense = false }: { id: string; title: string; cells: Cell[]; format: (count: number) => string; dense?: boolean }) {
  const { t } = useLocale();
  const top = busiestIndex(cells.map((cell) => cell.count));
  const max = top === -1 ? 0 : cells[top].count;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="text-xs font-medium text-muted">{title}</h4>
        {top !== -1 && (
          <span data-busiest={id} className="text-xs text-foreground">
            {t("dashboard.busiest").replace("{label}", `${cells[top].label} · ${format(cells[top].count)}`)}
          </span>
        )}
      </div>
      <ul
        role="list"
        aria-label={title}
        data-strip={id}
        className={`grid ${dense ? "grid-cols-24 gap-0.5" : "grid-cols-7 gap-1"}`}
      >
        {cells.map((cell, index) => {
          const level = tintLevel(cell.count, max);
          const name = `${cell.label}: ${format(cell.count)}`;
          return (
            <li key={cell.key} className="flex min-w-0 flex-col items-center gap-1">
              <span
                role="img"
                aria-label={name}
                title={name}
                data-cell
                data-level={level}
                {...(index === top && { "data-top": "" })}
                className={`flex w-full items-center justify-center rounded-[4px] text-[10px] font-semibold tabular-nums ${dense ? "h-7" : "h-9 text-xs"} ${level >= 3 ? "text-accent-foreground" : "text-foreground"} ${index === top ? "ring-2 ring-foreground/70 ring-offset-1 ring-offset-surface" : ""}`}
                style={{ background: TINT[level] }}
              >
                {index === top && cell.count}
              </span>
              <span aria-hidden className={`whitespace-nowrap text-[11px] leading-none text-muted ${dense ? "self-start" : ""}`}>
                {cell.tick || " "}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
