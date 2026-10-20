"use client";

import { Suspense } from "react";
import { MeetingCalendar } from "@/features/meetings";
import { useLocale } from "@/shared/i18n";

export default function MeetingsPage() {
  const { t } = useLocale();
  return (
    <section className="meetings-page w-full">
      {/* On a phone the app header names the page: the heading is left to screen readers, the calendar takes the room. */}
      <div className="mb-5 phone:mb-0"><h1 className="text-2xl font-semibold phone:sr-only">{t("meetings.title")}</h1><p className="text-sm text-muted phone:hidden">{t("meetings.description")}</p></div>
      {/* The calendar keeps its view, date and filters in the URL (useSearchParams), which needs a Suspense boundary. */}
      <Suspense><MeetingCalendar /></Suspense>
    </section>
  );
}
