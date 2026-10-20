"use client";
import { Button } from "@heroui/react";
import { weekdays } from "../meetingForm";
import type { Weekday } from "../meetingTypes";
import { useLocale } from "@/shared/i18n";

export function WeekdayChips({ value, onChange, disabled, label }: { value: Weekday[]; onChange: (days: Weekday[]) => void; disabled?: boolean; label: string }) {
  const { t } = useLocale();
  const dayLabels = [t("meetings.dayMon"), t("meetings.dayTue"), t("meetings.dayWed"), t("meetings.dayThu"), t("meetings.dayFri"), t("meetings.daySat"), t("meetings.daySun")];
  const toggle = (day: Weekday) => {
    const next = value.includes(day) ? value.filter(d => d !== day) : [...value, day];
    // Monday-first whatever the click order.
    onChange(weekdays.filter(d => next.includes(d)));
  };
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {weekdays.map((day, index) => (
        <Button key={day} size="sm" variant={value.includes(day) ? "primary" : "secondary"} isDisabled={disabled} aria-pressed={value.includes(day)} onPress={() => toggle(day)}>
          {dayLabels[index]}
        </Button>
      ))}
    </div>
  );
}
