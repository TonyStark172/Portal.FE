"use client";

import { useRef, useState, type Key } from "react";
import { ChevronDown } from "@gravity-ui/icons";
import { Button, Calendar, Dropdown, Label } from "@heroui/react";
import type { DateValue } from "@internationalized/date";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type MonthYearCalendarProps = {
  label: string;
  /** The date the calendar opens on. */
  anchor: DateValue;
  /** Same bounds as the DatePicker, so picking a month or year never lands outside them. */
  minValue?: DateValue;
  maxValue?: DateValue;
};

/**
 * A calendar for dates far from today, such as birthdays: the month comes from a list and the year from HeroUI's
 * year grid, instead of paging month by month. Use inside DatePicker.Popover.
 */
export function MonthYearCalendar({ label, anchor, minValue, maxValue }: MonthYearCalendarProps) {
  // The popover mounts the calendar each time it opens, so it starts again from the anchor.
  const [focused, setFocused] = useState(anchor);
  // The year just clicked in the year grid (see onFocusChange).
  const pickedYear = useRef<number | null>(null);

  const clamp = (date: DateValue) =>
    minValue && date.compare(minValue) < 0 ? minValue : maxValue && date.compare(maxValue) > 0 ? maxValue : date;

  // The year grid moves to a fixed day of the chosen year, losing the month being looked at; keep that month.
  function onFocusChange(next: DateValue) {
    const year = pickedYear.current;
    pickedYear.current = null;
    setFocused(year === next.year ? clamp(focused.set({ year })) : next);
  }

  return (
    <Calendar aria-label={label} focusedValue={focused} onFocusChange={onFocusChange}>
      <Calendar.Header>
        <div className="flex items-center gap-0.5">
          <Dropdown>
            {/* slot={null}: not one of the calendar's previous/next buttons, which every Button inside it would be. */}
            <Button
              slot={null}
              size="sm"
              variant="ghost"
              aria-label={`Tháng ${focused.month}, chọn tháng`}
              className="h-7 gap-1 px-1.5 text-sm font-medium [&_svg]:size-3 [&_svg]:text-accent-soft-foreground"
            >
              Tháng {focused.month}
              <ChevronDown />
            </Button>
            <Dropdown.Popover placement="bottom start" className="max-h-72">
              <Dropdown.Menu
                aria-label="Chọn tháng"
                selectionMode="single"
                selectedKeys={[String(focused.month)]}
                onAction={(key: Key) => setFocused(clamp(focused.set({ month: Number(key) })))}
              >
                {MONTHS.map((month) => (
                  <Dropdown.Item key={month} id={String(month)} textValue={`Tháng ${month}`}>
                    <Label>Tháng {month}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Calendar.YearPickerTrigger>
            {/* HeroUI's own heading style, so month and year read the same. */}
            <span className="calendar-year-picker__trigger-heading tabular-nums">{focused.year}</span>
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
        </div>
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
      <Calendar.YearPickerGrid>
        <Calendar.YearPickerGridBody>
          {({ year }) => (
            <Calendar.YearPickerCell
              year={year}
              onPress={() => {
                pickedYear.current = year;
              }}
            />
          )}
        </Calendar.YearPickerGridBody>
      </Calendar.YearPickerGrid>
    </Calendar>
  );
}
