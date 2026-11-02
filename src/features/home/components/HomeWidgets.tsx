"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, Gift } from "@gravity-ui/icons";
import { Button, Card, Chip, ScrollShadow, Skeleton } from "@heroui/react";
import { formatBusinessTime, BUSINESS_OFFSET } from "@/features/meetings/businessTime";
import { LiveDot, LiveTag } from "@/features/meetings/components/MeetingStateMarks";
import { addDateDays, businessDate, businessUtc } from "@/features/meetings/meetingForm";
import { MEETING_STATE_REFRESH_MS } from "@/features/meetings/meetingState";
import type { Meeting } from "@/features/meetings/meetingTypes";
import type { BirthdayOccasion } from "@/features/events/eventTypes";
import { useGetMeetingsQuery, useGetOccasionsQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { BIRTHDAYS_DAYS_AHEAD, MEETINGS_DAYS_AHEAD, birthdaysOf, businessDay, currentMeetings } from "../homeWidgets";

const HOUR_MINUTE = { hour: "2-digit", minute: "2-digit" } as const;
const DAY_MONTH = { day: "2-digit", month: "2-digit" } as const;
const WEEKDAY = { weekday: "long", ...DAY_MONTH } as const;
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The clock (an instant, ms), looked at again as the calendar does, so a meeting moves on without a reload. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MEETING_STATE_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** A widget of the home page: a title with a link to the calendar, and a list that scrolls on its own when long. */
function Widget({ title, icon, label, children }: { title: string; icon: ReactNode; label: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <Card aria-label={label} role="region" className="flex flex-col gap-3 xl:sticky xl:top-[calc(var(--app-header-height)+var(--app-main-padding))] xl:max-h-[calc(100dvh-var(--app-header-height)-2*var(--app-main-padding))]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        <Link href="/meetings" className="shrink-0 text-xs text-accent hover:underline">{t("home.openCalendar")}</Link>
      </div>
      <ScrollShadow size={24} className="scrollbar flex max-h-64 min-h-0 flex-1 flex-col gap-3 overflow-y-auto xl:max-h-none">
        {children}
      </ScrollShadow>
    </Card>
  );
}

function WidgetSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
    </div>
  );
}

function WidgetError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-start gap-2 text-sm text-muted">
      {message}
      <Button size="sm" variant="secondary" onPress={onRetry}>{t("common.retry")}</Button>
    </div>
  );
}

/** The left of the home page: the meetings under way, then those of the coming days; each opens its day on the calendar. */
export function MeetingsWidget() {
  const { t } = useLocale();
  const now = useNow();
  const today = businessDay(now);
  const { data, isLoading, isError, refetch } = useGetMeetingsQuery(
    { fromUtc: businessUtc(today), toUtc: businessUtc(addDateDays(today, MEETINGS_DAYS_AHEAD)) },
    { refetchOnMountOrArgChange: true },
  );
  const { ongoing, upcoming } = currentMeetings(data ?? [], now);

  return (
    <Widget title={t("home.meetings")} label={t("home.meetings")} icon={<Calendar aria-hidden className="size-4 shrink-0 text-accent" />}>
      {isLoading ? (
        <WidgetSkeleton label={t("home.meetingsLoading")} />
      ) : isError && !data ? (
        <WidgetError message={t("home.meetingsFailed")} onRetry={() => void refetch()} />
      ) : !ongoing.length && !upcoming.length ? (
        <p className="py-4 text-center text-sm text-muted">{t("home.noMeetings").replace("{days}", String(MEETINGS_DAYS_AHEAD))}</p>
      ) : (
        <>
          <MeetingGroup title={t("home.ongoing")} meetings={ongoing} today={today} live />
          <MeetingGroup title={t("home.upcoming")} meetings={upcoming} today={today} />
        </>
      )}
    </Widget>
  );
}

function MeetingGroup({ title, meetings, today, live = false }: { title: string; meetings: Meeting[]; today: string; live?: boolean }) {
  if (!meetings.length) return null;
  return (
    <section aria-label={title} className="flex shrink-0 flex-col gap-1">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      <ul className="flex flex-col gap-1">
        {meetings.map(meeting => <MeetingRow key={meeting.occurrenceKey != null ? `${meeting.id}-${meeting.occurrenceKey}` : meeting.id} meeting={meeting} today={today} live={live} />)}
      </ul>
    </section>
  );
}

