"use client";

import type { MeetingRoomStatsDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatHours, formatMeetings } from "../../lib/meetingFormat";
import { ChartCard } from "../layout/ChartCard";
import { BarList } from "./BarList";

/** The rooms (or other places) used for the most hours, ranked as the API gives them, a thin bar by their hours. */
export function MeetingRoomsCard({ rooms }: { rooms: MeetingRoomStatsDto[] }) {
  const { t, locale } = useLocale();
  const rows = rooms.map((room) => ({
    key: room.key,
    name: room.name.trim() || t("dashboard.noLocation"),
    value: room.totalHours,
    figures: [
      { slot: "hours", text: formatHours(room.totalHours, t, locale) },
      { slot: "count", text: formatMeetings(room.meetingCount, t, locale) },
    ],
  }));

  return (
    <ChartCard
      title={t("dashboard.topRooms")}
      description={t("dashboard.topRoomsDescription")}
      isEmpty={rows.length === 0}
      emptyMessage={t("dashboard.noRoomMeetings")}
    >
      <BarList rows={rows} label={t("dashboard.topRoomList")} rowAttribute="data-room-row" ranked />
    </ChartCard>
  );
}
