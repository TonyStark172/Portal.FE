"use client";

import { MeetingCalendar } from "@/features/meetings";
import { useLocale } from "@/shared/i18n";

export default function MeetingsPage() {
  const { t } = useLocale();
  return <section className="mx-auto w-full max-w-7xl"><div className="mb-5"><h1 className="text-2xl font-semibold">{t("meetings.title")}</h1><p className="text-sm text-muted">{t("meetings.description")}</p></div><MeetingCalendar /></section>;
}