/** A meeting, its colour on the edge: when (until when, once under way) and where. */
function MeetingRow({ meeting, today, live }: { meeting: Meeting; today: string; live: boolean }) {
  const { t, locale } = useLocale();
  const when = live ? meetingUntil(meeting, locale, t) : meetingStart(meeting, today, locale, t);
  // The calendar opens on the day it is on now, for a meeting that started before today.
  const day = live ? today : businessDate(meeting.startUtc);
  return (
    <li>
      <Link href={`/meetings?date=${day}`} className="flex min-w-0 gap-2 rounded-lg p-1.5 outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
        <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ background: meeting.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center text-sm font-medium text-foreground">
            {live && <LiveDot />}
            <span className="min-w-0 truncate" title={meeting.title}>{meeting.title}</span>
            {live && <LiveTag />}
          </span>
          <span className="block truncate text-xs text-muted">{when} · {meeting.location}</span>
        </span>
      </Link>
    </li>
  );
}

/** "Hôm nay · 14:00", "Ngày mai · 09:00", "Thứ Tư, 04/11 · 09:00"; all day in place of the time. */
function meetingStart(meeting: Meeting, today: string, locale: string, t: (key: string) => string) {
  const day = businessDate(meeting.startUtc);
  const label = day === today ? t("meetings.today")
    : day === addDateDays(today, 1) ? t("home.tomorrow")
    : capitalized(formatBusinessTime(meeting.startUtc, locale, WEEKDAY));
  return `${label} · ${meeting.isAllDay ? t("meetings.allDay") : formatBusinessTime(meeting.startUtc, locale, HOUR_MINUTE)}`;
}

/** "Đến 10:30"; with the day when it ends on another one; all day when it lasts all day. */
function meetingUntil(meeting: Meeting, locale: string, t: (key: string) => string) {
  if (meeting.isAllDay) return t("meetings.allDay");
  const sameDay = businessDate(meeting.startUtc) === businessDate(meeting.endUtc);
  const end = formatBusinessTime(meeting.endUtc, locale, sameDay ? HOUR_MINUTE : { ...DAY_MONTH, ...HOUR_MINUTE });
  return t("home.until").replace("{time}", end);
}

/** The right of the home page: the birthdays of the people working here, from today on. */
export function BirthdaysWidget() {
  const { t } = useLocale();
  const today = businessDay(useNow());
  const { data, isLoading, isError, refetch } = useGetOccasionsQuery(
    { fromUtc: businessUtc(today), toUtc: businessUtc(addDateDays(today, BIRTHDAYS_DAYS_AHEAD)) },
    { refetchOnMountOrArgChange: true },
  );
  const birthdays = birthdaysOf(data ?? []);

  return (
    <Widget title={t("home.birthdays")} label={t("home.birthdays")} icon={<Gift aria-hidden className="size-4 shrink-0 text-accent" />}>
      {isLoading ? (
        <WidgetSkeleton label={t("home.birthdaysLoading")} />
      ) : isError && !data ? (
        <WidgetError message={t("home.birthdaysFailed")} onRetry={() => void refetch()} />
      ) : !birthdays.length ? (
        <p className="py-4 text-center text-sm text-muted">{t("home.noBirthdays").replace("{days}", String(BIRTHDAYS_DAYS_AHEAD))}</p>
      ) : (
        <ul className="flex shrink-0 flex-col gap-2.5">
          {birthdays.map(birthday => <BirthdayRow key={`${birthday.userId}-${birthday.date}`} birthday={birthday} today={today} />)}
        </ul>
      )}
    </Widget>
  );
}

/** A person (their photo, name and department) and the day: marked out when it is today. */
function BirthdayRow({ birthday, today }: { birthday: BirthdayOccasion; today: string }) {
  const { t, locale } = useLocale();
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <UserAvatar fullName={birthday.fullName} avatarUrl={birthday.avatarUrl} size="sm" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground" title={birthday.fullName}>{birthday.fullName}</span>
        {birthday.departmentName && <span className="block truncate text-xs text-muted">{birthday.departmentName}</span>}
      </span>
      {birthday.date === today
        ? <Chip size="sm" variant="soft" color="accent" className="shrink-0">{t("meetings.today")}</Chip>
        // A day and month alone come out as "25-12" in Vietnamese.
        : <span className="shrink-0 text-xs tabular-nums text-muted">{formatBusinessTime(`${birthday.date}T12:00:00${BUSINESS_OFFSET}`, locale, DAY_MONTH).replace("-", "/")}</span>}
    </li>
  );
}
