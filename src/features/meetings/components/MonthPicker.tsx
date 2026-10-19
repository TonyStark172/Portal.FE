"use client";

import { Calendar } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { I18nProvider } from "react-aria";
import { useLocale } from "@/shared/i18n/LocaleProvider";

type MonthPickerProps = {
  /** The day the calendar is on (yyyy-mm-dd), filled. */
  date: string;
  /** The day focused (yyyy-mm-dd): its month is the one shown. */
  focused: string;
  /** Today in the company's time (yyyy-mm-dd), ringed. */
  today: string;
  /** The days of the shown month with at least one meeting, marked with a dot. */
  marked: ReadonlySet<string>;
  busy: boolean;
  onPick: (date: string) => void;
  onFocus: (date: string) => void;
};

/**
 * A month to move the calendar with (React Aria's calendar grid, so arrow keys move between days): the week starts
 * on Monday as the calendar's does, days with meetings carry a dot, today is ringed and the calendar's day filled.
 */
export function MonthPicker({ date, focused, today, marked, busy, onPick, onFocus }: MonthPickerProps) {
  const { locale, t } = useLocale();
  const vietnamese = locale.startsWith("vi");
  const [year, month] = focused.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const title = t("meetings.monthPickerTitle").replace("{month}", String(month)).replace("{monthName}", monthName).replace("{year}", String(year));
  // React Aria names the days in the portal's language (the page's provider does too; a calendar alone in a test has none).
  return (
    <I18nProvider locale={locale}>
      <Calendar aria-label={t("meetings.monthPicker")} className="meeting-month-picker" firstDayOfWeek="mon" isReadOnly={busy}
        value={parseDate(date)} onChange={(value: DateValue) => onPick(value.toString())}
        focusedValue={parseDate(focused)} onFocusChange={(value: DateValue) => onFocus(value.toString())}>
        <Calendar.Header className="pb-2">
          <h3 aria-live="polite" className="flex-1 text-sm font-semibold">{title}</h3>
          <Calendar.NavButton slot="previous" aria-label={t("meetings.previousMonth")} />
          <Calendar.NavButton slot="next" aria-label={t("meetings.nextMonth")} />
        </Calendar.Header>
        {/* Two letters a day: T2…CN in Vietnamese (the narrow names), Mo…Su in English. */}
        <Calendar.Grid weekdayStyle={vietnamese ? "narrow" : "short"}>
          <Calendar.GridHeader>{day => <Calendar.HeaderCell>{vietnamese ? day : day.slice(0, 2)}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>
            {day => (
              <Calendar.Cell date={day} className={day.toString() === today ? "meeting-month-today" : undefined}>
                {({ formattedDate, isOutsideMonth }) => (
                  <>
                    {formattedDate}
                    {!isOutsideMonth && marked.has(day.toString()) && <Calendar.CellIndicator />}
                  </>
                )}
              </Calendar.Cell>
            )}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </I18nProvider>
  );
}
