"use client";

import { Modal } from "@heroui/react";
import { Factory, Flag, Gift } from "@gravity-ui/icons";
import { BUSINESS_OFFSET, formatBusinessTime } from "@/features/meetings/businessTime";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { occasionLastDay, occasionTitle, occasionTone, ordinal } from "../calendarEntries";
import type { Occasion } from "../eventTypes";

type Translate = (key: string) => string;

/** "Sinh nhật", "Ngày nghỉ lễ", or "Sinh nhật 5 năm" (the company's). */
export function occasionLabel(occasion: Occasion, t: Translate) {
  switch (occasion.kind) {
    case "Holiday": return t("events.publicHoliday");
    case "CompanyAnniversary": return t("events.companyBirthday").replace("{years}", String(occasion.years)).replace("{ordinal}", ordinal(occasion.years));
    default: return t("events.birthday");
  }
}

const dayMonth = { day: "2-digit", month: "2-digit" } as const;
const weekdayDayMonth = { weekday: "long", ...dayMonth } as const;
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
const noon = (day: string) => `${day}T12:00:00${BUSINESS_OFFSET}`;
/**
 * The day an occasion falls on, or a holiday's days ("16/02 – 20/02"); `long` names the weekdays ("Thứ Hai, 16/02 –
 * Thứ Sáu, 20/02").
 */
export function occasionDates(occasion: Occasion, locale: string, long = false) {
  const format = (day: string) => formatBusinessTime(noon(day), locale, long ? weekdayDayMonth : dayMonth);
  const last = occasionLastDay(occasion);
  const first = capitalized(format(occasion.date));
  return last === occasion.date ? first : `${first} – ${capitalized(format(last))}`;
}

/** The small icon of an occasion: a flag for a public holiday, a building for the company's birthday, a gift for a person's. */
export function OccasionIcon({ occasion, className = "size-3.5" }: { occasion: Pick<Occasion, "kind">; className?: string }) {
  const Icon = occasion.kind === "Holiday" ? Flag : occasion.kind === "CompanyAnniversary" ? Factory : Gift;
  return <Icon aria-hidden className={`occasion-icon shrink-0 ${className}`} />;
}

/**
 * An occasion opened from the calendar: a person's birthday (their photo, name and department, and the day), a public
 * holiday (its name and days), or the company's birthday (its name, the year it was founded, how many years).
 */
export function OccasionCard({ occasion, onClose }: { occasion: Occasion | null; onClose: () => void }) {
  const { t, locale } = useLocale();
  return (
    <Modal.Backdrop isOpen={occasion !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Container size="xs" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("meetings.close")} />
          {occasion && (
            <Modal.Body className={`occasion-card occasion-${occasionTone(occasion)} flex flex-col items-center gap-2 py-2 text-center`}>
              {occasion.kind === "Birthday"
                ? <UserAvatar fullName={occasion.fullName} avatarUrl={occasion.avatarUrl} size="lg" />
                : <span aria-hidden className="occasion-card-badge flex size-12 items-center justify-center rounded-full"><OccasionIcon occasion={occasion} className="size-6" /></span>}
              <Modal.Heading className="break-words text-lg font-semibold leading-snug">
                {occasion.kind === "Birthday" ? occasion.fullName : occasion.kind === "CompanyAnniversary" ? occasion.organizationName : occasionTitle(occasion, t)}
              </Modal.Heading>
              {occasion.kind === "Birthday" && occasion.departmentName && <p className="text-sm text-muted">{occasion.departmentName}</p>}
              {occasion.kind === "CompanyAnniversary" && (
                <p className="text-sm text-muted">{t("events.foundedIn").replace("{year}", String(Number(occasion.date.slice(0, 4)) - occasion.years))}</p>
              )}
              <p className="occasion-card-label mt-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
                <OccasionIcon occasion={occasion} />{occasionLabel(occasion, t)}
              </p>
              <p className="text-xs text-muted">{occasionDates(occasion, locale, true)}</p>
            </Modal.Body>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
