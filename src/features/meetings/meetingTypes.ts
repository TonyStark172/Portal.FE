import type {
  AudiencePage,
  AudiencePerson,
  AudienceSelection,
  DayOfWeek,
  MeetingDepartment,
  MeetingDto,
  MeetingEditRequest,
  MeetingEditScope,
  MeetingKindDto,
  MeetingLocationDto,
  MeetingMutationResult,
  MeetingScheduleDto,
  MeetingWriteRequest,
  RecurrenceFrequency,
  RecurrenceRuleDto,
  WorkDayDto,
  WorkWeekDto,
} from "@/shared/api/generated/portalApi";

// The API's own types (enums as the API writes them: "Weekly", "Monday", "Occurrence").
export type Frequency = RecurrenceFrequency;
export type Weekday = DayOfWeek;
export type RecurrenceRule = RecurrenceRuleDto;
export type MeetingSchedule = MeetingScheduleDto;
export type Meeting = MeetingDto;
export type EditScope = MeetingEditScope;
export type {
  AudiencePage,
  AudiencePerson,
  AudienceSelection,
  MeetingDepartment,
  MeetingEditRequest,
  MeetingKindDto,
  MeetingLocationDto,
  MeetingMutationResult,
  MeetingWriteRequest,
  WorkDayDto,
  WorkWeekDto,
};

/** What the calendar asks the API for: a window of time, and optionally only some of the meetings in it. */
export type MeetingQuery = { fromUtc: string; toUtc: string; mine?: boolean; kindIds?: number[]; locations?: string[]; search?: string };

/** An occurrence that clashes, as listed in a "meetingConflict" problem. */
export type MeetingConflict = { sequence: number; startUtc: string; endUtc: string; locationConflict: boolean; participantConflict: boolean };

export const noAudience: AudienceSelection = { userIds: [], departmentIds: [], allEmployees: false, excludedUserIds: [] };

/**
 * The booking form. `start`/`end` are business-time inputs ("yyyy-mm-ddThh:mm", or dates when all day, the end
 * inclusive). `savedAudience` is how the people of the meeting being edited were picked: left as it is, the edit
 * keeps the people (and their reminders) instead of picking them again.
 */
export type MeetingFormValue = {
  title: string;
  kindId: number | null;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  recurrence: RecurrenceRule | null;
  audience: AudienceSelection;
  scope: EditScope;
  replaceExceptions: boolean;
  editing?: Meeting;
  savedAudience?: AudienceSelection;
};
