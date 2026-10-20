import type { MeetingDashboardDto } from "@/shared/api/generated/portalApi";

/** October 2026: 12 meetings for 18,5 hours (8 for 20 hours in September), 2 canceled. */
export const meetingDashboard: MeetingDashboardDto = {
  from: "2026-10-01",
  to: "2026-10-31",
  totals: {
    meetingCount: 12,
    totalHours: 18.5,
    canceledCount: 2,
    averageParticipants: 4.5,
    previousMeetingCount: 8,
    previousTotalHours: 20,
  },
  trend: [
    { from: "2026-10-01", to: "2026-10-07", meetingCount: 3, totalHours: 4.5 },
    { from: "2026-10-08", to: "2026-10-14", meetingCount: 5, totalHours: 8 },
    { from: "2026-10-15", to: "2026-10-21", meetingCount: 0, totalHours: 0 },
    { from: "2026-10-22", to: "2026-10-31", meetingCount: 4, totalHours: 6 },
  ],
  byKind: [
    { kindId: 1, name: "Họp nội bộ", meetingCount: 8, totalHours: 12 },
    { kindId: 2, name: "Họp khách hàng", meetingCount: 4, totalHours: 6.5 },
  ],
  topRooms: [
    { key: "room-1", name: "Phòng Hà Nội", meetingCount: 6, totalHours: 10 },
    { key: "online", name: "Trực tuyến", meetingCount: 4, totalHours: 5 },
    { key: "room-2", name: "Phòng Sài Gòn", meetingCount: 2, totalHours: 3.5 },
  ],
  // Monday first: Tuesday is the busiest.
  busiestWeekday: [2, 5, 1, 3, 1, 0, 0],
  // 9:00, 10:00 and 14:00, the busiest.
  busiestHour: Array.from({ length: 24 }, (_, hour) => ({ 9: 4, 10: 3, 14: 5 })[hour] ?? 0),
};

/** A period without a single meeting. */
export const emptyMeetingDashboard: MeetingDashboardDto = {
  from: "2026-10-01",
  to: "2026-10-31",
  totals: { meetingCount: 0, totalHours: 0, canceledCount: 0, averageParticipants: 0, previousMeetingCount: 0, previousTotalHours: 0 },
  trend: meetingDashboard.trend.map((step) => ({ ...step, meetingCount: 0, totalHours: 0 })),
  byKind: [],
  topRooms: [],
  busiestWeekday: Array(7).fill(0),
  busiestHour: Array(24).fill(0),
};
