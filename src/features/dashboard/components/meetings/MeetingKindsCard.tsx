"use client";

import type { MeetingKindStatsDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatHours, formatMeetings } from "../../lib/meetingFormat";
import { ChartCard } from "../layout/ChartCard";
import { BarList } from "./BarList";

/** The meetings of each kind (most first, as the API orders them): a bar by their number, with their hours. */
export function MeetingKindsCard({ kinds }: { kinds: MeetingKindStatsDto[] }) {
  const { t, locale } = useLocale();
  const rows = kinds
    .filter((kind) => kind.meetingCount > 0)
    .map((kind) => ({
      key: String(kind.kindId),
      name: kind.name.trim() || t("dashboard.unnamedKind"),
      value: kind.meetingCount,
      figures: [
        { slot: "count", text: formatMeetings(kind.meetingCount, t, locale) },
        { slot: "hours", text: formatHours(kind.totalHours, t, locale) },
      ],
    }));

  return (
    <ChartCard
      title={t("dashboard.meetingKinds")}
      description={t("dashboard.meetingKindsDescription")}
      isEmpty={rows.length === 0}
      emptyMessage={t("dashboard.noMeetings")}
    >
      <BarList rows={rows} label={t("dashboard.meetingKindList")} rowAttribute="data-kind-row" />
    </ChartCard>
  );
}
